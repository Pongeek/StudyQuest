"use client";

import dynamic from "next/dynamic";

/**
 * Client-only wrapper for `TopicPDFViewer`.
 *
 * The underlying viewer uses `react-pdf` → pdf.js, which references browser
 * APIs (`DOMMatrix`, `Worker`, etc.) at module-evaluation time. Importing
 * it from a Server Component crashes SSR with "DOMMatrix is not defined".
 *
 * `next/dynamic` with `ssr: false` defers loading until the browser, so the
 * pdf.js module never gets evaluated on the server.
 */
const TopicPDFViewer = dynamic(() => import("./TopicPDFViewer"), {
  ssr: false,
  loading: () => (
    <div className="rpg-card rounded-xl p-8 text-center text-slate-500">
      Loading PDF viewer…
    </div>
  ),
});

export default TopicPDFViewer;
