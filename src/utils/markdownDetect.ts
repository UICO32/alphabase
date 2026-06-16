/**
 * Heuristic detection of Markdown content on the clipboard.
 *
 * Used by the card editor's paste handler: when the clipboard has no HTML and
 * the plain text looks like Markdown, we convert it to rich text via
 * `editor.pasteMarkdown` instead of pasting it literally. Shift+Cmd/Ctrl+V
 * bypasses this (plain-text paste).
 */

// Patterns that are strong Markdown signals. Each is anchored to a line start
// where it makes sense. A single hit is enough to treat the text as Markdown.
const MARKDOWN_PATTERNS: RegExp[] = [
  /^#{1,6}\s+\S/m,                          // ATX headings: # / ## ... up to ######
  /^\s{0,3}>\s+\S/m,                        // blockquote
  /^\s*[-+*]\s+\S/m,                        // unordered list
  /^\s*\d+\.\s+\S/m,                        // ordered list
  /^\s*[-+*]\s+\[[ xX]\]\s+\S/m,            // task list
  /!\[[^\]]*\]\([^)]+\)/m,                  // image
  /\[[^\]]+\]\([^)]+\)/m,                   // link
  /```/m,                                   // fenced code block
  /^\s{4}\S/m,                              // indented code block
  /^\s*.{1,}\n[-=]{3,}\s*$/m,               // setext heading (=== / ---)
  /\*\*[^*]+\*\*/,                          // bold
  /__[^_]+__/,                              // bold (underscore)
  /`[^`]+`/,                                // inline code
]

export function isMarkdown(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  if (!text.trim()) return false
  return MARKDOWN_PATTERNS.some((re) => re.test(text))
}
