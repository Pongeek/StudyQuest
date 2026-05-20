"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type OutputLanguage = "auto" | "en" | "he";

/**
 * Creates an EMPTY course — name + optional subject + output language.
 * No PDF upload here; the user adds episodes (one per chapter PDF) on
 * the course page afterward.
 *
 * This is the right flow for university-style courses where you have
 * weekly chapter PDFs rather than one big textbook upload.
 */
export default function EmptyCourseForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>("auto");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Course title is required");
      return;
    }
    setBusy(true);
    try {
      // POST to /api/courses with mode=empty (no PDFs).
      // The route creates a course row with status='ready' and no episodes.
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("subject", subject.trim());
      formData.append("outputLanguage", outputLanguage);
      formData.append("mode", "empty");
      formData.append("fileCount", "0");

      const res = await fetch("/api/courses", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data?.error as string) || "Failed to create course");
      }
      const courseId = data.courseId as string;
      toast.success("Course created — add your first episode!");
      router.push(`/dashboard/courses/${courseId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="empty-course-title" className="text-slate-300">
          Course title
        </Label>
        <Input
          id="empty-course-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Computational Models, Operating Systems"
          required
          className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="empty-course-subject" className="text-slate-300">
          Subject <span className="text-slate-600">(optional)</span>
        </Label>
        <Input
          id="empty-course-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Computer Science, Mathematics"
          className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50"
        />
        <p className="text-xs text-slate-600">
          Helps the AI generate questions in the right academic style.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="empty-course-language" className="text-slate-300">
          Course language
        </Label>
        <select
          id="empty-course-language"
          value={outputLanguage}
          onChange={(e) => setOutputLanguage(e.target.value as OutputLanguage)}
          className="w-full bg-slate-800/50 border border-slate-700/50 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
        >
          <option value="auto">Auto — match each episode&apos;s PDF</option>
          <option value="en">English</option>
          <option value="he">עברית (Hebrew)</option>
        </select>
        <p className="text-xs text-slate-600">
          AI-generated content (topics, quizzes, debriefs) will use this language across all episodes.
        </p>
      </div>

      <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/5 p-3.5 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          The course is created instantly — empty. After clicking Create, you&apos;ll land on the
          course page where you can <span className="text-indigo-300 font-medium">Add Episodes</span>{" "}
          one PDF at a time. Each episode gets its own topics + boss fight.
        </p>
      </div>

      <Button
        type="submit"
        disabled={busy || !title.trim()}
        className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-6 text-base gap-2"
      >
        {busy ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating…
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            Create Empty Course
          </>
        )}
      </Button>
    </form>
  );
}
