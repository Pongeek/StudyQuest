import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/users/complete-onboarding
 *
 * Marks the current user's first-run Welcome Modal as completed by
 * stamping `users.onboarding_completed_at = NOW()`. Idempotent — the
 * modal won't re-fire even if this is called multiple times.
 *
 * The flag is per-user (server-side) rather than per-browser
 * (localStorage) so the modal doesn't re-appear when the user signs in
 * from a new device.
 *
 * Authorization: must be signed in via Clerk. No further checks
 * needed — a user can only mark *their own* onboarding complete (filter
 * is on `clerk_id`).
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("users")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("clerk_id", userId);

  if (error) {
    console.error("[api/users/complete-onboarding] update failed:", error);
    return NextResponse.json(
      { error: "Failed to mark onboarding complete" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
