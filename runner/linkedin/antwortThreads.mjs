import { icpUrteil, istArbeitsVorrat } from './icp.mjs'

/**
 * runner/linkedin/antwortThreads.mjs — Eingabe für den Antwort-Entwürfe-Agenten.
 *
 * Läuft im Runner (nachts, ohne Cockpit), deshalb muss die Frage „welche Threads
 * warten auf Kevins Antwort?" hier ein zweites Mal beantwortet werden — die
 * maßgebliche Fassung ist `bucketOf(...) === 'du_bist_dran'` in
 * app/src/cockpit/lib/linkedinFollowups.ts.
 *
 * Damit daraus keine zweite, driftende Wahrheit wird, ist die Regel als EINE
 * reine Funktion (`istDuBistDran`) isoliert und wird von
 * `npx tsx scripts/verify-antwort-entwuerfe.ts` Fall für Fall gegen `bucketOf`
 * gegengeprüft. Weicht eine Seite ab, schlägt das Skript fehl.
 */

/**
 * Höchstens so viele Threads gehen in einen Lauf — ein Agent, ein überschaubarer
 * Auftrag.
 *
 * **Von 20 auf 10 gesenkt am 14.08.2026.** Der Lauf ist seit dem 04.08. jeden
 * Morgen ins 10-Minuten-Limit gerannt („ZEITLIMIT ERREICHT") und hat damit gar
 * nichts geliefert. Zehn fertige Entwürfe sind mehr als zwanzig abgebrochene.
 *
 * **Am 19.08.2026 auf 18 angehoben.** Kevins Befund: In seiner Antworten-Spur
 * standen echte Makler ohne Entwurf (Evernest-Lizenzpartner, Kloppestates),
 * weil der Deckel vor ihnen zuging — „ich versteh gar nicht, warum da kein
 * Entwurf da ist, so bringt mir das Ganze nix." Der Lauf vom 19.08. brauchte
 * für zehn Entwürfe 2:21 Minuten; 18 passen mit Reserve ins 10-Minuten-Limit.
 * Zugleich schrumpft der Vorrat dauerhaft, weil `agent_urteil = 'akquise'`
 * unten dauerhaft aussortiert.
 */
export const ANTWORT_MAX = 18

/**
 * Hat der Thread schon einen brauchbaren Entwurf?
 *
 * Das war der eigentliche Grund für den Stau: Die Auswahl kannte nur „wartet auf
 * Kevin", nicht „ist schon entworfen". Also nahm sich der Agent jeden Morgen
 * dieselben 20 ältesten Threads erneut vor, schrieb Entwürfe, die längst am
 * Posten hingen, und kam nie zu den 21 dahinter.
 *
 * Veraltet heißt: der Lead hat NACH dem Entwurf noch einmal geschrieben — dann
 * antwortet der alte Text auf eine überholte Nachricht und muss neu.
 */
export function hatFrischenEntwurf(thread) {
  const text = typeof thread.entwurf === 'string' ? thread.entwurf.trim() : ''
  if (!text) return false
  if (!thread.entwurf_at || !thread.last_message_at) return true
  return new Date(thread.entwurf_at).getTime() >= new Date(thread.last_message_at).getTime()
}

/**
 * Ist die Person überhaupt Kevins Zielgruppe? (18.08.2026)
 *
 * Der Agent schrieb bis heute für JEDEN, der zurückgeschrieben hat — auch für
 * Coaches, Recruiter und KI-Verkäufer, die Kevin akquirieren wollten. Von 30
 * erzeugten Entwürfen gingen 9 an solche Profile, darunter „Hi Angelique,
 * wonach bist du auf der Suche in der Gründerkommune?". Kevins Urteil:
 * „absolute Token-Verschwendung".
 *
 * `unklar` zählt bewusst als Zielgruppe: Die Headline ist Freitext, und ein
 * fälschlich übergangener Makler ist teurer als ein Entwurf zu viel. Der
 * Thread selbst bleibt in jedem Fall sichtbar — gefiltert wird nur, wofür der
 * Agent Zeit und Token ausgibt.
 */
function istZielgruppe(thread) {
  return istArbeitsVorrat(icpUrteil(thread.company, thread.name).urteil)
}

/**
 * Hat der Agent den Thread schon als Akquise-Versuch erkannt? (19.08.2026)
 *
 * Der Wortlisten-Filter oben sieht nur die Headline, und die verrät die
 * Absicht oft nicht: „Schritt für Schritt ein erfolgreiches Unternehmen
 * aufbauen" liest sich harmlos — im Chat steht ein Verkaufsversuch. Wer da
 * schreibt, weiss nur, wer die NACHRICHT gelesen hat. Genau das tut der Agent,
 * und sein Urteil (Migration 0075) gilt ab dann dauerhaft: Kevin soll denselben
 * Verkäufer nicht jeden Morgen erneut vorgelegt bekommen.
 *
 * Bewusst ohne Verfallsdatum. Schreibt ein Akquisiteur erneut, ist er immer
 * noch Akquisiteur — eine zweite Nachricht macht aus ihm keinen Lead.
 */
function istAkquiseVersuch(thread) {
  return thread.agent_urteil === 'akquise'
}

/** Endzustände: hier ist nichts mehr zu tun (Spiegel von `isTerminal`). */
function istEndzustand(status) {
  return status === 'archived' || status === 'won' || status === 'lost'
}

/**
 * Der Lead hat geschrieben und wartet auf Kevin. Spiegel des `du_bist_dran`-Zweigs
 * aus `bucketOf`: Endzustand und Schlummer stechen, danach entscheidet allein
 * `last_from === 'them'` — eine Antwort schlägt jede Follow-up-Stufe.
 */
export function istDuBistDran(thread, now) {
  if (istEndzustand(thread.status)) return false
  if (thread.snoozed_until != null && new Date(thread.snoozed_until).getTime() > now.getTime()) return false
  return thread.last_from === 'them'
}

/** Tage seit der letzten Nachricht — über Millisekunden, nie über Kalendertage. */
function tageSeit(iso, now) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000))
}

/**
 * Baut den Agenten-Input. `verlauf` wird als Array durchgereicht, nicht zu Text
 * gerendert — der Skill liest das Format direkt, und so gibt es keine zweite
 * Formatierungslogik neben der Cockpit-Seite.
 */
export function baueAntwortInput(threads, now = new Date(), max = ANTWORT_MAX) {
  // Gleiche Rangfolge wie `dringlichkeit` in prioritaet.ts: Stern zuerst, dann
  // der am längsten Wartende. Nur so decken die entworfenen Threads exakt die
  // obersten Posten der Arbeitsliste ab — sonst hinge der Entwurf am falschen Namen.
  const dran = threads
    // Wer schon einen frischen Entwurf hat, ist erledigte Arbeit — er blockiert
    // sonst jeden Lauf und der Rückstau dahinter kommt nie dran.
    .filter((t) => istDuBistDran(t, now) && !hatFrischenEntwurf(t))
    .sort((a, b) => {
      const stern = Number(Boolean(b.starred)) - Number(Boolean(a.starred))
      if (stern !== 0) return stern
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : Number.POSITIVE_INFINITY
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : Number.POSITIVE_INFINITY
      return ta - tb
    })

  return {
    weitereWarten: Math.max(0, dran.length - max),
    input: {
      threads: dran.slice(0, max).map((t) => ({
        thread_key: t.thread_key,
        contact_id: t.contact_id ?? null,
        name: t.name,
        company: t.company,
        profile_url: t.profile_url,
        preview: t.preview,
        verlauf: Array.isArray(t.verlauf) ? t.verlauf : [],
        tage_seit_antwort: tageSeit(t.last_message_at, now),
        followup_stage: t.followup_stage,
        starred: Boolean(t.starred),
        loom_status: t.loom_status ?? 'offen',
      })),
    },
  }
}

/**
 * Holt die wartenden Threads über PostgREST. Grob vorgefiltert auf der DB-Seite,
 * die endgültige Entscheidung trifft `istDuBistDran` — es gibt genau eine Regel.
 * `select=*` mit Absicht: die Spalte `verlauf` (0064) darf noch fehlen, ohne dass
 * die Abfrage mit HTTP 400 auffliegt.
 */
export async function holeAntwortThreads({ supabaseUrl, headers, brandSlug = 'herrmann', now = new Date() }) {
  const br = await fetch(
    `${supabaseUrl}/rest/v1/brands?slug=eq.${encodeURIComponent(brandSlug)}&select=id&limit=1`,
    { headers },
  )
  if (!br.ok) throw new Error(`Brand-Abfrage HTTP ${br.status}`)
  const [brand] = await br.json()
  if (!brand?.id) throw new Error(`Kein Brand mit slug="${brandSlug}"`)

  const res = await fetch(
    `${supabaseUrl}/rest/v1/linkedin_threads?brand_id=eq.${brand.id}&last_from=eq.them` +
      `&status=in.(active,waiting_reply)&select=*&order=last_message_at.asc`,
    { headers },
  )
  if (!res.ok) throw new Error(`linkedin_threads HTTP ${res.status}`)
  const rows = await res.json()

  const wartend = rows.filter((t) => istDuBistDran(t, now))
  const threads = wartend.filter((t) => istZielgruppe(t) && !istAkquiseVersuch(t))
  // Die Zahl gehört ins Lauf-Ergebnis, nicht ins Nichts: Wenn der Filter eines
  // Tages zu scharf greift, sieht man es an dieser Zeile und nicht daran, dass
  // ein Kunde nie eine Antwort bekam.
  return { brandId: brand.id, threads, uebersprungenOffIcp: wartend.length - threads.length }
}
