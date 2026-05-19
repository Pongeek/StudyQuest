export interface PDFExtractionResult {
  /** Full text with [PAGE N] markers for AI page-number mapping */
  textWithPageMarkers: string;
  /** Plain concatenated text (legacy, used for simple cases) */
  plainText: string;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Extract text from a PDF buffer, returning both plain text and
 * page-marked text for AI to map topics to source pages.
 */
export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const result = await extractPagesFromBuffer(buffer);
  return result.plainText;
}

export async function extractPagesFromBuffer(buffer: Buffer): Promise<PDFExtractionResult> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer));

  const pages: string[] = Array.isArray(result.text)
    ? result.text.map((p: any) => String(p))
    : [String(result.text || "")];

  const totalPages = result.totalPages || pages.length;

  // Build page-marked text: [PAGE 1] ... [PAGE 2] ...
  const textWithPageMarkers = pages
    .map((pageText, i) => `[PAGE ${i + 1}]\n${pageText}`)
    .join("\n\n");

  const plainText = pages.join("\n");

  return { textWithPageMarkers, plainText, totalPages };
}

export function chunkText(text: string, maxChunkSize = 40000): string[] {
  if (text.length <= maxChunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChunkSize;
    if (end < text.length) {
      const lastNewline = text.lastIndexOf("\n", end);
      if (lastNewline > start + maxChunkSize * 0.8) {
        end = lastNewline;
      }
    }
    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}
