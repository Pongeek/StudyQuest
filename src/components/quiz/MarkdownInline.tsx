"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";

interface MarkdownInlineProps {
  children: string;
  className?: string;
}

/**
 * Renders quiz option text (MCQ choices) with Markdown + math support.
 *
 * Unlike MarkdownContent, every element here is phrasing content (span,
 * strong, em, code) so this component is safe to nest inside <button>
 * elements without producing invalid HTML.
 *
 * Block-level nodes (paragraphs) are remapped to <span> so the output
 * stays inline-safe. KaTeX inline math ($...$) is already phrasing content.
 */
export default function MarkdownInline({ children, className }: MarkdownInlineProps) {
  return (
    <span className={cn("inline leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Map block-level containers to <span> so they're valid inside <button>
          p: ({ children: pChildren }) => <span>{pChildren}</span>,
          // Preserve basic inline formatting
          strong: ({ children: sChildren }) => (
            <strong className="font-semibold">{sChildren}</strong>
          ),
          em: ({ children: eChildren }) => <em className="italic">{eChildren}</em>,
          code: ({ children: codeChildren }) => (
            <code
              dir="ltr"
              className="font-mono text-[0.92em]"
              style={{ unicodeBidi: "isolate" }}
            >
              {codeChildren}
            </code>
          ),
          // Block code fences shouldn't appear in option text, but if they do
          // render them as a plain monospace span rather than a <pre> block.
          pre: ({ children: preChildren }) => (
            <span
              dir="ltr"
              className="font-mono text-[0.92em]"
              style={{ unicodeBidi: "isolate" }}
            >
              {preChildren}
            </span>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}
