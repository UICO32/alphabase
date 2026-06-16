export function extractTitleFromJSON(content: string): string {
  try {
    const blocks = JSON.parse(content)
    for (const block of blocks) {
      if (block.type === 'heading' && block.content?.length > 0) {
        return block.content.map((c: { text?: string }) => c.text || '').join('')
      }
    }
    return ''
  } catch {
    return ''
  }
}

export function extractTitleFromHTML(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const heading = doc.querySelector('h1, h2, h3')
    return heading?.textContent?.trim() || ''
  } catch {
    return ''
  }
}

export function extractFirstTextFromHTML(html: string): string {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const allBlocks = doc.body.children
    for (let i = 0; i < allBlocks.length; i++) {
      const el = allBlocks[i] as HTMLElement
      if (el.matches('h1, h2, h3')) continue
      const text = el.textContent?.trim() || ''
      if (text) return text
    }
    return ''
  } catch {
    return ''
  }
}

export function extractImagesFromHTML(html: string): string[] {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const imgs = doc.querySelectorAll('img')
    return Array.from(imgs).map((img) => img.getAttribute('src') || '').filter(Boolean)
  } catch {
    return []
  }
}
