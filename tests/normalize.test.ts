import { describe, expect, it } from 'vitest'
import { extractTexts } from '../src/normalize'

describe('extractTexts', () => {
  it('extracts from simple strings and string arrays', () => {
    expect(extractTexts('hello')).toEqual(['hello'])
    expect(extractTexts(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('trims text and filters empty/whitespace-only strings', () => {
    const input = [
      '  hello  ',
      '',
      '   ',
      { content: '  world  ' },
      { text: '\n  ok\t' },
      { message: '   ' },
    ]

    expect(extractTexts(input)).toEqual(['hello', 'world', 'ok'])
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

  it('extracts text from Gemini-style contents/parts', () => {
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'hello from gemini' }, { inlineData: { mimeType: 'image/png' } }],
        },
        { role: 'model', parts: [{ text: 'response text' }] },
      ],
    }

    expect(extractTexts(payload)).toEqual(['hello from gemini', 'response text'])
  })

  it('extracts text from Cohere-style message fields', () => {
    const messages = [
      { role: 'USER', message: 'hello from cohere' },
      { role: 'CHATBOT', message: 'hi there' },
    ]
    expect(extractTexts(messages)).toEqual(['hello from cohere', 'hi there'])
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

  it('does not crash on cyclic objects', () => {
    const cyclic: Record<string, unknown> = { content: 'hello' }
    cyclic.self = cyclic

    expect(extractTexts(cyclic)).toEqual(['hello'])
  })
})
