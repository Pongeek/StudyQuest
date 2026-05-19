import { Scroll } from "lucide-react";
import CourseUploadForm from "@/components/course/CourseUploadForm";

export default function NewCoursePage() {
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
          Upload one or more PDFs — lecture notes, textbook chapters, or slides. AI will analyze
          everything and build your study journey.
        </p>
      </div>
      <div className="rpg-card rounded-2xl p-5 sm:p-8">
        <CourseUploadForm />
      </div>
    </div>
  );
}
