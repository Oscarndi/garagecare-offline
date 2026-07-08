const GARAGECARE_CACHE = 'garagecare-app-shell-v1'

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons.svg',
  '/assets/garagecare/icone_garage.png',
  '/assets/garagecare/pwa.png',
  '/assets/garagecare/tableau_de_bord.png',
  '/assets/garagecare/clients.png',
  '/assets/garagecare/devis.png',
  '/assets/garagecare/stock.png',
  '/assets/garagecare/charges.png',
  '/assets/garagecare/planning.png',
  '/assets/garagecare/assistant.png',
  '/assets/garagecare/catalogue_de_services.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(GARAGECARE_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== GARAGECARE_CACHE)
        .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url)

  if (requestUrl.pathname.startsWith('/api/')) {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(GARAGECARE_CACHE).then((cache) => cache.put('/index.html', copy))
          return response
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  if (event.request.method !== 'GET') {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request).then((response) => {
        const copy = response.clone()
        caches.open(GARAGECARE_CACHE).then((cache) => cache.put(event.request, copy))
        return response
      })
    })
  )
})
