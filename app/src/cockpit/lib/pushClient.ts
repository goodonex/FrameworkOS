import { supabase } from '../../lib/supabase'

/**
 * Benachrichtigungen aktivieren (O3, Zug 5 des Morgen-Wargames).
 *
 * Zwei Fallen, die hier ausdrücklich vermieden werden:
 *
 * 1. **`Notification.requestPermission()` nur im onClick-Pfad.** Aus einem
 *    `useEffect` heraus lehnt iOS still ab — kein Dialog, Permission bleibt auf
 *    `default`, und niemand sieht, warum nichts passiert. Deshalb gibt es hier
 *    nur `aktiviere()`, das aus einer echten Geste heraus gerufen werden muss.
 * 2. **iOS pusht nur aus der installierten PWA.** Im Safari-Tab gibt es keine
 *    Berechtigung, egal wie oft man fragt. Der Status sagt das ausdrücklich,
 *    statt einen Knopf anzubieten, der nichts tut.
 */

export type PushStatus =
  | 'nicht-unterstuetzt'
  | 'ios-braucht-homescreen'
  | 'kein-schluessel'
  | 'blockiert'
  | 'aus'
  | 'an'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** Läuft die Seite als installierte App (Home-Bildschirm) statt im Browser-Tab? */
export function alsAppInstalliert(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
  return Boolean(iosStandalone) || window.matchMedia('(display-mode: standalone)').matches
}

function istIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS meldet sich als Macintosh — der Touch-Punkt verrät es.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function base64UrlZuBytes(b64: string): ArrayBuffer {
  const auffuellen = '='.repeat((4 - (b64.length % 4)) % 4)
  const roh = atob((b64 + auffuellen).replace(/-/g, '+').replace(/_/g, '/'))
  // Bewusst der ArrayBuffer statt der View: `applicationServerKey` typisiert
  // `BufferSource`, und ein Uint8Array<ArrayBufferLike> passt dort nicht.
  const puffer = new ArrayBuffer(roh.length)
  const bytes = new Uint8Array(puffer)
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
  return puffer
}

function bytesZuBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function pushStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined') return 'nicht-unterstuetzt'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // Auf dem iPhone ist das der Normalfall im Safari-Tab — deshalb die
    // freundlichere Diagnose vor der harten.
    return istIOS() && !alsAppInstalliert() ? 'ios-braucht-homescreen' : 'nicht-unterstuetzt'
  }
  if (istIOS() && !alsAppInstalliert()) return 'ios-braucht-homescreen'
  if (!VAPID_PUBLIC) return 'kein-schluessel'
  if (Notification.permission === 'denied') return 'blockiert'
  try {
    const reg = await navigator.serviceWorker.ready
    const abo = await reg.pushManager.getSubscription()
    return abo ? 'an' : 'aus'
  } catch {
    return 'aus'
  }
}

export interface AktivierungsErgebnis {
  ok: boolean
  status: PushStatus
  fehler?: string
}

/**
 * Muss aus einer echten Nutzer-Geste heraus gerufen werden (siehe Kopf).
 * Upsert auf `endpoint`: Ein zweites Aktivieren desselben Geräts aktualisiert
 * die Zeile, statt eine zweite anzulegen — nach einer PWA-Neuinstallation am
 * iPhone ist genau das der Normalfall.
 */
export async function aktiviere(): Promise<AktivierungsErgebnis> {
  const vorher = await pushStatus()
  if (vorher === 'nicht-unterstuetzt' || vorher === 'ios-braucht-homescreen' || vorher === 'kein-schluessel') {
    return { ok: false, status: vorher }
  }
  if (!supabase) return { ok: false, status: vorher, fehler: 'Keine Supabase-Verbindung' }

  try {
    const erlaubnis = await Notification.requestPermission()
    if (erlaubnis !== 'granted') {
      return { ok: false, status: erlaubnis === 'denied' ? 'blockiert' : 'aus' }
    }

    const reg = await navigator.serviceWorker.ready
    const abo =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlZuBytes(VAPID_PUBLIC!),
      }))

    const { data: sitzung } = await supabase.auth.getUser()
    if (!sitzung?.user) return { ok: false, status: 'aus', fehler: 'Nicht eingeloggt' }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: sitzung.user.id,
        endpoint: abo.endpoint,
        p256dh: bytesZuBase64Url(abo.getKey('p256dh')),
        auth: bytesZuBase64Url(abo.getKey('auth')),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
    if (error) return { ok: false, status: 'aus', fehler: error.message }
    return { ok: true, status: 'an' }
  } catch (e) {
    return { ok: false, status: 'aus', fehler: e instanceof Error ? e.message : String(e) }
  }
}

export async function deaktiviere(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const abo = await reg.pushManager.getSubscription()
    if (!abo) return
    if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', abo.endpoint)
    await abo.unsubscribe()
  } catch {
    /* nichts zu tun */
  }
}

/**
 * Probe-Push: ruft `morgen-push` mit dem eigenen JWT und `{ test: true }`.
 * Die Function überspringt dann Werktag-, Stunden- und Tages-Wächter — und
 * schreibt bewusst NICHT ins `push_log`, sonst bliebe der echte Push am selben
 * Morgen aus.
 */
export async function probePush(): Promise<{ ok: boolean; meldung: string }> {
  if (!supabase) return { ok: false, meldung: 'Keine Supabase-Verbindung' }
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) return { ok: false, meldung: 'Nicht eingeloggt' }

  const basis = import.meta.env.VITE_SUPABASE_URL as string
  try {
    const res = await fetch(`${basis}/functions/v1/morgen-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ test: true }),
    })
    const koerper = (await res.json()) as { sent?: number; error?: string; hinweis?: string }
    if (!res.ok) return { ok: false, meldung: koerper.error ?? `Fehler ${res.status}` }
    if (koerper.hinweis) return { ok: false, meldung: koerper.hinweis }
    return { ok: true, meldung: `Probe-Push an ${koerper.sent ?? 0} Gerät(e) geschickt` }
  } catch (e) {
    return { ok: false, meldung: e instanceof Error ? e.message : String(e) }
  }
}

/** Ein Satz, der den Zustand erklärt — statt eines Knopfes, der nichts tut. */
export function statusText(status: PushStatus): string {
  switch (status) {
    case 'an':
      return 'Benachrichtigungen sind an.'
    case 'aus':
      return 'Benachrichtigungen sind aus.'
    case 'blockiert':
      return 'Benachrichtigungen sind im Browser blockiert — in den Website-Einstellungen wieder erlauben.'
    case 'ios-braucht-homescreen':
      return 'Am iPhone nur aus der installierten App: Teilen → Zum Home-Bildschirm, dann hier erneut öffnen.'
    case 'kein-schluessel':
      return 'VITE_VAPID_PUBLIC_KEY fehlt im Build — ohne den Schlüssel kann sich das Gerät nicht anmelden.'
    default:
      return 'Dieser Browser kann keine Benachrichtigungen empfangen.'
  }
}
