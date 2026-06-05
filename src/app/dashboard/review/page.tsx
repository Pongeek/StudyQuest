import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles } from "lucide-react";
import ReviewLauncher from "@/components/review/ReviewLauncher";
import { getDueReviewTopics } from "@/lib/review-queue";

async function getReviewQueue(userId: string) {
  const supabase = createServiceClient();
  const { data: dueMasteries } = await getDueReviewTopics(supabase, userId);
  return dueMasteries ?? [];
}

export default async function ReviewPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, total_xp, current_streak")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) redirect("/sign-in");

  const queue = await getReviewQueue(dbUser.id);

  if (queue.length === 0) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto">
          <BookOpen className="w-8 h-8 text-cyan-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            All caught up!
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            You have no topics due for review. Take a new quiz to add topics to your review schedule.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard">
            <Button className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium gap-2">
              <Sparkles className="w-4 h-4" />
              Browse Courses
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" className="w-full sm:w-auto border-slate-700/50 text-slate-300 hover:bg-white/5">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ReviewLauncher
      userTotalXp={dbUser.total_xp || 0}
      userStreak={dbUser.current_streak || 0}
    />
  );
}
