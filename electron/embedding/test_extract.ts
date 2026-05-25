import { extractEmbeddingText } from './textExtractor'

const content = JSON.stringify([
  { id: 'b1', type: 'paragraph', props: {}, content: [{ type: 'text', text: '机器学习是人工智能的一个分支', styles: {} }], children: [] }
])

console.log('Input:', content.slice(0, 100))
const text = extractEmbeddingText(content)
console.log('Result:', JSON.stringify(text))
