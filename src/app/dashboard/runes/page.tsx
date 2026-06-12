import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Gem, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createServiceClient } from "@/lib/supabase/server";
import { countDueRunes } from "@/lib/runes-queue";
import RuneDrillLauncher from "@/components/runes/RuneDrillLauncher";

/**
 * /dashboard/runes — one page, three entry points (review/page.tsx pattern):
 *   (none)                        → global due session across all courses
 *   ?scope=topic&topicId=...      → drill one deck (due-first, cram allowed)
 *   ?scope=course&courseId=...    → cram every deck in a course
 *
 * Topic/course ownership and emptiness are enforced by /api/runes/start —
 * the launcher surfaces its errors. Only the common due-scope empty state
 * gets a server-rendered page.
 */
export default async function RunesPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; topicId?: string; courseId?: string }>;
}) {
  const { scope, topicId, courseId } = await searchParams;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_id", userId)
    .single();
  if (!dbUser) redirect("/sign-in");

  if (scope === "topic" && topicId) {
    return <RuneDrillLauncher scope="topic" topicId={topicId} />;
  }
  if (scope === "course" && courseId) {
    return <RuneDrillLauncher scope="course" courseId={courseId} />;
  }

  const dueCount = await countDueRunes(supabase, dbUser.id);

  if (dueCount === 0) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto">
          <Gem className="w-8 h-8 text-purple-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            All runes dormant
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Nothing is due right now. Forge decks from your topic pages — or
            open any topic&apos;s deck to cram it ahead of schedule.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard">
            <Button className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 text-white font-medium gap-2">
              <Sparkles className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <RuneDrillLauncher scope="due" />;
}
