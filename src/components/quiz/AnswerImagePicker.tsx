"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnswerImagePickerProps {
  /** Currently-selected image file (controlled by parent) */
  image: File | null;
  /** Parent setter — receives the selected File or null to clear */
  onChange: (file: File | null) => void;
  /** Disable the picker (e.g. while grading is in flight) */
  disabled?: boolean;
  /** Force a direction on the label/button labels (for RTL questions) */
  dir?: "ltr" | "rtl";
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = "image/jpeg,image/jpg,image/png,image/webp";

/**
 * Compact "📎 attach diagram" control shown under open-answer textareas.
 *
 * Lets the student upload one image (max 5MB) of a hand-drawn diagram,
 * derivation, automaton, parse tree, etc. — Claude vision grades it.
 *
 * Pure presentation: parent owns the File state. We just handle file
 * picking, preview thumbnail, validation, and the remove button.
 */
export default function AnswerImagePicker({
  image,
  onChange,
  disabled,
  dir = "ltr",
}: AnswerImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Build / tear down a local object URL for the thumbnail preview
  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const isRTL = dir === "rtl";

  const handleFile = (file: File | null) => {
    if (!file) {
      onChange(null);
      setError(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — max 5 MB. Compress and retry.`
      );
      return;
    }
    setError(null);
    onChange(file);
  };

  // ── Selected state: thumbnail + remove button ────────────────────────────
  if (image) {
    return (
      <div
        className="inline-flex items-center gap-2.5 rounded-lg border border-indigo-500/30 bg-indigo-500/5 px-2.5 py-2"
        dir={dir}
      >
        {previewUrl ? (
          // Local object-URL preview — fine to use <img>, no Next/Image needed
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Attached diagram preview"
            className="h-10 w-10 rounded object-cover border border-white/[0.08]"
          />
        ) : (
          <div className="h-10 w-10 rounded bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-indigo-400" />
          </div>
        )}
        <div className="min-w-0 max-w-[200px] sm:max-w-[280px]">
          <p className="text-xs text-slate-200 font-medium truncate">{image.name}</p>
          <p className="text-[11px] text-slate-500">
            {(image.size / 1024).toFixed(0)} KB
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleFile(null)}
          disabled={disabled}
          className="text-slate-500 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
          aria-label="Remove attached image"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ── Empty state: attach button ───────────────────────────────────────────
  return (
    <div className="inline-flex flex-col items-start gap-1" dir={dir}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700/50 bg-white/[0.02] hover:bg-white/[0.04] hover:border-indigo-500/30 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50",
        )}
      >
        <Paperclip className="w-3.5 h-3.5" />
        {isRTL ? "צרף שרטוט / תמונה" : "Attach diagram or photo"}
      </button>
      <p className="text-[11px] text-slate-600">
        {isRTL
          ? "JPG / PNG / WebP · עד 5MB"
          : "JPG / PNG / WebP · up to 5MB"}
      </p>
      {error && (
        <p className="text-[11px] text-red-400" role="alert">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
