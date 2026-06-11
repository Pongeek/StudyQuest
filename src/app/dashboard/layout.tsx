import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import DashboardNav from "@/components/dashboard/DashboardNav";
import DashboardAnimations from "@/components/dashboard/DashboardAnimations";
import ScrollOfWisdom from "@/components/scroll/ScrollOfWisdom";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("total_xp, current_streak")
    .eq("clerk_id", userId)
    .single();

  return (
    <div className="min-h-screen bg-slate-950 text-white relative">
      {/* Pixel-grid floor + CRT scanlines + soft corner vignette. Same recipe
          as the landing page so the authed app feels like one continuous
          arcade screen. */}
      <div className="fixed inset-0 pixel-grid opacity-70 pointer-events-none" />
      <div className="fixed inset-0 pixel-scanlines opacity-60 pointer-events-none" />
      {/* Ambient light pool — gives the page a top light source so panels
          below can read as lit surfaces (see .widget-elev). */}
      <div className="fixed inset-0 dash-ambient pointer-events-none" />
      <div className="fixed inset-0 pixel-vignette pointer-events-none" />
      {/* Aurora orbs — four slow-drifting gradient blobs; replaces the old
          static corner blobs + canvas particle layer. */}
      <DashboardAnimations />
      {/* Daily Scroll of Wisdom — client component, self-fetches, shows once per day */}
      <ScrollOfWisdom />
      <div className="relative z-10">
        <DashboardNav totalXp={dbUser?.total_xp || 0} streak={dbUser?.current_streak || 0} />
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
