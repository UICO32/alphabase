import { renderBlocksToHTML } from './renderBlocks'

const html = renderBlocksToHTML(JSON.stringify([
  { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }
]))

console.log('=== HTML OUTPUT ===')
console.log(html)
