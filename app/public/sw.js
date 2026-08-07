/**
 * Service Worker — ausschließlich Web Push (O3, Zug 1 des Morgen-Wargames).
 *
 * **Dieser Worker cached NICHTS.** Kein `fetch`-Handler, kein Aufruf der
 * Cache-API. Das ist die wichtigste Regel dieser Datei: Ein Cache-First-Reflex
 * würde nach jedem Deploy alte Builds ausliefern, und zwar am Handy, wo Kevin
 * es am spätesten merkt. Wer hier später Offline-Fähigkeit einbaut, baut sich
 * genau diesen Fehler ein — dann bitte mit bewusster Versionierung und
 * Cache-Invalidierung, nicht nebenbei.
 *
 * Ebenso bewusst handgeschrieben statt vite-plugin-pwa: das Plugin injiziert
 * Workbox-Caching, und dagegen hilft kein Kommentar.
 */

// Neue Fassung sofort übernehmen, statt auf das Schließen aller Tabs zu warten.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/**
 * Push von der Edge Function `morgen-push`. Der Payload ist JSON
 * (`{ title, body, url }`); kaputte oder leere Daten dürfen nicht dazu führen,
 * dass gar nichts erscheint — iOS verlangt bei `userVisibleOnly` sichtbar eine
 * Benachrichtigung, sonst entzieht der Browser irgendwann die Berechtigung.
 */
self.addEventListener('push', (event) => {
  let daten = {}
  try {
    daten = event.data ? event.data.json() : {}
  } catch {
    daten = { body: event.data ? event.data.text() : '' }
  }

  const titel = daten.title || 'Uriel'
  const optionen = {
    body: daten.body || 'Dein Morgen steht bereit.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Gleiches Tag = eine Benachrichtigung je Tag, kein Stapel im Sperrbildschirm.
    tag: daten.tag || 'uriel-morgen',
    renotify: true,
    data: { url: daten.url || '/morgen' },
  }

  event.waitUntil(self.registration.showNotification(titel, optionen))
})

/**
 * Tipp auf die Benachrichtigung: vorhandenes Uriel-Fenster fokussieren und
 * dorthin navigieren, sonst eines öffnen. Ohne den Fokus-Zweig entstünde bei
 * jedem Tipp ein zweiter Tab.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const ziel = (event.notification.data && event.notification.data.url) || '/morgen'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
      for (const f of fenster) {
        // Gleicher Origin → das ist Uriel. Navigieren und in den Vordergrund.
        if (new URL(f.url).origin === self.location.origin) {
          return f.focus().then((fokussiert) => {
            if ('navigate' in fokussiert) return fokussiert.navigate(ziel)
            return fokussiert
          })
        }
      }
      return self.clients.openWindow(ziel)
    }),
  )
})
