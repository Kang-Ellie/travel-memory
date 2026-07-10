// 최소한의 서비스워커 — PWA 설치(홈 화면 추가) 조건을 만족시키기 위한 용도.
// 실제 캐싱은 하지 않고 네트워크 요청을 그대로 통과시킨다(항상 최신 상태 유지).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
