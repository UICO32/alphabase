import { readFileSync } from 'fs'

interface TokenizerConfig {
  model: {
    type: string
    vocab: Record<string, number>
    merges: [string, string][]
  }
  added_tokens: Array<{ id: number; content: string; special: boolean }>
}

const BOS_TOKEN = '<|begin_of_text|>'
const EOS_TOKEN = '<|end_of_text|>'

// Build the GPT-2 byte-level encoder/decoder (bytes_to_unicode)
// Printable bytes (33-126, 161-172, 174-255) map to themselves as unicode chars.
// Remaining bytes (0-32, 127-160, 173) map to sequential chars starting at 256.
const BYTE_ENCODER = buildByteEncoder()

function buildByteEncoder(): Map<number, string> {
  const printable: number[] = []
  for (let i = 33; i <= 126; i++) printable.push(i)
  for (let i = 161; i <= 172; i++) printable.push(i)
  for (let i = 174; i <= 255; i++) printable.push(i)

  const encoder = new Map<number, string>()

  // Printable bytes map to themselves (chr(byte) = chr(byte))
  for (const b of printable) {
    encoder.set(b, String.fromCharCode(b))
  }

  // Remaining bytes map to sequential chars starting at 256
  let n = 0
  for (let b = 0; b < 256; b++) {
    if (!encoder.has(b)) {
      encoder.set(b, String.fromCharCode(256 + n))
      n++
    }
  }

  return encoder
}

// LLaMA pre-tokenizer regex
const PRE_TOKENIZE_REGEX = /(?i:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu

export class JinaTokenizer {
  private vocab: Map<string, number>
  private mergeRank: Map<string, number>
  private specialTokens: Map<string, number>

  constructor(tokenizerPath: string) {
    const raw = readFileSync(tokenizerPath, 'utf-8')
    const config: TokenizerConfig = JSON.parse(raw)

    this.vocab = new Map(Object.entries(config.model.vocab))

    this.mergeRank = new Map()
    for (let i = 0; i < config.model.merges.length; i++) {
      const [a, b] = config.model.merges[i]
      this.mergeRank.set(`${a} ${b}`, i)
    }

    this.specialTokens = new Map()
    for (const tok of config.added_tokens) {
      this.specialTokens.set(tok.content, tok.id)
    }
  }

  encode(text: string): { ids: number[]; attentionMask: number[] } {
    const ids: number[] = []

    const bosId = this.specialTokens.get(BOS_TOKEN)
    if (bosId !== undefined) ids.push(bosId)

    const words = text.match(PRE_TOKENIZE_REGEX) || [text]

    for (const word of words) {
      const byteLevelStr = this.byteLevelEncode(word)
      const charTokens = [...byteLevelStr]
      const merged = this.bpe(charTokens)
      for (const token of merged) {
        const id = this.vocab.get(token)
        if (id !== undefined) ids.push(id)
      }
    }

    const eosId = this.specialTokens.get(EOS_TOKEN)
    if (eosId !== undefined) ids.push(eosId)

    return { ids, attentionMask: ids.map(() => 1) }
  }

  private byteLevelEncode(str: string): string {
    // Convert each UTF-8 byte to its GPT-2 byte-level unicode representation
    const result: string[] = []
    for (let i = 0; i < str.length; i++) {
      const code = str.codePointAt(i)!
      if (code < 0x80) {
        result.push(BYTE_ENCODER.get(code)!)
      } else {
        const bytes = this.utf8Encode(code)
        for (const b of bytes) {
          result.push(BYTE_ENCODER.get(b)!)
        }
        if (code > 0xFFFF) i++
      }
    }
    return result.join('')
  }

  private utf8Encode(codePoint: number): number[] {
    if (codePoint < 0x80) return [codePoint]
    if (codePoint < 0x800) return [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)]
    if (codePoint < 0x10000) return [0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)]
    return [0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)]
  }

  private bpe(tokens: string[]): string[] {
    if (tokens.length <= 1) return tokens

    let current = [...tokens]
    while (true) {
      let bestRank = Infinity
      let bestIdx = -1

      for (let i = 0; i < current.length - 1; i++) {
        const rank = this.mergeRank.get(`${current[i]} ${current[i + 1]}`)
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank
          bestIdx = i
        }
      }

      if (bestIdx === -1) break

      const merged = current[bestIdx] + current[bestIdx + 1]
      current = [...current.slice(0, bestIdx), merged, ...current.slice(bestIdx + 2)]
    }

    return current
  }
}