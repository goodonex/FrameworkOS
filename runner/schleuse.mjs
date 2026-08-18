/**
 * Die Schleuse: einmal vorne prüfen statt hinten viermal scheitern (18.08.2026)
 *
 * **Der Fehler, den das behebt.** Kevins Satz: „Auch dass die Agenten immer
 * einzeln scheitern — können wir nicht einen vorab checken lassen, ob wir
 * angemeldet sind und überall reinkommen, und erst dann die anderen loslegen?"
 *
 * Genau das war das Bild der letzten Wochen: Am 12./13.08. lief die Anmeldung
 * der Claude-CLI ab, und JEDER Agent stellte das für sich selbst fest — jeder
 * mit eigener Run-Datei, eigener roter Zeile, eigenem Verbrauch am Tagesdeckel.
 * Vier Zeilen für einen einzigen Umstand, und die Ursache stand nur in der
 * Mitschrift, nicht in der Liste.
 *
 * Die Schleuse dreht das um: Was ALLE Agenten brauchen, wird einmal geprüft.
 * Ist sie zu, startet keiner — es gibt eine Meldung statt vier, und der
 * Tagesdeckel bleibt unangetastet, weil kein Lauf entsteht.
 *
 * **Was sie NICHT prüft, und warum.** Ob LinkedIn im Sync-Chrome noch
 * angemeldet ist, ließe sich nur durch einen echten Seitenaufruf feststellen.
 * Das wäre ein zusätzlicher Zugriff auf Kevins Konto pro Prüfung — genau das
 * Muster, für das am 17.08. schon einmal vier Sieben-Minuten-Läufe in einer
 * Viertelstunde durch sein Postfach gingen. Die Login-Wall meldet weiterhin der
 * Lauf, der sie tatsächlich trifft (`linkedin/sync.mjs`).
 *
 * Die Bewertung ist rein; die beiden CLI-Prüfungen nehmen ihren Prozessstarter
 * als Parameter (`laufImpl`), damit auch „abgemeldet", „Kontingent erschöpft"
 * und „CLI antwortet nicht" geprüft werden können, ohne Kevins echte Anmeldung
 * anzufassen: `npx tsx scripts/verify-schleuse.ts`.
 */
import { spawn } from 'node:child_process'
import { access, constants } from 'node:fs/promises'

/**
 * Ein Kommando mit hartem Deckel — die Schleuse darf nie das werden, worauf
 * gewartet wird. Liefert immer ein Ergebnis, wirft nie.
 */
function lauf(befehl, args, { timeoutMs = 20_000, env } = {}) {
  return new Promise((fertig) => {
    let aus = ''
    let fehler = ''
    let erledigt = false
    const schliesse = (code, grund) => {
      if (erledigt) return
      erledigt = true
      clearTimeout(t)
      fertig({ code, aus, fehler, grund })
    }
    let p
    try {
      p = spawn(befehl, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      return fertig({ code: null, aus: '', fehler: String(e?.message ?? e), grund: 'start' })
    }
    const t = setTimeout(() => {
      try {
        p.kill('SIGKILL')
      } catch {
        /* schon weg */
      }
      schliesse(null, 'timeout')
    }, timeoutMs)
    p.stdout.on('data', (c) => (aus += c))
    p.stderr.on('data', (c) => (fehler += c))
    p.on('error', (e) => schliesse(null, String(e?.message ?? e)))
    p.on('close', (code) => schliesse(code, null))
  })
}

/**
 * Ist die Claude-CLI angemeldet?
 *
 * `claude auth status --json` antwortet in rund vier Zehntelsekunden aus lokalem
 * Zustand — kein Modell, kein Token, kein Netz. Deshalb darf diese Prüfung vor
 * jedem Lauf stehen.
 */
export async function pruefeAnmeldung({ claudeBin = 'claude', pfad, timeoutMs = 20_000, laufImpl = lauf } = {}) {
  const r = await laufImpl(claudeBin, ['auth', 'status', '--json'], {
    timeoutMs,
    env: pfad ? { ...process.env, PATH: pfad } : process.env,
  })
  if (r.grund === 'timeout') {
    return { was: 'Anmeldung', ok: false, meldung: 'Anmelde-Abfrage antwortet nicht', hinweis: 'Im Terminal `claude auth status` prüfen', handeln: true }
  }
  let daten = null
  try {
    daten = JSON.parse(r.aus.trim())
  } catch {
    /* unten behandelt */
  }
  if (!daten) {
    return {
      was: 'Anmeldung',
      ok: false,
      meldung: `Anmeldestatus nicht lesbar${r.code !== 0 ? ` (Exit ${r.code})` : ''}`,
      hinweis: 'Im Terminal `claude auth status` prüfen',
      handeln: true,
    }
  }
  if (!daten.loggedIn) {
    return { was: 'Anmeldung', ok: false, meldung: 'Claude-CLI ist abgemeldet', hinweis: 'Im Terminal `claude` neu anmelden', handeln: true }
  }
  return { was: 'Anmeldung', ok: true, meldung: `angemeldet als ${daten.email ?? 'unbekannt'}` }
}

/**
 * Kommt die CLI wirklich durch? — der eine echte Zug pro Tag.
 *
 * `auth status` liest nur lokalen Zustand: Eine Sitzung, die erst beim
 * Zugriff als abgelaufen auffällt, sieht dort noch gültig aus — genau die Form,
 * in der der Ausfall am 12.08. auftrat („OAuth session expired and could not
 * refresh"). Ein winziger echter Lauf klärt das, und weil er nichts liest und
 * nichts schreibt, kostet er Bruchteile eines Cents.
 *
 * Bewusst **einmal pro Tag** und nicht bei jeder Prüfung: Ein Ping alle fünf
 * Minuten wären dreihundert CLI-Starts am Tag — die Schleuse wäre teurer als
 * das Problem.
 */
export async function pruefeDurchgang({ claudeBin = 'claude', pfad, timeoutMs = 120_000, laufImpl = lauf } = {}) {
  const r = await laufImpl(claudeBin, ['-p', 'Antworte mit genau einem Wort: ok', '--output-format', 'text'], {
    timeoutMs,
    env: pfad ? { ...process.env, PATH: pfad } : process.env,
  })
  const text = `${r.aus}\n${r.fehler}`
  if (r.grund === 'timeout') {
    return { was: 'Durchgang', ok: false, meldung: 'CLI antwortet nicht', hinweis: 'Netz prüfen; der nächste Versuch läuft von selbst', handeln: false }
  }
  if (/OAuth session expired|Failed to authenticate|authentication_error|Invalid API key|not logged in/i.test(text)) {
    return { was: 'Durchgang', ok: false, meldung: 'Anmeldung abgelaufen', hinweis: 'Im Terminal `claude` neu anmelden', handeln: true }
  }
  if (/rate.?limit|usage limit|quota exceeded|insufficient credit|overloaded_error/i.test(text)) {
    return { was: 'Durchgang', ok: false, meldung: 'Kontingent erschöpft', hinweis: 'Der nächste Versuch läuft wieder', handeln: false }
  }
  if (r.code !== 0) {
    return { was: 'Durchgang', ok: false, meldung: `CLI-Probelauf scheitert (Exit ${r.code})`, hinweis: 'Mitschrift im Log ansehen', handeln: true }
  }
  return { was: 'Durchgang', ok: true, meldung: 'CLI kommt durch' }
}

/** Antwortet die Datenbank? Ohne sie hat kein Agent Eingabedaten. */
export async function pruefeSupabase({ url, key, timeoutMs = 8000, fetchImpl = fetch } = {}) {
  if (!url || !key) {
    return { was: 'Datenbank', ok: true, meldung: 'nicht eingerichtet — übersprungen' }
  }
  try {
    const ab = new AbortController()
    const t = setTimeout(() => ab.abort(), timeoutMs)
    try {
      const res = await fetchImpl(`${url}/rest/v1/runner_snapshots?select=key&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: ab.signal,
      })
      if (!res.ok) {
        return { was: 'Datenbank', ok: false, meldung: `Supabase antwortet mit HTTP ${res.status}`, hinweis: 'Key in runner/.env prüfen', handeln: res.status === 401 || res.status === 403 }
      }
      return { was: 'Datenbank', ok: true, meldung: 'erreichbar' }
    } finally {
      clearTimeout(t)
    }
  } catch {
    return { was: 'Datenbank', ok: false, meldung: 'Supabase nicht erreichbar', hinweis: 'Erledigt sich mit dem Netz von selbst', handeln: false }
  }
}

/**
 * Liegt der Vault da, wo die Agenten schreiben?
 *
 * Der Ordner hängt an iCloud. Ein nicht geladener Ordner ist kein theoretischer
 * Fall — er ist der Grund, warum „Code nie in den Vault" überhaupt eine Regel
 * in Kevins Setup ist.
 */
export async function pruefeVault(runsDir) {
  try {
    await access(runsDir, constants.W_OK)
    return { was: 'Vault', ok: true, meldung: 'beschreibbar' }
  } catch {
    return { was: 'Vault', ok: false, meldung: 'Run-Ordner nicht beschreibbar', hinweis: 'Liegt der Vault (iCloud) lokal vor?', handeln: true }
  }
}

/**
 * Aus den Einzelbefunden ein Urteil — rein, damit es prüfbar bleibt.
 *
 * Die Reihenfolge der Befunde ist die Reihenfolge der Meldung: Was Kevin von
 * Hand beheben muss (`handeln`), steht vorn, sonst wäre die Zeile „Datenbank
 * nicht erreichbar" das Erste, was er morgens liest, während in Wahrheit die
 * Anmeldung hängt.
 */
export function bewerteSchleuse(befunde) {
  const rot = (befunde ?? []).filter((b) => b && !b.ok)
  rot.sort((a, b) => Number(Boolean(b.handeln)) - Number(Boolean(a.handeln)))
  return {
    offen: rot.length === 0,
    rot,
    grund: rot.map((b) => b.meldung).join(' · '),
    handeln: rot.some((b) => b.handeln),
    hinweis: rot.find((b) => b.handeln)?.hinweis ?? rot[0]?.hinweis ?? '',
  }
}
