/**
 * SSE 客户端（fetch + ReadableStream 实现，避免 EventSource 浏览器兼容问题）。
 *
 * 数据契约见 docs/03-技术方案-v1.md 第 8 节。
 * - meta  → fragments + keywords
 * - step  → GenStep（candidates + 真实 selected）
 * - done  → 结束
 */

export interface Candidate {
  text: string
  prob: number
}

export interface GenStep {
  candidates: Candidate[]
  selectedText: string
  selectedRank: number | null
}

export interface Fragment {
  text: string
  tokenId: number
  emoji?: string
}

export interface Example {
  id: string
  sessionId: string
  question: string
  keywords: string[]
  fragments: Fragment[]
  historyRounds: number
}

function extractKeywords(tokens: Fragment[]): string[] {
  const keywords: string[] = []
  for (const t of tokens) {
    const clean = t.text.replace(/<\|.*?\|>/g, '').trim()
    if (clean && !keywords.includes(clean)) keywords.push(clean)
    if (keywords.length >= 6) break
  }
  return keywords
}

export function connectSSE(
  text: string,
  conversationId: string,
  callbacks: {
    onMeta: (ex: Example) => void
    onStep: (step: GenStep) => void
    onDone: () => void
    onError: (msg: string) => void
  },
): () => void {
  // 本地默认直连 8000（绕过 dev 代理的 SSE 缓冲）；部署时设 NEXT_PUBLIC_API_URL='' 走同源 /api
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'
  const url = `${base}/api/stream?text=${encodeURIComponent(text)}&conversation_id=${encodeURIComponent(conversationId)}&anonymous_user_id=${encodeURIComponent(getAnonymousUserId())}`
  const controller = new AbortController()
  let aborted = false

  ;(async () => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok || !response.body) {
        callbacks.onError(`服务器错误 (${response.status})`)
        return
      }
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (!aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // 按 SSE 双换行分割事件
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const raw of parts) {
          let event = ''
          let data = ''
          for (const line of raw.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7)
            else if (line.startsWith('data: ')) data += line.slice(6)
          }
          if (!event) continue

          try {
            switch (event) {
              case 'meta': {
                console.log('[SSE] 收到 meta')
                const d = JSON.parse(data)
                const fragments: Fragment[] = d.input_tokens.map(
                  (t: { token_text: string; token_id: number }) => ({
                    text: t.token_text,
                    tokenId: t.token_id,
                  }),
                )
                callbacks.onMeta({
                  id: d.conversation_id,
                  sessionId: d.session_id ?? '',
                  question: d.input_text,
                  historyRounds: d.history_rounds ?? 0,
                  keywords: extractKeywords(fragments),
                  fragments,
                })
                break
              }
              case 'step': {
                const d = JSON.parse(data)
                callbacks.onStep({
                  candidates: d.candidates.map(
                    (c: { token_text: string; probability: number }) => ({
                      text: c.token_text,
                      prob: c.probability,
                    }),
                  ),
                  selectedText: d.selected_token.token_text,
                  selectedRank: d.selected_token.rank ?? null,
                })
                break
              }
              case 'done':
                callbacks.onDone()
                return // 流结束
              case 'error': {
                const d = JSON.parse(data)
                callbacks.onError(d.message)
                return
              }
            }
          } catch {
            // 单条事件解析失败，跳过，不中断整体流
          }
        }
      }
      // 正常结束
      callbacks.onDone()
    } catch (err: unknown) {
      if (!aborted) {
        callbacks.onError(
          err instanceof DOMException && err.name === 'AbortError'
            ? ''
            : '连接中断，请刷新后重试',
        )
      }
    } finally {
      reader?.releaseLock()
    }
  })()

  return () => {
    aborted = true
    controller.abort()
  }
}

export function getConversationId(): string {
  if (typeof window === 'undefined') return ''
  let cid = localStorage.getItem('llm_cid')
  if (!cid) {
    cid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    localStorage.setItem('llm_cid', cid)
  }
  return cid
}

export function getAnonymousUserId(): string {
  if (typeof window === 'undefined') return ''
  let uid = localStorage.getItem('llm_uid')
  if (!uid) {
    uid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    localStorage.setItem('llm_uid', uid)
  }
  return uid
}

export const answerOf = (steps: GenStep[]): string =>
  steps.map((s) => displayToken(s.selectedText)).filter(Boolean).join('')

/** 展示层：特殊 token（<|im_end|> 等）不显示；字节级乱码/不可见字符清洗；其余原样返回 */
export function displayToken(text: string): string {
  if (/^<\|.*\|>$/.test(text)) return ''
  return text.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uD800-\uDFFF\u200B-\u200D\uFEFF\uFFFD]/g,
    '',
  )
}
