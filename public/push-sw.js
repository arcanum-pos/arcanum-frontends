// The follow page's service worker (Web Push, release G'): shows "your
// order is ready" when the backend pushes it — even with the page closed —
// and opens that order's page when the notification is tapped.
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
      for (const client of list) if (client.url === url && 'focus' in client) return client.focus()
      return self.clients.openWindow(url)
    })
  )
})
