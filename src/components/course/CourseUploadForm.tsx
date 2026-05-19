"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UploadedFile {
  file: File;
  type: "lecture" | "notes" | "past_exam";
}

type OutputLanguage = "auto" | "en" | "he";

export default function CourseUploadForm() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  // Output language for AI-generated content (topics, quizzes, debriefs,
  // scrolls). 'auto' matches the source PDF's language — current behavior
  // and the safe default. Choosing 'en' or 'he' explicitly forces that
  // language regardless of the source.
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>("auto");
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles = accepted.map((f) => ({ file: f, type: "lecture" as const }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 50 * 1024 * 1024,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFileType = (index: number, type: UploadedFile["type"]) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, type } : f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error("Please upload at least one PDF file");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", courseTitle || files[0].file.name.replace(".pdf", ""));
      files.forEach(({ file, type }, i) => {
        formData.append(`file_${i}`, file);
        formData.append(`type_${i}`, type);
      });
      formData.append("fileCount", String(files.length));
      formData.append("outputLanguage", outputLanguage);

      const response = await fetch("/api/courses", {
        method: "POST",
        body: formData,
      });

      const text = await response.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server error — please try again or use a smaller file");
      }

      if (!response.ok) {
        throw new Error((data.error as string) || "Failed to create course");
      }

      const courseId = data.courseId as string;
      toast.success("Course created! AI is analyzing your material...");
      router.push(`/dashboard/courses/${courseId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title" className="text-slate-300">
          Course Title (optional)
        </Label>
        <Input
          id="title"
          value={courseTitle}
          onChange={(e) => setCourseTitle(e.target.value)}
          placeholder="e.g. Data Structures & Algorithms"
          className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50"
        />
        <p className="text-xs text-slate-600">Leave blank to use the file name</p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all duration-300 overflow-hidden",
          isDragActive
            ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
            : "border-slate-700/50 hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:shadow-lg hover:shadow-indigo-500/5"
        )}
      >
        <input {...getInputProps()} />
        {isDragActive && <div className="absolute inset-0 bg-grid opacity-30" />}
        <div className="relative z-10">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 transition-all duration-150 border",
            isDragActive
              ? "bg-indigo-500 border-indigo-400"
              : "bg-white/[0.04] border-white/[0.07]"
          )}>
            <Upload className={cn("w-5 h-5 transition-colors", isDragActive ? "text-white" : "text-indigo-400")} />
          </div>
          <p className="text-white font-bold">
            {isDragActive ? "Drop your PDFs here" : "Drag & drop PDFs here"}
          </p>
          <p className="text-slate-400 text-sm mt-1">or click to browse — max 50MB per file</p>
          <p className="text-slate-600 text-xs mt-3">
            You can upload lecture notes, textbooks, slides, or past exam papers
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3">
          <Label className="text-slate-400 text-xs font-bold uppercase tracking-wider">
            Uploaded Files ({files.length})
          </Label>
          {files.map(({ file, type }, i) => (
            <div
              key={i}
              className="rpg-card rounded-xl p-4 flex items-center gap-4"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/[0.04] border border-white/[0.07] rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <select
                value={type}
                onChange={(e) => updateFileType(i, e.target.value as UploadedFile["type"])}
                className="bg-slate-800/80 border border-slate-700/50 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 hidden sm:block"
              >
                <option value="lecture">Lecture / Notes</option>
                <option value="past_exam">Past Exam</option>
              </select>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-slate-600 hover:text-red-400 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Output language picker — controls the language the AI will use
          when generating topics, quiz questions, debriefs, and daily scrolls.
          Default 'auto' = match the source PDF (current behavior). Set
          explicitly to translate the experience even when the source is
          in a different language. */}
      <div className="space-y-2">
        <Label htmlFor="outputLanguage" className="text-slate-300">
          Course language
        </Label>
        <select
          id="outputLanguage"
          value={outputLanguage}
          onChange={(e) => setOutputLanguage(e.target.value as OutputLanguage)}
          className="w-full bg-slate-800/50 border border-slate-700/50 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
        >
          <option value="auto">Auto — match the PDF&apos;s language</option>
          <option value="en">English</option>
          <option value="he">עברית (Hebrew)</option>
        </select>
        <p className="text-xs text-slate-600">
          AI-generated content (topics, quizzes, debriefs) will be written in this language.
          Pick &quot;Auto&quot; to match the source PDF.
        </p>
      </div>

      <Button
        type="submit"
        disabled={isUploading || files.length === 0}
        className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-6 text-base transition-all duration-150 gap-2"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating your quest...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            Create Course &amp; Start AI Analysis
          </>
        )}
      </Button>
    </form>
  );
}
