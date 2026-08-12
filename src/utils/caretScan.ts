// 在文本 DOM 中查找距离点击坐标最近的字符边界，返回累计文本偏移。
//
// 用于"点击卡片 → 光标落到点击处"的光标定位（preview 层与编辑器层共用）。
// 性能策略（不改变定位结果）：
//  1) 行级粗筛：跳过与点击点垂直距离超过自身行高的文本节点；
//  2) 提前终止：score 超出当前最优且超过行宽量级（y 权重 10000 主导）时，
//     该节点剩余字符（换行后只会更远）直接跳过。
// 注：提前终止假设文档流内文本按 y 单调排列（多栏/浮动布局下可能退化，
// 但卡片内容为 BlockNote 生成的普通块级文档流，成立）。

const CARET_SCORE_ESCALATION = 4000

type DocumentWithCaretApis = Document & {
  caretPositionFromPoint?: (x: number, y: number) => {
    offsetNode: Node
    offset: number
  } | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

/**
 * 使用浏览器原生命中测试获取点击处的累计文本偏移。
 * 这里只遍历文本节点，不读取布局；适合在 pointer 事件中同步执行。
 */
export function getNativeTextOffsetAtPoint(
  root: HTMLElement,
  x: number,
  y: number,
): number | undefined {
  const doc = root.ownerDocument as DocumentWithCaretApis
  const position = doc.caretPositionFromPoint?.(x, y)
  const range = position ? null : doc.caretRangeFromPoint?.(x, y)
  const offsetNode = position?.offsetNode ?? range?.startContainer
  const offset = position?.offset ?? range?.startOffset

  if (!offsetNode || offset == null || offsetNode.nodeType !== Node.TEXT_NODE || !root.contains(offsetNode)) {
    return undefined
  }

  let consumedText = 0
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let textNode: Text | null
  while ((textNode = walker.nextNode() as Text | null)) {
    const len = textNode.textContent?.length ?? 0
    if (textNode === offsetNode) return consumedText + Math.min(offset, len)
    consumedText += len
  }

  return undefined
}

export function findTextOffsetAtPoint(
  root: HTMLElement,
  x: number,
  y: number,
): number | undefined {
  let consumedText = 0
  let bestOffset: number | undefined
  let bestScore = Infinity
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let textNode: Text | null

  while ((textNode = walker.nextNode() as Text | null)) {
    const parent = textNode.parentElement
    if (!parent) continue
    const parentRect = parent.getBoundingClientRect()
    const len = textNode.textContent?.length ?? 0
    // 行级粗筛：跳过与点击点垂直距离超过自身行高的文本节点，
    // 避免对所有段落的每个字符做 range 度量。
    if (parentRect.height > 0
      && (y < parentRect.top - parentRect.height || y > parentRect.bottom + parentRect.height)) {
      consumedText += len
      continue
    }
    const range = document.createRange()
    for (let offset = 0; offset <= len; offset += 1) {
      const charStart = offset === 0 ? 0 : offset - 1
      const charEnd = offset === 0 ? Math.min(1, len) : offset
      range.setStart(textNode, charStart)
      range.setEnd(textNode, charEnd)
      const charRect = range.getClientRects()[0] ?? range.getBoundingClientRect()
      const boundaryX = offset === 0 ? charRect.left : charRect.right
      const boundaryY = charRect.height > 0
        ? (charRect.top + charRect.bottom) / 2
        : (parentRect.top + parentRect.bottom) / 2
      const score = Math.abs(y - boundaryY) * 10_000 + Math.abs(x - boundaryX)
      if (score < bestScore) {
        bestScore = score
        bestOffset = consumedText + offset
      } else if (score - bestScore > CARET_SCORE_ESCALATION) {
        // 已越过最近行：剩余字符只会更远，跳过本节点剩余部分
        break
      }
    }
    consumedText += len
  }

  return bestOffset
}
