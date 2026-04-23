import { describe, expect, it } from 'vitest'
import { extractTexts } from '../src/normalize'

describe('extractTexts', () => {
  it('extracts from simple strings and string arrays', () => {
    expect(extractTexts('hello')).toEqual(['hello'])
    expect(extractTexts(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('extracts from OpenAI/generic message objects', () => {
    const messages = [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'world' }]
    expect(extractTexts(messages)).toEqual(['hello', 'world'])
  })

  it('extracts text from Anthropic-style content blocks', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'input_image', source: { type: 'base64', media_type: 'image/png', data: '...' } },
          { type: 'text', text: 'world' },
        ],
      },
    ]
    expect(extractTexts(messages)).toEqual(['hello', 'world'])
  })

  it('ignores nullish/non-text values and flattens nested arrays', () => {
    const input = [
      null,
      undefined,
      123,
      [{ content: 'a' }, [{ content: [{ type: 'text', text: 'b' }, { type: 'tool_use' }] }]],
      { content: [null, { text: 'c' }, { text: 42 }] },
    ]
    expect(extractTexts(input)).toEqual(['a', 'b', 'c'])
  })
})
