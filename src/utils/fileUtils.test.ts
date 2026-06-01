import { describe, it, expect } from 'vitest'
import { generateId } from './fileUtils'

describe('generateId', () => {
  it('默认前缀应为 id- 开头', () => {
    const id = generateId()
    expect(id).toMatch(/^id-\d+-[a-z0-9]{6}$/)
  })

  it('自定义前缀应正确', () => {
    const id = generateId('card')
    expect(id).toMatch(/^card-\d+-[a-z0-9]{6}$/)
  })

  it('每次生成的 ID 应不同', () => {
    const ids = new Set(Array.from({ length: 10 }, () => generateId()))
    expect(ids.size).toBe(10)
  })
})
