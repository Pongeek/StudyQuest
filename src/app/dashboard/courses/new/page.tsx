"use client";

import { useState } from "react";
import { Scroll, FilePlus2, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import CourseUploadForm from "@/components/course/CourseUploadForm";
import EmptyCourseForm from "@/components/course/EmptyCourseForm";

type Tab = "empty" | "pdf";

export default function NewCoursePage() {
  // Default to "empty" — the per-episode flow is the recommended pattern.
  // PDFs >100 pages are unreliable in the "from PDF" path.
  const [tab, setTab] = useState<Tab>("empty");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/[0.04] border border-white/[0.07] rounded-lg flex items-center justify-center">
            <Scroll className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Create New Course</h1>
        </div>
        <p className="text-slate-400 mt-1 text-sm">
          Two ways to start: build a course episode by episode (recommended for university courses),
          or upload one combined PDF and let the AI split it.
        </p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Course creation mode"
        className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl border border-white/[0.07] bg-white/[0.02]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "empty"}
          onClick={() => setTab("empty")}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
            tab === "empty"
              ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-300"
              : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
          )}
        >
          <FolderPlus className="w-4 h-4" />
          Empty course
          <span className="text-[10px] uppercase tracking-wider font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded">
            Recommended
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pdf"}
          onClick={() => setTab("pdf")}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
            tab === "pdf"
              ? "bg-indigo-500/15 border border-indigo-500/30 text-indigo-300"
              : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
          )}
        >
          <FilePlus2 className="w-4 h-4" />
          From single PDF
        </button>
      </div>

      {/* Tab description */}
      <p className="text-xs text-slate-500 mb-4 px-1">
        {tab === "empty"
          ? "Create the course now; add one PDF per chapter / episode afterward. Best for university courses where lectures arrive weekly."
          : "Upload one combined PDF (e.g. full lecture notes for the whole course). AI will try to split it into episodes — works best for PDFs under ~100 pages."}
      </p>

      <div className="rpg-card rounded-2xl p-5 sm:p-8">
        {tab === "empty" ? <EmptyCourseForm /> : <CourseUploadForm />}
      </div>
    </div>
  );
}
