/**
 * 统一埋点：所有前端事件都走这一个函数，POST 到同源/后端 /api/event。
 * 本地开发直连 8000，部署同源（与 api.ts 的 base 保持一致）。
 */
import { getAnonymousUserId } from '@/lib/api'

const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'

export function track(
  event: string,
  data?: Record<string, unknown>,
  sessionId?: string,
): void {
  if (typeof window === 'undefined') return
  fetch(`${base}/api/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      anonymous_user_id: getAnonymousUserId(),
      session_id: sessionId ?? '',
      data,
    }),
    keepalive: true, // 页面切换时不丢请求
  }).catch(() => {
    // 埋点失败不影响主流程
  })
}
