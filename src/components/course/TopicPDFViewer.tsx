"use client";

import { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TopicPDFViewerProps {
  /** course_files.id — used to build the proxy URL */
  fileId: string;
  /** Fallback direct URL (not used currently but kept for future) */
  fileUrl: string;
  /** 1-indexed start page */
  pageStart: number;
  /** 1-indexed end page (inclusive) */
  pageEnd: number;
  /** Total pages in the PDF (for context) */
  totalPages?: number;
  /** File name for display */
  fileName?: string;
}

export default function TopicPDFViewer({
  fileId,
  fileUrl,
  pageStart,
  pageEnd,
  totalPages,
  fileName,
}: TopicPDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(pageStart);
  const [scale, setScale] = useState(1.0);
  const [expanded, setExpanded] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Use our proxy API which streams the PDF server-side,
  // bypassing Supabase Storage's issues with non-ASCII filenames
  const proxyUrl = `/api/files/${fileId}`;

  // Pre-check the proxy URL so we can show a specific error message
  useEffect(() => {
    let cancelled = false;
    fetch(proxyUrl, { method: "HEAD" }).then((res) => {
      if (!cancelled && !res.ok) {
        // Fetch the body to check for specific error codes
        fetch(proxyUrl).then((r) => r.json()).then((data) => {
          if (!cancelled && data?.code === "INVALID_KEY") {
            setErrorMessage("This course was uploaded before the file fix. Please delete and re-upload the course to view study materials.");
            setError(true);
            setLoading(false);
          }
        }).catch(() => {});
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [proxyUrl]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error("PDF load error:", err);
    setError(true);
    setLoading(false);
  }, []);

  const goToPrevPage = () => setCurrentPage((p) => Math.max(pageStart, p - 1));
  const goToNextPage = () => setCurrentPage((p) => Math.min(pageEnd, p + 1));
  const zoomIn = () => setScale((s) => Math.min(2.0, s + 0.2));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.2));

  const pageCount = pageEnd - pageStart + 1;
  const currentRelative = currentPage - pageStart + 1;

  if (error) {
    return (
      <div className="rpg-card rounded-2xl p-6 text-center">
        <FileText className="w-8 h-8 text-slate-500 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">
          {errorMessage || "Could not load PDF. The file may have been moved."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rpg-card rounded-2xl overflow-hidden transition-all duration-300",
        expanded && "fixed inset-4 z-50 shadow-2xl shadow-black/50"
      )}
    >
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30 bg-slate-900/80">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-white truncate">
            Study Material
          </span>
          {fileName && (
            <span className="text-xs text-slate-500 truncate hidden sm:inline">
              — {fileName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs text-slate-500 w-10 text-center font-mono">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 2.0}
            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>

          <div className="w-px h-4 bg-slate-700/50 mx-1" />

          {/* Expand toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-white/10"
          >
            {expanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* PDF content */}
      <div
        className={cn(
          "overflow-auto bg-slate-800/30 flex justify-center",
          expanded ? "h-[calc(100%-88px)]" : "max-h-[600px]"
        )}
      >
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
        )}

        <Document
          file={proxyUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="py-4"
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            className="shadow-lg shadow-black/30 mx-auto"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {/* Page navigation footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700/30 bg-slate-900/80">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPrevPage}
          disabled={currentPage <= pageStart}
          className="h-8 px-3 text-slate-400 hover:text-white hover:bg-white/10 gap-1"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Prev</span>
        </Button>

        <div className="text-center">
          <span className="text-sm font-bold text-white">
            {currentRelative} / {pageCount}
          </span>
          <span className="text-xs text-slate-500 ml-2">
            (page {currentPage}{totalPages ? ` of ${totalPages}` : ""})
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextPage}
          disabled={currentPage >= pageEnd}
          className="h-8 px-3 text-slate-400 hover:text-white hover:bg-white/10 gap-1"
        >
          <span className="hidden sm:inline text-xs">Next</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Expanded overlay backdrop */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/60 -z-10"
          onClick={() => setExpanded(false)}
        />
      )}
    </div>
  );
}
