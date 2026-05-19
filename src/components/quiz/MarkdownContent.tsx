"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  children: string;
  className?: string;
}

/**
 * Renders quiz / boss-fight text (question content, correct answer, model
 * answer, explanation, feedback) as Markdown.
 *
 * Key behaviors:
 * - Fenced code blocks render as monospace `<pre>` blocks with preserved
 *   whitespace and forced LTR direction, so pseudocode reads correctly
 *   even when the surrounding container is `dir="rtl"` Hebrew.
 * - Inline `code` is also forced LTR so identifiers don't get reordered.
 * - Paragraphs / emphasis / lists keep the surrounding text direction.
 *
 * Why `unicodeBidi: isolate` on code: it tells the bidi algorithm to treat
 * the code as a self-contained LTR unit; without it, RTL letters around
 * the code can flip the order of identifiers like `lock(m)`.
 */
export default function MarkdownContent({ children, className }: MarkdownContentProps) {
  return (
    <div className={cn("markdown-quiz", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children: pChildren }) => (
            <p className="leading-relaxed my-2 first:mt-0 last:mb-0">{pChildren}</p>
          ),
          pre: ({ children: preChildren }) => (
            <pre
              dir="ltr"
              className="bg-slate-900/80 border border-white/[0.07] rounded-lg px-3 py-2.5 my-2.5 text-[13px] font-mono text-slate-200 overflow-x-auto whitespace-pre"
              style={{ unicodeBidi: "isolate" }}
            >
              {preChildren}
            </pre>
          ),
          // react-markdown v10: inline vs block code is differentiated by
          // whether the parent is a <pre> (handled above). Here we style
          // ONLY inline code; block code inherits the <pre> styling above.
          code: ({ className: codeCls, children: codeChildren, ...rest }) => {
            // A code element rendered outside a <pre> (i.e. inline `code`)
            // has no language className. Block code from ```lang …``` has
            // className="language-xxx" — those go through unchanged so
            // the <pre> wrapper provides the styling.
            const isBlock = typeof codeCls === "string" && codeCls.startsWith("language-");
            if (isBlock) {
              return <code className={codeCls} {...rest}>{codeChildren}</code>;
            }
            return (
              <code
                dir="ltr"
                className="font-mono text-[0.92em] bg-white/[0.07] border border-white/[0.06] rounded px-1 py-[1px] text-slate-100"
                style={{ unicodeBidi: "isolate" }}
              >
                {codeChildren}
              </code>
            );
          },
          ul: ({ children: ulChildren }) => (
            <ul className="list-disc ps-5 my-2 space-y-1">{ulChildren}</ul>
          ),
          ol: ({ children: olChildren }) => (
            <ol className="list-decimal ps-5 my-2 space-y-1">{olChildren}</ol>
          ),
          li: ({ children: liChildren }) => <li className="leading-relaxed">{liChildren}</li>,
          strong: ({ children: sChildren }) => (
            <strong className="font-semibold text-white">{sChildren}</strong>
          ),
          em: ({ children: eChildren }) => <em className="italic">{eChildren}</em>,
          // Block headings shouldn't appear in quiz content, but if they
          // do, render modest sizes (don't compete with the question's own h-tag).
          h1: ({ children: hChildren }) => (
            <p className="font-bold text-white my-2">{hChildren}</p>
          ),
          h2: ({ children: hChildren }) => (
            <p className="font-bold text-white my-2">{hChildren}</p>
          ),
          h3: ({ children: hChildren }) => (
            <p className="font-semibold text-white my-2">{hChildren}</p>
          ),

          // ─── Tables ───
          // Tabular data (process timing, comparisons, schedules) must read
          // LTR even when surrounded by Hebrew prose — columns are positional.
          // Wrap in a scroll container so wide tables don't blow up the layout.
          table: ({ children: tChildren }) => (
            <div dir="ltr" className="overflow-x-auto my-3 -mx-1">
              <table className="w-full border border-white/[0.08] rounded-md text-[13px] tabular-nums border-collapse">
                {tChildren}
              </table>
            </div>
          ),
          thead: ({ children: tChildren }) => (
            <thead className="bg-white/[0.04]">{tChildren}</thead>
          ),
          tbody: ({ children: tChildren }) => <tbody>{tChildren}</tbody>,
          tr: ({ children: tChildren }) => (
            <tr className="border-b border-white/[0.06] last:border-b-0">{tChildren}</tr>
          ),
          th: ({ children: tChildren }) => (
            <th
              dir="ltr"
              className="px-3 py-2 text-left font-semibold text-slate-200 border-r border-white/[0.06] last:border-r-0 whitespace-nowrap"
              style={{ unicodeBidi: "isolate" }}
            >
              {tChildren}
            </th>
          ),
          td: ({ children: tChildren }) => (
            <td
              dir="ltr"
              className="px-3 py-1.5 text-slate-300 border-r border-white/[0.06] last:border-r-0 align-top"
              style={{ unicodeBidi: "isolate" }}
            >
              {tChildren}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
