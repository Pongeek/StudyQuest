import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/users/featured-trophy
 *
 * Sets (or clears) the current user's Featured Trophy — the achievement pinned
 * to their profile crest. Body: `{ achievementId: string | null }` (null clears
 * the pin, falling back to most-recently-earned at render time).
 *
 * Authorization: signed in via Clerk, and ownership-checked — you can only
 * feature an achievement you have actually earned. Idempotent.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let achievementId: string | null;
  try {
    const body = await req.json();
    achievementId = body?.achievementId ?? null;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (achievementId !== null && typeof achievementId !== "string") {
    return NextResponse.json({ error: "Invalid achievementId" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Ownership — you can only feature an achievement you've earned. A combined
  // WHERE means a cross-tenant or never-earned id simply returns no row.
  if (achievementId !== null) {
    const { data: owned } = await supabase
      .from("user_achievements")
      .select("id")
      .eq("user_id", dbUser.id)
      .eq("achievement_id", achievementId)
      .maybeSingle();
    if (!owned) {
      return NextResponse.json(
        { error: "You can only feature a trophy you've earned" },
        { status: 403 }
      );
    }
  }

  const { error } = await supabase
    .from("users")
    .update({ featured_achievement_id: achievementId })
    .eq("id", dbUser.id);

  if (error) {
    console.error("[api/users/featured-trophy] update failed:", error);
    return NextResponse.json(
      { error: "Failed to set featured trophy" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, featuredAchievementId: achievementId });
}
