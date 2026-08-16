import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useProjectStore, DEFAULT_PROJECT_QUESTIONS } from './projectStore'

vi.mock('../sync/syncEngineRef', () => ({
  flushActiveSyncEngine: vi.fn(),
}))

import { flushActiveSyncEngine } from '../sync/syncEngineRef'

describe('ProjectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: {}, isLoaded: false })
    vi.mocked(flushActiveSyncEngine).mockClear()
  })

  describe('loadProjects / setLoaded', () => {
    it('应写入 projects 并标记 isLoaded', () => {
      const project = {
        version: 1 as const,
        boardId: 'b1',
        questions: [{ id: 'q1', title: '问题A' }],
        outcomes: [],
        createdAt: 1,
        updatedAt: 2,
      }
      useProjectStore.getState().loadProjects({ b1: project })
      expect(useProjectStore.getState().projects.b1).toEqual(project)
      expect(useProjectStore.getState().isLoaded).toBe(true)
    })
  })

  describe('createProject', () => {
    it('应使用默认问题词创建项目', () => {
      useProjectStore.getState().createProject('b1')
      const p = useProjectStore.getState().projects.b1
      expect(p).toBeDefined()
      expect(p!.version).toBe(1)
      expect(p!.boardId).toBe('b1')
      expect(p!.questions.map(q => q.title)).toEqual(DEFAULT_PROJECT_QUESTIONS)
      expect(p!.questions.every(q => q.id && q.title)).toBe(true)
      expect(p!.outcomes).toEqual([])
      expect(flushActiveSyncEngine).toHaveBeenCalled()
    })

    it('应使用自定义问题词', () => {
      useProjectStore.getState().createProject('b1', ['为什么', '怎么办'])
      expect(useProjectStore.getState().projects.b1!.questions.map(q => q.title)).toEqual(['为什么', '怎么办'])
    })
  })

  describe('问题 CRUD', () => {
    beforeEach(() => useProjectStore.getState().createProject('b1'))

    it('addQuestion 应追加问题', () => {
      useProjectStore.getState().addQuestion('b1', '新问题')
      const titles = useProjectStore.getState().projects.b1!.questions.map(q => q.title)
      expect(titles).toContain('新问题')
    })

    it('addQuestion 空标题应忽略', () => {
      const before = useProjectStore.getState().projects.b1!.questions.length
      useProjectStore.getState().addQuestion('b1', '   ')
      expect(useProjectStore.getState().projects.b1!.questions).toHaveLength(before)
    })

    it('renameQuestion 应更新标题', () => {
      const q = useProjectStore.getState().projects.b1!.questions[0]
      useProjectStore.getState().renameQuestion('b1', q.id, '改名后')
      expect(useProjectStore.getState().projects.b1!.questions[0].title).toBe('改名后')
    })

    it('removeQuestion 应同时清理归属它的成果', () => {
      const q = useProjectStore.getState().projects.b1!.questions[0]
      useProjectStore.getState().addOutcome('b1', 'card-1', 'card', q.id)
      useProjectStore.getState().removeQuestion('b1', q.id)
      const p = useProjectStore.getState().projects.b1!
      expect(p.questions.some(x => x.id === q.id)).toBe(false)
      expect(p.outcomes).toHaveLength(0)
    })
  })

  describe('成果（锚点）', () => {
    let q1: string, q2: string
    beforeEach(() => {
      useProjectStore.getState().createProject('b1')
      q1 = useProjectStore.getState().projects.b1!.questions[0].id
      q2 = useProjectStore.getState().projects.b1!.questions[1].id
    })

    it('addOutcome 应新增锚点并记录归属问题', () => {
      useProjectStore.getState().addOutcome('b1', 'card-a', 'card', q1)
      const p = useProjectStore.getState().projects.b1!
      expect(p.outcomes).toHaveLength(1)
      expect(p.outcomes[0]).toMatchObject({ nodeId: 'card-a', nodeType: 'card', questionId: q1 })
      expect(p.outcomes[0].at).toBeTypeOf('number')
    })

    it('同一节点重复 addOutcome 应转移归属而非新增', () => {
      useProjectStore.getState().addOutcome('b1', 'card-a', 'card', q1)
      useProjectStore.getState().addOutcome('b1', 'card-a', 'card', q2)
      const p = useProjectStore.getState().projects.b1!
      expect(p.outcomes).toHaveLength(1)
      expect(p.outcomes[0].questionId).toBe(q2)
    })

    it('支持 frame 节点', () => {
      useProjectStore.getState().addOutcome('b1', 'frame-x', 'frame', q1)
      expect(useProjectStore.getState().projects.b1!.outcomes[0].nodeType).toBe('frame')
    })

    it('removeOutcome 应删除锚点', () => {
      useProjectStore.getState().addOutcome('b1', 'card-a', 'card', q1)
      const id = useProjectStore.getState().projects.b1!.outcomes[0].id
      useProjectStore.getState().removeOutcome('b1', id)
      expect(useProjectStore.getState().projects.b1!.outcomes).toHaveLength(0)
    })

    it('moveOutcome 应转移问题并更新时间', () => {
      useProjectStore.getState().addOutcome('b1', 'card-a', 'card', q1)
      const o = useProjectStore.getState().projects.b1!.outcomes[0]
      useProjectStore.getState().moveOutcome('b1', o.id, q2)
      expect(useProjectStore.getState().projects.b1!.outcomes[0].questionId).toBe(q2)
    })

    it('getOutcomesForQuestion 应只返回该问题的成果', () => {
      useProjectStore.getState().addOutcome('b1', 'card-a', 'card', q1)
      useProjectStore.getState().addOutcome('b1', 'card-b', 'card', q1)
      useProjectStore.getState().addOutcome('b1', 'card-c', 'card', q2)
      expect(useProjectStore.getState().getOutcomesForQuestion('b1', q1)).toHaveLength(2)
      expect(useProjectStore.getState().getOutcomesForQuestion('b1', q2)).toHaveLength(1)
    })

    it('isNodeOutcome 应正确判断', () => {
      expect(useProjectStore.getState().isNodeOutcome('b1', 'card-a')).toBe(false)
      useProjectStore.getState().addOutcome('b1', 'card-a', 'card', q1)
      expect(useProjectStore.getState().isNodeOutcome('b1', 'card-a')).toBe(true)
      expect(useProjectStore.getState().isNodeOutcome('b1', 'card-zzz')).toBe(false)
      expect(useProjectStore.getState().isNodeOutcome('nope', 'card-a')).toBe(false)
    })
  })

  describe('deleteProject', () => {
    it('应移除项目并 flush', () => {
      useProjectStore.getState().createProject('b1')
      useProjectStore.getState().deleteProject('b1')
      expect(useProjectStore.getState().projects.b1).toBeUndefined()
      expect(flushActiveSyncEngine).toHaveBeenCalled()
    })
  })
})
