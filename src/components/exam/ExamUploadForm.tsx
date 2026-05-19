"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExamUploadFormProps {
  courseId: string;
}

export default function ExamUploadForm({ courseId }: ExamUploadFormProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 50 * 1024 * 1024,
    maxFiles: 1,
  });

  const handleSubmit = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("courseId", courseId);
      formData.append("file", file);

      const res = await fetch("/api/exams/process", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server error — please try again");
      }

      if (!res.ok) {
        // Surface the specific server-side reason so the user knows what
        // to do. Most common: NO_TEXT_LAYER on scanned-image PDFs.
        const headline = data.error || "Failed to process exam";
        const detail = data.detail as string | undefined;
        if (detail) {
          toast.error(headline, { description: detail, duration: 10000 });
        } else {
          toast.error(headline);
        }
        return;
      }

      toast.success(`Extracted ${data.questionCount} questions from your exam!`);
      router.refresh();
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-150",
          isDragActive
            ? "border-indigo-500/50 bg-indigo-500/5"
            : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
        )}
      >
        <input {...getInputProps()} />
        <div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 bg-white/[0.04] border border-white/[0.07]">
            <Upload className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-white text-sm font-medium">
            {isDragActive ? "Drop your past exam here" : "Upload a past exam PDF"}
          </p>
          <p className="text-slate-500 text-xs mt-1">The AI will extract real exam questions</p>
        </div>
      </div>

      {file && (
        <div className="rpg-card rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/[0.04] border border-white/[0.07] rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isUploading}
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium gap-1.5 transition-colors duration-150"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Extract Questions
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
