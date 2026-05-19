import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import FeynmanSession from "@/components/feynman/FeynmanSession";

interface PageProps {
  params: Promise<{ id: string; topicId: string; sessionId: string }>;
}

export default async function FeynmanSessionPage({ params }: PageProps) {
  const { id: courseId, topicId, sessionId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) redirect("/sign-in");

  // Fetch the session — verify ownership
  const { data: session } = await supabase
    .from("feynman_sessions")
    .select("*, topics(id, title)")
    .eq("id", sessionId)
    .eq("user_id", dbUser.id)
    .single();

  if (!session) notFound();

  // If already completed, redirect back to the topic
  if (session.status !== "active") {
    redirect(`/dashboard/courses/${courseId}/topics/${topicId}`);
  }

  const topic = session.topics as any;

  return (
    <div className="py-2">
      <FeynmanSession
        sessionId={sessionId}
        topicTitle={topic?.title ?? "Topic"}
        courseId={courseId}
        topicId={topicId}
        initialMessages={Array.isArray(session.messages) ? session.messages : []}
      />
    </div>
  );
}
