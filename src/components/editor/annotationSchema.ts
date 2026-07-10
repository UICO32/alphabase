import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core'

/**
 * 文本注释节点的最小 BlockNote schema。
 *
 * 刻意只保留 `paragraph` 块 + 默认内联（粗体/斜体/链接），
 * 不挂 imageRow / cardReference / tag —— 注释以短文本标注为主，
 * 保持轻量，并避免与卡片内容混淆。
 *
 * 粗体/斜体/链接走键盘快捷键（Ctrl+B / Ctrl+I / Ctrl+K）。
 */
export const annotationSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
  },
})
