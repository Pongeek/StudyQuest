import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { sourceFileId, mode } = await request.json();

  if (!sourceFileId || !["timed", "assisted"].includes(mode)) {
    return NextResponse.json({ error: "sourceFileId and mode required" }, { status: 400 });
  }

  const { data: session, error } = await supabase
    .from("exam_sessions")
    .insert({
      user_id: dbUser.id,
      source_file_id: sourceFileId,
      mode,
    })
    .select()
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id });
}
