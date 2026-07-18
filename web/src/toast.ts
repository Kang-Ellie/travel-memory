// 전역 토스트 스토어 — React 트리 밖(api.ts)에서도 toast.error(...)를 그냥 호출할 수 있도록
// 컨텍스트 대신 간단한 pub/sub으로 구현. ToastHost가 유일한 구독자로 화면에 그린다.
export type ToastKind = 'success' | 'error' | 'info'
export interface ToastItem { id: number; kind: ToastKind; message: string }

type Listener = (items: ToastItem[]) => void

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l(items)
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

function push(kind: ToastKind, message: string, duration: number) {
  const id = nextId++
  items = [...items, { id, kind, message }]
  emit()
  window.setTimeout(() => dismiss(id), duration)
}

export const toast = {
  success: (message: string) => push('success', message, 3000),
  error: (message: string) => push('error', message, 4500),
  info: (message: string) => push('info', message, 3500),
  dismiss,
  subscribe: (fn: Listener) => {
    listeners.add(fn)
    fn(items)
    return () => { listeners.delete(fn) }
  },
}
