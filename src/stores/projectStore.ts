import { create } from 'zustand'
import { flushActiveSyncEngine } from '../sync/syncEngineRef'
import type { ProjectData, ProjectOutcome, ProjectQuestion } from '../utils/workspace/types'

/** 新建项目时预填的默认问题划分词（项目级，可自由增删改） */
export const DEFAULT_PROJECT_QUESTIONS = ['收集问题', '拆解子问题', '形成结论']

function makeQuestionId(now: number, index: number): string {
  return `q-${now}-${index}`
}

function makeOutcomeId(): string {
  return `o-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface ProjectStore {
  projects: Record<string, ProjectData>
  isLoaded: boolean

  setLoaded: (loaded: boolean) => void
  loadProjects: (projects: Record<string, ProjectData>) => void

  createProject: (boardId: string, questionTitles?: string[]) => void
  deleteProject: (boardId: string) => void
  getProject: (boardId: string) => ProjectData | undefined

  addQuestion: (boardId: string, title: string) => void
  renameQuestion: (boardId: string, questionId: string, title: string) => void
  removeQuestion: (boardId: string, questionId: string) => void

  addOutcome: (boardId: string, nodeId: string, nodeType: 'card' | 'frame', questionId: string) => void
  removeOutcome: (boardId: string, outcomeId: string) => void
  moveOutcome: (boardId: string, outcomeId: string, questionId: string) => void
  getOutcomesForQuestion: (boardId: string, questionId: string) => ProjectOutcome[]
  isNodeOutcome: (boardId: string, nodeId: string) => boolean
}

export const useProjectStore = create<ProjectStore>()((set, get) => ({
  projects: {},
  isLoaded: false,

  setLoaded: (loaded) => set({ isLoaded: loaded }),

  loadProjects: (projects) => set({ projects, isLoaded: true }),

  createProject: (boardId, questionTitles = DEFAULT_PROJECT_QUESTIONS) => {
    const now = Date.now()
    const questions: ProjectQuestion[] = questionTitles.map((title, i) => ({
      id: makeQuestionId(now, i),
      title,
    }))
    set((state) => ({
      projects: {
        ...state.projects,
        [boardId]: {
          version: 1,
          boardId,
          questions,
          outcomes: [],
          createdAt: now,
          updatedAt: now,
        },
      },
    }))
    flushActiveSyncEngine()
  },

  deleteProject: (boardId) => {
    set((state) => {
      const { [boardId]: _, ...rest } = state.projects
      return { projects: rest }
    })
    flushActiveSyncEngine()
  },

  getProject: (boardId) => get().projects[boardId],

  addQuestion: (boardId, title) => {
    const project = get().projects[boardId]
    if (!project || !title.trim()) return
    const q: ProjectQuestion = { id: makeQuestionId(Date.now(), project.questions.length), title: title.trim() }
    set((state) => ({
      projects: {
        ...state.projects,
        [boardId]: { ...project, questions: [...project.questions, q], updatedAt: Date.now() },
      },
    }))
  },

  renameQuestion: (boardId, questionId, title) => {
    const project = get().projects[boardId]
    if (!project || !title.trim()) return
    set((state) => ({
      projects: {
        ...state.projects,
        [boardId]: {
          ...project,
          questions: project.questions.map((q) => (q.id === questionId ? { ...q, title: title.trim() } : q)),
          updatedAt: Date.now(),
        },
      },
    }))
  },

  removeQuestion: (boardId, questionId) => {
    const project = get().projects[boardId]
    if (!project) return
    // 删除问题的同时清理归属它的成果（避免孤儿成果）
    set((state) => ({
      projects: {
        ...state.projects,
        [boardId]: {
          ...project,
          questions: project.questions.filter((q) => q.id !== questionId),
          outcomes: project.outcomes.filter((o) => o.questionId !== questionId),
          updatedAt: Date.now(),
        },
      },
    }))
  },

  addOutcome: (boardId, nodeId, nodeType, questionId) => {
    const project = get().projects[boardId]
    if (!project) return
    const existing = project.outcomes.find((o) => o.nodeId === nodeId)
    if (existing) {
      // 已是成果：转移归属到新问题
      get().moveOutcome(boardId, existing.id, questionId)
      return
    }
    const outcome: ProjectOutcome = { id: makeOutcomeId(), nodeId, nodeType, questionId, at: Date.now() }
    set((state) => ({
      projects: {
        ...state.projects,
        [boardId]: { ...project, outcomes: [...project.outcomes, outcome], updatedAt: Date.now() },
      },
    }))
  },

  removeOutcome: (boardId, outcomeId) => {
    const project = get().projects[boardId]
    if (!project) return
    set((state) => ({
      projects: {
        ...state.projects,
        [boardId]: {
          ...project,
          outcomes: project.outcomes.filter((o) => o.id !== outcomeId),
          updatedAt: Date.now(),
        },
      },
    }))
  },

  moveOutcome: (boardId, outcomeId, questionId) => {
    const project = get().projects[boardId]
    if (!project) return
    set((state) => ({
      projects: {
        ...state.projects,
        [boardId]: {
          ...project,
          outcomes: project.outcomes.map((o) => (o.id === outcomeId ? { ...o, questionId, at: Date.now() } : o)),
          updatedAt: Date.now(),
        },
      },
    }))
  },

  getOutcomesForQuestion: (boardId, questionId) => {
    const project = get().projects[boardId]
    if (!project) return []
    return project.outcomes.filter((o) => o.questionId === questionId)
  },

  isNodeOutcome: (boardId, nodeId) => {
    const project = get().projects[boardId]
    if (!project) return false
    return project.outcomes.some((o) => o.nodeId === nodeId)
  },
}))
