import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateScrollInsight } from "@/lib/ai/generate-scroll";
import { awardAchievementsIfNew, applyAchievementXP } from "@/lib/achievements";

// GET /api/scroll/today
// Two phases so the client can show an in-world "Unrolling the scroll…" wait
// without flashing a modal at users who have no scroll coming:
//   - default (peek): never generates. Returns the cached scroll if one exists,
//     `{ pending: true }` if a scroll *can* be generated, or `{ content: null }`
//     if there's nothing to show. Cheap — no AI call.
//   - ?generate=1: generates today's scroll (the original blocking behavior),
//     caches it, and returns it. Called only after a peek reports `pending`.
export const maxDuration = 60;

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const generate = new URL(request.url).searchParams.get("generate") === "1";

  const supabase = createServiceClient();
  const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  // Resolve internal user id
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check if today's scroll already exists
  const { data: existing } = await supabase
    .from("daily_scrolls")
    .select("*")
    .eq("user_id", dbUser.id)
    .eq("scroll_date", todayStr)
    .single();

  if (existing) {
    return NextResponse.json({
      id: existing.id,
      content: existing.content,
      topicTitle: existing.topic_title,
      courseTitle: existing.course_title,
      dismissed: !!existing.dismissed_at,
    });
  }

  // No scroll yet — find candidate topics from the user's ready courses. In
  // peek mode we only need to know whether at least one exists (limit 1); in
  // generate mode we pull a pool to pick a random topic from.
  const { data: topics } = await supabase
    .from("topics")
    .select(`
      id,
      title,
      summary,
      key_concepts,
      episodes!inner(
        courses!inner(
          id,
          title,
          user_id,
          status,
          output_language
        )
      )
    `)
    .eq("episodes.courses.user_id", dbUser.id)
    .eq("episodes.courses.status", "ready")
    .not("summary", "is", null)
    .limit(generate ? 50 : 1);

  // No courses ready yet — return null gracefully
  if (!topics || topics.length === 0) {
    return NextResponse.json({ content: null });
  }

  // Peek mode: a scroll can be generated, but defer the AI call until the
  // client asks for it (so it can show the loading modal meanwhile).
  if (!generate) {
    return NextResponse.json({ pending: true });
  }

  // Pick a random topic
  const topic = topics[Math.floor(Math.random() * topics.length)];
  const courseRow =
    (topic.episodes as any)?.courses ??
    (Array.isArray(topic.episodes) ? (topic.episodes[0] as any)?.courses : null) ??
    null;
  const courseTitle = courseRow?.title ?? "Your Course";
  // Use the course's output_language override so scrolls stay consistent with
  // the rest of the course's generated content.
  const rawLang = courseRow?.output_language;
  const outputLanguage: "auto" | "en" | "he" =
    rawLang === "en" || rawLang === "he" ? rawLang : "auto";

  let insight = "";
  try {
    insight = await generateScrollInsight({
      topicTitle: topic.title,
      summary: topic.summary || "",
      keyConcepts: Array.isArray(topic.key_concepts) ? topic.key_concepts : [],
      courseTitle,
      outputLanguage,
    });
  } catch {
    // If AI fails, skip gracefully — don't break the dashboard
    return NextResponse.json({ content: null });
  }

  // Store so we don't regenerate on the same day
  const { data: inserted } = await supabase
    .from("daily_scrolls")
    .insert({
      user_id: dbUser.id,
      scroll_date: todayStr,
      content: insight,
      topic_id: topic.id,
      topic_title: topic.title,
      course_title: courseTitle,
    })
    .select()
    .single();

  return NextResponse.json({
    id: inserted?.id,
    content: insight,
    topicTitle: topic.title,
    courseTitle,
    dismissed: false,
  });
}

// POST /api/scroll/today/dismiss
// Marks today's scroll as dismissed so it doesn't show again today.
// Also checks for scroll-related achievements (Dawn Scholar, Lore Keeper).
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: dbUser } = await supabase
    .from("users")
    .select("id, total_xp")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await supabase
    .from("daily_scrolls")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("user_id", dbUser.id)
    .eq("scroll_date", todayStr);

  // Count total dismissed scrolls so far (including today)
  const { count: dismissedCount } = await supabase
    .from("daily_scrolls")
    .select("id", { count: "exact", head: true })
    .eq("user_id", dbUser.id)
    .not("dismissed_at", "is", null);

  const total = dismissedCount ?? 0;

  // Check which scroll achievements the user should receive
  const slugsToCheck: string[] = [];
  if (total >= 1) slugsToCheck.push("dawn_scholar");
  if (total >= 7) slugsToCheck.push("lore_keeper");

  const newAchievements = await awardAchievementsIfNew({
    userId: dbUser.id,
    slugs: slugsToCheck,
    supabase,
  });

  if (newAchievements.length > 0) {
    await applyAchievementXP({
      userId: dbUser.id,
      achievements: newAchievements,
      currentTotalXp: dbUser.total_xp ?? 0,
      supabase,
    });
  }

  return NextResponse.json({ ok: true, newAchievements });
}
