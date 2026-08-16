import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Plus,
  Star,
  X,
} from 'lucide-react'
import { useBoardStore } from '../../stores/boardStore'
import { useProjectStore, DEFAULT_PROJECT_QUESTIONS } from '../../stores/projectStore'
import { useCardStore } from '../../stores/cardStore'
import { useBoardActions } from '../../hooks/useBoardActions'
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout'
import { emit } from '../../stores/eventBus'
import { topicDropState } from './topicDropState'

/** 左侧面板宽度（与 App.tsx LEFT_PANEL_WIDTH 对齐） */
const LEFT_PANEL_WIDTH = 260

/** 从 BlockNote JSON content 提取纯文本（成果 tile 正文，跳过 heading 标题） */
function extractText(content: string | undefined): string {
  if (!content) return ''
  try {
    const texts: string[] = []
    const walk = (nodes: unknown) => {
      if (!Array.isArray(nodes)) return
      for (const n of nodes as Array<Record<string, unknown>>) {
        if (n && typeof n === 'object') {
          if (n.type === 'heading') continue
          if (typeof n.text === 'string') texts.push(n.text)
          walk(n.content)
        }
      }
    }
    walk(JSON.parse(content))
    return texts.join(' ').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

/**
 * 顶部主题栏（画布区域顶部，融入界面、无浮层感）：
 * - 普通画布：常驻条右侧「＋ 新增主题」，展开面板为问题词表单
 * - 主题画布：常驻条 = 问题 chips 并排（浅色底、单击切换、双击编辑、hover 删除、末尾 ＋ 添加），右侧 ★N + 展开
 * - 展开面板：当前问题的成果横排（无描边窄卡），点击定位不关闭面板
 */
export function TopicBar() {
  const boards = useBoardStore((s) => s.boards)
  const activeBoardId = useBoardStore((s) => s.activeBoardId)
  const boardData = useBoardStore((s) => s.boardData)
  const projects = useProjectStore((s) => s.projects)
  const cards = useCardStore((s) => s.cards)
  const { leftOpen, mode } = useWorkspaceLayout()
  const { convertBoardToProject } = useBoardActions()

  // 悬浮胶囊落在画布区域左上（左面板打开时让出；narrow 抽屉为覆盖式，不让）
  const sideLeft = mode !== 'narrow' && leftOpen ? LEFT_PANEL_WIDTH : 0

  const activeBoard = boards.find((b) => b.id === activeBoardId)
  const project = activeBoardId ? projects[activeBoardId] : undefined
  const isTopic = !!activeBoard?.isProject && !!project

  const [expanded, setExpanded] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [createDrafts, setCreateDrafts] = useState<string[]>(DEFAULT_PROJECT_QUESTIONS)
  // 问题 chip 编辑态（双击进入）
  const [editingQId, setEditingQId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const barRef = useRef<HTMLDivElement>(null)
  const dropHover = useSyncExternalStore(topicDropState.subscribe, topicDropState.isHovering)

  // 当前问题同步给拖拽置入（必须在 early return 之前，保持 hooks 顺序稳定）
  const currentQuestionId = project?.questions[currentQ]?.id ?? null
  useEffect(() => {
    topicDropState.setQuestionId(currentQuestionId)
  }, [currentQuestionId])

  // 点击外部收起（忽略下拉菜单等 portal 内容）
  useEffect(() => {
    if (!expanded) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('[role="menu"], [role="menuitem"], [data-radix-menu-content]')) return
      if (barRef.current && !barRef.current.contains(t)) setExpanded(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [expanded])

  // 收起时清除拖拽悬停态
  useEffect(() => {
    if (!expanded) topicDropState.setHovering(false)
  }, [expanded])

  // 切换画布时重置
  useEffect(() => {
    setCurrentQ(0)
    setEditingQId(null)
    setExpanded(false)
    topicDropState.reset()
  }, [activeBoardId])

  if (!activeBoard) return null

  const questions = project?.questions ?? []
  const currentQuestion = questions[currentQ]
  const currentOutcomes = project?.outcomes.filter((o) => o.questionId === currentQuestion?.id) ?? []

  // 成果 tile 内容（标题 + 正文）
  const outcomeContent = (nodeId: string, nodeType: 'card' | 'frame'): { title: string; body: string } => {
    if (nodeType === 'card') {
      const card = cards[nodeId]
      return { title: card?.title || '未命名卡片', body: extractText(card?.content) }
    }
    const node = boardData[activeBoardId!]?.nodes.find((n) => n.id === nodeId)
    const name = (node?.data?.name as string) || nodeId
    const desc = (node?.data?.description as string) || ''
    return { title: name, body: desc }
  }

  // ── 新增主题 ──
  const updateCreateDraft = (index: number, value: string) => {
    setCreateDrafts((ds) => ds.map((d, i) => (i === index ? value : d)))
  }
  const addCreateDraft = () => setCreateDrafts((ds) => [...ds, ''])
  const removeCreateDraft = (index: number) => setCreateDrafts((ds) => ds.filter((_, i) => i !== index))
  const handleCreateTopic = () => {
    if (!activeBoardId) return
    const qs = createDrafts.map((d) => d.trim()).filter(Boolean)
    convertBoardToProject(activeBoardId, qs.length > 0 ? qs : undefined)
    setExpanded(true)
  }

  // ── 成果定位（不关闭面板） ──
  const handleFocusNode = (nodeId: string) => {
    if (!activeBoardId) return
    emit('focus-node', { boardId: activeBoardId, nodeId })
  }

  // ── 问题操作 ──
  const handleRename = () => {
    if (project && editingQId && editingTitle.trim()) {
      useProjectStore.getState().renameQuestion(project.boardId, editingQId, editingTitle.trim())
    }
    setEditingQId(null)
  }
  const handleDeleteQuestion = (qid: string) => {
    if (!project) return
    useProjectStore.getState().removeQuestion(project.boardId, qid)
    setCurrentQ(0)
    setEditingQId(null)
  }
  const handleAddQuestion = () => {
    if (!project) return
    useProjectStore.getState().addQuestion(project.boardId, '新问题')
    const updated = useProjectStore.getState().projects[project.boardId]
    const q = updated?.questions[updated.questions.length - 1]
    if (q) {
      setCurrentQ(updated!.questions.length - 1)
      setEditingQId(q.id)
      setEditingTitle(q.title)
    }
  }

  const inputClass =
    'h-7 rounded-md border border-line-default bg-surface-input px-2 text-xs text-fg-primary outline-none placeholder:text-fg-tertiary focus-visible:ring-2 focus-visible:ring-line-focus'

  return (
    <div ref={barRef} className="absolute z-40" style={{ top: 12, left: sideLeft + 12 }}>
      {/* ── 图标按钮：浮层的左上角锚点（收起时仅此可见） ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={isTopic ? '主题成果' : '新增主题'}
        title={isTopic ? '主题成果' : '新增主题'}
        className={`absolute left-0 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-colors ${
          isTopic
            ? expanded
              ? 'border-brand bg-brand-soft text-brand'
              : 'border-line-default bg-surface-card text-accent-blue hover:border-brand'
            : 'border-line-default bg-surface-card text-accent-blue hover:border-brand'
        }`}
        style={{ backdropFilter: 'var(--blur-card)' }}
      >
        {isTopic ? <Star size={16} fill="currentColor" /> : <Plus size={16} />}
      </button>

      {/* ── 浮层：从图标向右下延展，图标位于其左上角（拖拽放置目标） ── */}
      {expanded && (
        <div
          {...(isTopic ? { 'data-topic-drop': '' } : {})}
          className="absolute left-0 top-0 w-[540px] max-h-[min(480px,calc(100vh-120px))] overflow-y-auto rounded-xl border border-line-default shadow-xl animate-fadeInUp glass-panel-large"
          style={{
            ...(dropHover && isTopic
              ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 3px var(--brand-ring), var(--shadow-xl)' }
              : {}),
          }}
        >
          {/* 内容区让出左上角图标空间 */}
          <div className="pl-11">
          {dropHover && isTopic && (
            <div className="flex items-center justify-center gap-1.5 bg-brand px-3 py-1.5 text-xs font-semibold text-fg-inverse">
              <Star size={12} fill="currentColor" />
              松开置入「{currentQuestion?.title ?? ''}」
            </div>
          )}
          {!isTopic ? (
            /* ── 新增主题 ── */
            <div className="flex flex-col gap-3 p-4">
              <div className="flex flex-col gap-1.5">
                {createDrafts.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      value={d}
                      onChange={(e) => updateCreateDraft(i, e.target.value)}
                      placeholder={`问题 ${i + 1}`}
                      className={inputClass}
                    />
                    <button type="button" className="action-icon-btn shrink-0" aria-label="删除该问题" onClick={() => removeCreateDraft(i)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="btn-base flex items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-secondary hover:text-fg-primary"
                  onClick={addCreateDraft}
                >
                  <Plus size={13} />
                  添加问题
                </button>
                <button
                  type="button"
                  className="flex h-7 items-center gap-1 rounded-lg bg-brand px-3 text-xs font-medium text-fg-inverse transition-colors hover:bg-brand-hover"
                  onClick={handleCreateTopic}
                >
                  <Star size={12} />
                  创建主题
                </button>
              </div>
            </div>
          ) : (
            /* ── 主题模式：问题 chips + 当前问题成果横排 ── */
            <div className="flex flex-col gap-2 p-3">
              {/* 问题 chips 并排（浅色底，单击切换、双击编辑、hover 删除、末尾添加） */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {questions.map((q, i) =>
                  editingQId === q.id ? (
                    <input
                      key={q.id}
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={handleRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename()
                        if (e.key === 'Escape') setEditingQId(null)
                      }}
                      className={`${inputClass} w-36 shrink-0`}
                    />
                  ) : (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => { setCurrentQ(i); setEditingQId(null) }}
                      onDoubleClick={() => { setEditingQId(q.id); setEditingTitle(q.title) }}
                      title="单击切换 · 双击编辑"
                      className={`group flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs transition-colors ${
                        i === currentQ
                          ? 'bg-brand-soft font-semibold text-brand'
                          : 'bg-surface-panel-hover text-fg-secondary hover:bg-surface-card-hover hover:text-fg-primary'
                      }`}
                    >
                      <span className="max-w-[140px] truncate">{q.title}</span>
                      {i === currentQ && (
                        <X
                          size={11}
                          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(q.id) }}
                        />
                      )}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  title="添加问题"
                  className="action-icon-btn h-6 shrink-0"
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* 当前问题成果横排 */}
              {currentOutcomes.length > 0 ? (
                <div className="flex gap-1.5 overflow-x-auto">
                  {currentOutcomes.map((o) => {
                    const { title, body } = outcomeContent(o.nodeId, o.nodeType)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => handleFocusNode(o.nodeId)}
                        title="定位到画布"
                        className="flex min-w-[140px] max-w-[200px] flex-1 flex-col gap-0.5 rounded-lg bg-surface-panel-hover p-2 text-left transition-colors hover:bg-surface-panel"
                      >
                        <span className="truncate text-xs font-medium">{title}</span>
                        {body && <span className="line-clamp-2 text-[11px] leading-4 text-fg-tertiary">{body}</span>}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="px-1 py-3 text-center text-xs text-fg-tertiary">
                  {questions.length === 0 ? '暂无问题' : '暂无成果'}
                </div>
              )}
            </div>
          )}
          </div>{/* /pl-11 内容区 */}
        </div>
      )}
    </div>
  )
}
