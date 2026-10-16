// The service worker for Web Push (release G'): shows the notification the
// backend pushes — "your order is ready" on a follow page, a payment to take
// on a kassa's Tap to Pay phone — even with the page closed, and opens its
// page when it's tapped (that page already open: brought to the front).
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // not ours
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '', { body: data.body || '', tag: data.tag, data: { url: data.url || '/' }, icon: '/favicon.svg' })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const path = new URL(url).pathname
      for (const client of list) if (new URL(client.url).pathname === path && 'focus' in client) return client.focus()
      return self.clients.openWindow(url)
    })
  )
})
