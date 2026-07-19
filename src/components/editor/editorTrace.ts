type TraceDetails = Record<string, unknown>

const traceStarts = new Map<string, number>()
let traceSequence = 0

function rectSnapshot(element: Element | null) {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return {
    x: Number(rect.x.toFixed(2)),
    y: Number(rect.y.toFixed(2)),
    width: Number(rect.width.toFixed(2)),
    height: Number(rect.height.toFixed(2)),
  }
}

function styleSnapshot(element: Element | null) {
  if (!(element instanceof HTMLElement)) return null
  const style = window.getComputedStyle(element)
  return {
    opacity: style.opacity,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
  }
}

export function editorElementSnapshot(root: HTMLElement | null) {
  const preview = root?.querySelector<HTMLElement>('.card-editor-entry__preview') ?? null
  const editor = root?.querySelector<HTMLElement>('.card-editor-entry__editor') ?? null
  const proseMirror = root?.querySelector<HTMLElement>('.ProseMirror') ?? null
  const previewText = preview?.querySelector<HTMLElement>('.bn-inline-content') ?? preview
  const editorText = proseMirror?.querySelector<HTMLElement>('.bn-inline-content') ?? proseMirror

  return {
    rootRect: rectSnapshot(root),
    previewPresent: preview !== null,
    previewRect: rectSnapshot(preview),
    previewStyle: styleSnapshot(preview),
    editorPresent: editor !== null,
    editorRect: rectSnapshot(editor),
    editorStyle: styleSnapshot(editor),
    proseMirrorPresent: proseMirror !== null,
    proseMirrorRect: rectSnapshot(proseMirror),
    proseMirrorStyle: styleSnapshot(proseMirror),
    firstTextRects: {
      preview: rectSnapshot(previewText),
      editor: rectSnapshot(editorText),
    },
  }
}

export function editorTrace(label: string | undefined, event: string, details: TraceDetails = {}) {
  if (!label) return
  const now = performance.now()
  if (event === 'dialog-mounted' || !traceStarts.has(label)) traceStarts.set(label, now)
  const startedAt = traceStarts.get(label) ?? now
  const payload = {
    sequence: ++traceSequence,
    elapsedMs: Number((now - startedAt).toFixed(2)),
    nowMs: Number(now.toFixed(2)),
    label,
    event,
    ...details,
  }
  console.info('[card-dialog-trace]', JSON.stringify(payload))
}
