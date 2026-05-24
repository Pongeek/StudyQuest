import { AlertTriangle, FileWarning } from "lucide-react";
import DeleteEpisodeButton from "@/components/course/DeleteEpisodeButton";

interface FailedEpisode {
  id: string;
  title: string;
  /** User-facing reason — set by classifyEpisodeError() in the catch
   *  handler of the upload route. Null = older row from before migration
   *  018; we show a generic fallback in that case. */
  errorMessage: string | null;
}

interface FailedEpisodesBannerProps {
  episodes: FailedEpisode[];
}

/**
 * Visible "failed extraction" surface for episodes with `status = "error"`.
 *
 * Companion to ProcessingEpisodesBanner — both pull problem episodes OUT
 * of the CourseMap (which would otherwise render them as broken empty
 * cards) and into a clear, actionable section above. This banner is
 * persistent — failed episodes stay on screen until the user deletes them.
 *
 * Each row shows:
 *   - The user's title (preserved through failure so re-upload is easy)
 *   - The user-facing reason from `episodes.error_message`
 *   - A delete button (uses the existing DeleteEpisodeButton "label" variant)
 *
 * Renders null when there are no failed episodes — zero cost on healthy pages.
 */
export default function FailedEpisodesBanner({
  episodes,
}: FailedEpisodesBannerProps) {
  if (episodes.length === 0) return null;

  const headline =
    episodes.length === 1
      ? "An episode couldn't be processed"
      : `${episodes.length} episodes couldn't be processed`;

  return (
    <section
      aria-labelledby="failed-episodes-heading"
      className="relative bg-slate-900/95 pixel-border text-red-500/80 px-5 py-5 sm:px-6 sm:py-6"
    >
      {/* Pixel nail corners — red, matches the failure state */}
      <span aria-hidden className="absolute top-1.5 left-1.5 w-1.5 h-1.5 bg-red-400 z-[2]" />
      <span aria-hidden className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 z-[2]" />
      <span aria-hidden className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 bg-red-400 z-[2]" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 z-[2]" />

      <div className="relative z-[1]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 pixel-border bg-red-500/15 text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="font-pixel text-[9px] tracking-wider text-red-300/90 mb-1">
              EXTRACTION FAILED
            </div>
            <h2
              id="failed-episodes-heading"
              className="text-base sm:text-lg font-bold text-white"
            >
              {headline}
            </h2>
          </div>
        </div>

        {/* Per-episode rows — each shows the user-facing reason + delete */}
        <ul className="space-y-2.5">
          {episodes.map((ep) => (
            <li
              key={ep.id}
              className="flex items-start gap-3 bg-slate-800/40 px-3.5 py-3"
            >
              <FileWarning
                className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5"
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-200 truncate">
                  {ep.title}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed mt-1">
                  {ep.errorMessage ??
                    "Something went wrong while extracting topics. Try a different or smaller PDF."}
                </p>
              </div>
              <div className="flex-shrink-0">
                <DeleteEpisodeButton
                  episodeId={ep.id}
                  episodeTitle={ep.title}
                  topicCount={0}
                  variant="label"
                  className="text-xs"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
