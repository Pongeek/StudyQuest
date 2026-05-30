// GET  /api/topics/[id]/cheat-sheet — return cached cheat sheet (or null)
// POST /api/topics/[id]/cheat-sheet — generate fresh (always overwrites)
//
// Ownership chain: topic → episode → course → user.

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { classifyAiError, classifiedErrorBody } from "@/lib/ai-error";
import { generateCheatSheet } from "@/lib/ai/generate-cheat-sheet";

export const maxDuration = 60;

async function resolveOwnedTopic(
  supabase: ReturnType<typeof createServiceClient>,
  topicId: string,
  clerkId: string,
) {
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", clerkId)
    .single();
  if (!dbUser) return { error: "auth" as const };

  const { data: topic } = await supabase
    .from("topics")
    .select(
      `
      id, title, summary, key_concepts, cheat_sheet, cheat_sheet_generated_at,
      episodes!inner (
        title,
        courses!inner ( user_id, subject, output_language )
      )
    `,
    )
    .eq("id", topicId)
    .single();
  if (!topic) return { error: "not_found" as const };

  type EpRow = { title?: string | null; courses?: unknown };
  type CourseRow = { user_id?: string | null; subject?: string | null; output_language?: string | null };
  const episode = (Array.isArray(topic.episodes) ? topic.episodes[0] : topic.episodes) as EpRow | undefined;
  const courseRaw = (Array.isArray(episode?.courses) ? episode?.courses[0] : episode?.courses) as CourseRow | undefined;

  if (!courseRaw || courseRaw.user_id !== dbUser.id) {
    return { error: "forbidden" as const };
  }

  return {
    dbUserId: dbUser.id,
    topic: {
      id: topic.id as string,
      title: topic.title as string,
      summary: topic.summary as string,
      key_concepts: (topic.key_concepts as string[]) || [],
      cheat_sheet: topic.cheat_sheet as string | null,
      cheat_sheet_generated_at: topic.cheat_sheet_generated_at as string | null,
    },
    episodeTitle: (episode?.title as string) ?? "",
    courseSubject: (courseRaw.subject as string) ?? "Academic",
    outputLanguage:
      courseRaw.output_language === "en" || courseRaw.output_language === "he"
        ? (courseRaw.output_language as "en" | "he")
        : ("auto" as const),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      classifiedErrorBody("AUTH_ERROR", "Sign-in expired. Refresh to sign back in.", false),
      { status: 401 },
    );
  }

  const supabase = createServiceClient();
  const resolved = await resolveOwnedTopic(supabase, topicId, userId);
  if ("error" in resolved) {
    const status =
      resolved.error === "auth" ? 401 : resolved.error === "not_found" ? 404 : 403;
    return NextResponse.json(
      classifiedErrorBody(
        resolved.error === "auth" ? "AUTH_ERROR" : "UNKNOWN",
        resolved.error === "auth"
          ? "Sign-in expired. Refresh to sign back in."
          : resolved.error === "not_found"
            ? "Topic not found."
            : "You don't have access to that topic.",
        false,
      ),
      { status },
    );
  }

  return NextResponse.json({
    content: resolved.topic.cheat_sheet,
    generatedAt: resolved.topic.cheat_sheet_generated_at,
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const { topicId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      classifiedErrorBody("AUTH_ERROR", "Sign-in expired. Refresh to sign back in.", false),
      { status: 401 },
    );
  }

  const supabase = createServiceClient();
  const resolved = await resolveOwnedTopic(supabase, topicId, userId);
  if ("error" in resolved) {
    const status =
      resolved.error === "auth" ? 401 : resolved.error === "not_found" ? 404 : 403;
    return NextResponse.json(
      classifiedErrorBody(
        resolved.error === "auth" ? "AUTH_ERROR" : "UNKNOWN",
        resolved.error === "auth"
          ? "Sign-in expired. Refresh to sign back in."
          : resolved.error === "not_found"
            ? "Topic not found."
            : "You don't have access to that topic.",
        false,
      ),
      { status },
    );
  }

  let reply;
  try {
    reply = await generateCheatSheet({
      topicTitle: resolved.topic.title,
      topicSummary: resolved.topic.summary || "",
      keyConcepts: resolved.topic.key_concepts,
      episodeTitle: resolved.episodeTitle,
      courseSubject: resolved.courseSubject,
      outputLanguage: resolved.outputLanguage,
    });
  } catch (err) {
    console.error("[api/topics/cheat-sheet] generation failed:", err);
    const classified = classifyAiError(err);
    return NextResponse.json({ error: classified }, { status: 502 });
  }

  const generatedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("topics")
    .update({
      cheat_sheet: reply.content,
      cheat_sheet_generated_at: generatedAt,
    })
    .eq("id", topicId);

  if (updateError) {
    console.error("[api/topics/cheat-sheet] persist failed:", updateError);
    return NextResponse.json(
      classifiedErrorBody("UNKNOWN", "Couldn't save the cheat sheet — try again.", true),
      { status: 500 },
    );
  }

  console.log(
    `[api/topics/cheat-sheet] generated topic=${topicId} tokens=${reply.outputTokens} stop_reason=${reply.stopReason}`,
  );

  return NextResponse.json({
    content: reply.content,
    generatedAt,
  });
}
