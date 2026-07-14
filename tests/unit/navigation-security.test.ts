import { describe, expect, it } from 'vitest'
import { isAllowedMainFrameNavigation, isAllowedWebviewUrl } from '../../electron/navigationSecurity'

describe('navigation security', () => {
  it('allows only the exact development-server origin for the main frame', () => {
    expect(isAllowedMainFrameNavigation('http://localhost:5173/settings', 'http://localhost:5173')).toBe(true)
    expect(isAllowedMainFrameNavigation('https://evil.example/?next=localhost', 'http://localhost:5173')).toBe(false)
    expect(isAllowedMainFrameNavigation('http://localhost.evil.example', 'http://localhost:5173')).toBe(false)
    expect(isAllowedMainFrameNavigation('hepta-media://image/card.png', 'http://localhost:5173')).toBe(false)
  })

  it('rejects the application media protocol and arbitrary production navigation', () => {
    expect(isAllowedMainFrameNavigation('hepta-media://image/card.png')).toBe(false)
    expect(isAllowedMainFrameNavigation('https://example.com')).toBe(false)
  })

  it('allows only the exact production application entry', () => {
    const entry = 'file:///C:/app/dist/index.html'
    expect(isAllowedMainFrameNavigation(`${entry}#/settings`, undefined, entry)).toBe(true)
    expect(isAllowedMainFrameNavigation('file:///C:/app/dist/../dist/index.html#/settings', undefined, entry)).toBe(true)
    expect(isAllowedMainFrameNavigation('file:///C:/app/dist/evil.html', undefined, entry)).toBe(false)
    expect(isAllowedMainFrameNavigation(`${entry}?debug=true`, undefined, entry)).toBe(false)
    expect(isAllowedMainFrameNavigation('file://host/C:/app/dist/index.html', undefined, entry)).toBe(false)
    expect(isAllowedMainFrameNavigation('javascript:alert(1)', undefined, entry)).toBe(false)
  })

  it('allows only HTTP(S) URLs in a webview', () => {
    expect(isAllowedWebviewUrl('https://example.com/article')).toBe(true)
    expect(isAllowedWebviewUrl('http://example.com/article')).toBe(true)
    expect(isAllowedWebviewUrl('file:///C:/secret.txt')).toBe(false)
    expect(isAllowedWebviewUrl('javascript:alert(1)')).toBe(false)
  })
})
