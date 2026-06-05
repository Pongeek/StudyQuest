/**
 * Pure lifetime study-time aggregation. Summing `completed_at - started_at`
 * over sessions is noisy: a learner who starts a quiz and walks away for an hour
 * before finishing would report 60 minutes of "study". So each session's counted
 * duration is capped, making the total a reasonable lower bound rather than an
 * inflated lie. See CONTEXT.md and issue #22.
 */

export interface StudySessionTimes {
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Total study minutes across sessions, each session capped at `capMinutes`.
 * Sessions missing either timestamp are skipped; non-positive durations
 * (e.g. completed before started) count as zero. Result is floored.
 */
export function sumCappedStudyMinutes(
  sessions: StudySessionTimes[],
  capMinutes: number
): number {
  let totalMs = 0;
  const capMs = capMinutes * 60_000;

  for (const s of sessions) {
    if (!s.started_at || !s.completed_at) continue;
    const ms = new Date(s.completed_at).getTime() - new Date(s.started_at).getTime();
    if (ms <= 0) continue;
    totalMs += Math.min(ms, capMs);
  }

  return Math.floor(totalMs / 60_000);
}
