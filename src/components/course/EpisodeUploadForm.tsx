"use client";

import { useState, useCallback, useMemo } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Upload, X, FileText, Loader2, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  validatePdfSize,
  UPLOAD_BLOCK_MB,
  type UploadValidationResult,
} from "@/lib/upload-validation";

interface EpisodeUploadFormProps {
  courseId: string;
}

const MAX_FILES = 3;

/**
 * Inline / modal-ish episode uploader shown on the course detail page.
 *
 * The user picks up to 3 PDFs (chapter + notes + slides for the same
 * episode), optionally types an episode title, and submits. The AI
 * extracts topics + description for THIS one episode only.
 */
export default function EpisodeUploadForm({ courseId }: EpisodeUploadFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setFiles((prev) => {
        const combined = [...prev, ...accepted];
        if (combined.length > MAX_FILES) {
          toast.error(`Max ${MAX_FILES} PDFs per episode.`);
        }
        return combined.slice(0, MAX_FILES);
      });
    },
    []
  );

  // Dropzone surfaces oversize files in `fileRejections` instead of `onDrop`.
  // Tell the user WHICH file was rejected and why, so the failure feels like
  // a normal validation error instead of a silent no-op.
  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    for (const rej of rejections) {
      const reason = rej.errors[0];
      if (reason?.code === "file-too-large") {
        const sizeMb = Math.round((rej.file.size / 1024 / 1024) * 10) / 10;
        toast.error(
          `${rej.file.name} is ${sizeMb} MB — over the ${UPLOAD_BLOCK_MB} MB limit. Split into smaller chapters and try again.`,
          { duration: 7000 },
        );
      } else if (reason?.code === "file-invalid-type") {
        toast.error(`${rej.file.name} isn't a PDF.`);
      } else {
        toast.error(`${rej.file.name} couldn't be added: ${reason?.message ?? "unknown reason"}`);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { "application/pdf": [".pdf"] },
    maxSize: UPLOAD_BLOCK_MB * 1024 * 1024,
    multiple: true,
  });

  // Per-file validation. Memoized off the files array so re-renders don't
  // recompute on every keystroke in the title field.
  const fileValidations: UploadValidationResult[] = useMemo(
    () => files.map((f) => validatePdfSize(f)),
    [files],
  );
  const hasErrorFile = fileValidations.some((v) => v.tier === "error");

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error("Pick at least one PDF first");
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      if (title.trim()) formData.append("title", title.trim());
      formData.append("fileCount", String(files.length));
      files.forEach((file, i) => {
        formData.append(`file_${i}`, file);
      });

      const res = await fetch(`/api/courses/${courseId}/episodes`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Upload failed");
      }
      toast.success("Episode uploading — AI is extracting topics…");
      setFiles([]);
      setTitle("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  // ── Trigger button ───────────────────────────────────────────────────────
  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-indigo-500 hover:bg-indigo-400 text-white gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Episode
      </Button>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="rpg-card rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Add an episode</h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setFiles([]);
            setTitle("");
          }}
          className="text-slate-500 hover:text-slate-300"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Optional title */}
      <div className="space-y-2">
        <Label htmlFor="ep-title" className="text-slate-300">
          Episode title <span className="text-slate-600">(optional)</span>
        </Label>
        <Input
          id="ep-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Chapter 1: Finite Automata"
          className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-600 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50"
        />
        <p className="text-xs text-slate-600">
          Leave blank to let the AI infer the title from the PDF.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-xl p-5 sm:p-7 text-center cursor-pointer transition-all duration-200",
          isDragActive
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-slate-700/50 hover:border-indigo-500/40 hover:bg-indigo-500/5"
        )}
      >
        <input {...getInputProps()} />
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 border",
          isDragActive
            ? "bg-indigo-500 border-indigo-400"
            : "bg-white/[0.04] border-white/[0.07]"
        )}>
          <Upload className={cn("w-4 h-4", isDragActive ? "text-white" : "text-indigo-400")} />
        </div>
        <p className="text-sm text-white font-bold">
          {isDragActive ? "Drop your PDFs here" : "Drop PDFs or click to browse"}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Up to {MAX_FILES} PDFs per episode · max {UPLOAD_BLOCK_MB}MB each
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => {
            const v = fileValidations[i];
            return (
              <div
                key={i}
                className={cn(
                  "rounded-lg border px-3 py-2 flex items-center gap-3",
                  v.tier === "error"
                    ? "border-red-500/30 bg-red-500/[0.04]"
                    : v.tier === "warn"
                      ? "border-amber-500/30 bg-amber-500/[0.04]"
                      : "border-white/[0.07] bg-white/[0.02]",
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 border rounded-md flex items-center justify-center flex-shrink-0",
                    v.tier === "error"
                      ? "bg-red-500/10 border-red-500/30"
                      : v.tier === "warn"
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-white/[0.04] border-white/[0.07]",
                  )}
                >
                  {v.tier === "ok" ? (
                    <FileText className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <AlertTriangle
                      className={cn(
                        "w-4 h-4",
                        v.tier === "error" ? "text-red-400" : "text-amber-400",
                      )}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{file.name}</p>
                  <p
                    className={cn(
                      "text-[11px]",
                      v.tier === "error"
                        ? "text-red-400"
                        : v.tier === "warn"
                          ? "text-amber-400"
                          : "text-slate-500",
                    )}
                  >
                    {v.sizeMb} MB{v.message ? ` · ${v.message}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="text-slate-600 hover:text-red-400 transition-colors p-1"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={busy || files.length === 0 || hasErrorFile}
        className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium gap-2"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Add episode
          </>
        )}
      </Button>
    </form>
  );
}
