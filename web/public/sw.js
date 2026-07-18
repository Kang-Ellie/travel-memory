// 오프라인 읽기 — 해외 로밍·지하철처럼 네트워크가 끊긴 상태에서도 최근에 본 일정만이라도
// 볼 수 있게, API GET 응답과 앱 셸(JS/CSS/HTML)을 캐시한다. 쓰기 요청(POST/PUT/DELETE)은
// 절대 캐시하지 않고 항상 네트워크로만 보낸다 — 오프라인 쓰기 큐잉은 이 앱 규모에서 과설계라
// 다루지 않는다(어차피 네트워크 없으면 저장 자체가 실패해야 맞다).
const CACHE_VERSION = 'v2'
const SHELL_CACHE = `shell-${CACHE_VERSION}`
const API_CACHE = `api-${CACHE_VERSION}`
const FILES_CACHE = `files-${CACHE_VERSION}`
const ALL_CACHES = [SHELL_CACHE, API_CACHE, FILES_CACHE]

// 이 API들은 캐시하면 오히려 해로움: 세션 인증 상태는 항상 최신이어야 하고, 검색류는
// 캐시된 옛 결과를 보여주는 게 "일정을 오프라인에서도 본다"는 목적과 무관하다.
const NEVER_CACHE_PATHS = [
  '/api/session', '/api/login', '/api/logout',
  '/api/places/google-search', '/api/places/resolve-map-link', '/api/directions/duration',
]

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

// 캐시가 있으면 즉시 그걸 돌려주고(오프라인에서도 바로 뜸), 네트워크 응답은 백그라운드에서
// 받아 캐시를 갱신한다. event.waitUntil로 백그라운드 fetch가 끝날 때까지 SW가 안 죽게 한다.
async function staleWhileRevalidate(event, request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const networkPromise = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res })
    .catch(() => null)
  event.waitUntil(networkPromise)
  if (cached) return cached
  const networked = await networkPromise
  if (networked) return networked
  return new Response(JSON.stringify({ error: '오프라인이라 아직 저장된 정보가 없어요.' }), {
    status: 503, headers: { 'Content-Type': 'application/json' },
  })
}

// 업로드된 사진·파일은 한 번 생성되면 내용이 안 바뀌므로(경로가 UUID 기반) 캐시에 있으면
// 네트워크를 아예 안 탄다 — 오프라인에서도 최근 본 여행 사진이 그대로 보인다.
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

// 앱 셸(JS/CSS/HTML)은 항상 최신을 우선 받아오되, 오프라인이면 마지막으로 받아둔 캐시로 폴백.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res.ok) cache.put(request, res.clone())
    return res
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    throw new Error('offline and not cached')
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return // 쓰기 요청은 SW가 손대지 않고 그대로 네트워크로

  const url = new URL(request.url)

  if (url.pathname.startsWith('/api/')) {
    if (NEVER_CACHE_PATHS.some((p) => url.pathname.startsWith(p))) return
    if (url.pathname.startsWith('/api/files/')) {
      event.respondWith(cacheFirst(request, FILES_CACHE))
      return
    }
    event.respondWith(staleWhileRevalidate(event, request, API_CACHE))
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, SHELL_CACHE))
  }
})
