import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './fonts/nanum-barun-gothic.css'
import './styles.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// 가족 몇 명이서만 쓰는 앱이라 동시 편집 충돌 위험이 낮다 — staleTime을 좀 넉넉히 둬서
// 화면(탭) 전환마다 매번 재요청하지 않고 캐시를 우선 보여준다. 그래도 mutation 이후엔
// 관련 쿼리를 명시적으로 invalidate하므로 오래된 데이터가 오래 남지는 않는다.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
)
