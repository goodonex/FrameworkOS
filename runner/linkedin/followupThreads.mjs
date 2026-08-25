import { icpUrteil, istArbeitsVorrat } from './icp.mjs'
import { hatFrischenEntwurf } from './antwortThreads.mjs'

/**
 * runner/linkedin/followupThreads.mjs — Eingabe für den Follow-up-Entwürfe-Agenten.
 *
 * **Warum es diese Datei gibt (25.08.2026).** An Prod gemessen: 177 Threads
 * waren fällig zum Nachfassen, **null** davon hatten einen Entwurf. Alle 239
 * aktiven Threads standen auf `followup_stage: 0`, und `daily_metrics.li_followups`
 * war an jedem der letzten 21 Tage 0 — bei gleichzeitig 30 Anfragen pro Tag.
 *
 * Die Ursache war keine Disziplin, sondern eine Lücke im Ablauf. Kevins
 * Arbeitsweise ist: Cockpit öffnen, Text kopieren, in LinkedIn einfügen. Steht
 * kein Text da, gibt es nichts zu kopieren, also passiert nichts. Der Agent
 * `linkedin-followup-entwuerfe` existierte seit Langem — aber nur hinter einem
 * Knopf, den man erst drücken muss. Die Antwort-Entwürfe laufen seit dem 18.08.
 * werktags von selbst; die Follow-ups nicht. Diese Datei schliesst genau das.
 *
 * Wie beim Antwort-Zwilling muss die Frage „welcher Thread ist fällig?" hier ein
 * zweites Mal beantwortet werden (der Runner läuft ohne Cockpit). Die
 * massgebliche Fassung ist `isDue` / `bucketOf(...) === 'faellig'` in
 * app/src/cockpit/lib/linkedinFollowups.ts; `istFaellig` unten ist ihr Spiegel
 * und wird von `npx tsx scripts/verify-followup-entwuerfe.ts` Fall für Fall
 * gegen das Original gegengeprüft. Weicht eine Seite ab, schlägt das Skript fehl.
 */

/** Spiegel von `FOLLOWUP_THRESHOLDS_DAYS` — Stufe 0 nach 3, Stufe 1 nach 7, Stufe 2 nach 14 Tagen. */
export const SCHWELLEN_TAGE = [3, 7, 14]

/**
 * Höchstens so viele Threads gehen in einen Lauf.
 *
 * **Zwanzig, weil zwanzig Kevins Tagesportion ist** (`FOLLOWUP_PORTION_TAG` in
 * tagesFlow.ts, unabhängig davon am 25.08. noch einmal von ihm genannt: „so
 * zwanzig am Tag"). Mehr zu entwerfen hiesse, Token für Text auszugeben, den er
 * heute nicht verschickt — und der bis morgen veraltet, wenn der Lead
 * dazwischen antwortet.
 *
 * Zum Zeitbudget: Der Antwort-Agent schaffte am 19.08. zehn Entwürfe in 2:21
 * Min bei deutlich mehr Kontext je Thread (ganzer `verlauf`). Follow-ups
 * brauchen nur `preview`, zwanzig passen also mit Reserve ins 10-Minuten-Limit.
 */
export const FOLLOWUP_MAX = 20

/** Endzustände: hier ist nichts mehr zu tun (Spiegel von `isTerminal`). */
function istEndzustand(status) {
  return status === 'archived' || status === 'won' || status === 'lost'
}

/**
 * Ist die Person überhaupt Kevins Zielgruppe?
 *
 * Hier wiegt der Filter schwerer als beim Antwort-Zwilling: Unter den 177
 * fälligen Threads stecken Altlasten von bis zu 539 Tagen aus der Zeit vor der
 * Makler-Akquise. Ohne Filter entwirft der Agent seine zwanzig Nachrichten für
 * Leute, die Kevin nie wieder anschreiben will, und die echten Makler dahinter
 * kommen wieder nicht dran — genau der Fehler vom 18.08.
 *
 * `unklar` zählt bewusst als Zielgruppe: Ein übergangener Makler ist teurer als
 * ein Entwurf zu viel.
 */
function istZielgruppe(thread) {
  return istArbeitsVorrat(icpUrteil(thread.company, thread.name).urteil)
}

/** Vom Agenten dauerhaft aussortierte Akquise-Versuche (Migration 0075). */
function istAkquiseVersuch(thread) {
  return thread.agent_urteil === 'akquise'
}

/**
 * Kevin hat zuletzt geschrieben, und die Frist der aktuellen Stufe ist um.
 * Spiegel von `isDue`: `waiting_reply` zählt hier ausdrücklich NICHT als
 * fällig — dort ist im Original `status === 'active'` Bedingung.
 */
export function istFaellig(thread, now) {
  if (thread.status !== 'active') return false
  if (istEndzustand(thread.status)) return false
  if (thread.last_from !== 'me') return false
  if (thread.last_message_at == null) return false
  if (thread.followup_stage > 2) return false
  if (thread.snoozed_until != null && new Date(thread.snoozed_until).getTime() > now.getTime()) return false
  const schwelle = SCHWELLEN_TAGE[thread.followup_stage]
  if (schwelle == null) return false
  const vergangen = now.getTime() - new Date(thread.last_message_at).getTime()
  return vergangen >= schwelle * 24 * 60 * 60 * 1000
}

/**
 * Ab wann Kevin auf Makler arbeitet (Spiegel von `AKQUISE_START` in
 * app/src/cockpit/lib/arbeitsmodusQuellen.ts).
 *
 * **Hier wird damit sortiert, nicht gefiltert — und das ist der ganze Punkt.**
 * Die Cockpit-Fassung nutzt das Datum, um die ANTWORTEN-Spur zu säubern, und
 * sagt ausdrücklich dazu: für Threads, die Kevin selbst angeschrieben hat, gilt
 * weiter „nichts, was liegen geblieben ist, fällt weg". Diese Regel bleibt
 * unangetastet.
 *
 * Der Trockenlauf vom 25.08. zeigte trotzdem ein Problem: Unter den 165
 * fälligen Threads der Zielgruppe stecken Altlasten von bis zu 539 Tagen
 * („Vertriebs-Champion", „salesHAX Consulting", „5-10KG Fett in 90 Tagen") aus
 * der Zeit vor der Makler-Akquise. Bei „ältester zuerst" hätten genau die die
 * ersten zwanzig Entwürfe des Tages belegt — und die echten Makler dahinter
 * wären wieder nicht drangekommen. Das ist derselbe Fehler wie am 18.08., nur
 * an einer anderen Stelle.
 *
 * Wer die Entwürfe des Tages bekommt, ist eine Frage der Reihenfolge, nicht der
 * Zugehörigkeit. Die Altlast bleibt im Vorrat und kommt dran, sobald der
 * Rückstau davor abgetragen ist.
 */
export const AKQUISE_START = '2026-01-01'

/** Stammt der Thread aus der Makler-Ära? */
function ausDerMaklerZeit(thread) {
  return thread.last_message_at != null && thread.last_message_at >= AKQUISE_START
}

/** Tage seit der letzten Nachricht — über Millisekunden, nie über Kalendertage. */
function tageSeit(iso, now) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((now.getTime() - t) / (24 * 60 * 60 * 1000))
}

/**
 * Baut den Agenten-Input.
 *
 * Sortierung in drei Stufen: **Stern zuerst** (Kevins eigene Markierung sticht
 * alles), dann **Makler-Ära vor Altlast** (siehe `AKQUISE_START` oben), dann
 * innerhalb jeder Gruppe **der am längsten Liegende**.
 *
 * Die mittlere Stufe ist am 25.08. dazugekommen und der Grund, warum diese
 * Funktion nicht einfach `dringlichkeit` spiegelt: Dort geht es um die
 * Reihenfolge der Arbeitsliste, hier um die Vergabe von zwanzig Entwürfen pro
 * Tag. Ein knappes Gut wird anders verteilt als eine vollständige Liste
 * geordnet.
 */
export function baueFollowupInput(threads, now = new Date(), max = FOLLOWUP_MAX) {
  const dran = threads
    // Wer schon einen frischen Entwurf hat, ist erledigte Arbeit. Ohne diesen
    // Filter nimmt sich der Agent jeden Morgen dieselben zwanzig vor und der
    // Rückstau dahinter kommt nie dran (die Lehre vom 14.08.).
    .filter((t) => istFaellig(t, now) && !hatFrischenEntwurf(t))
    .sort((a, b) => {
      const stern = Number(Boolean(b.starred)) - Number(Boolean(a.starred))
      if (stern !== 0) return stern
      const aera = Number(ausDerMaklerZeit(b)) - Number(ausDerMaklerZeit(a))
      if (aera !== 0) return aera
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : Number.POSITIVE_INFINITY
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : Number.POSITIVE_INFINITY
      return ta - tb
    })

  return {
    weitereWarten: Math.max(0, dran.length - max),
    input: {
      threads: dran.slice(0, max).map((t) => ({
        // PFLICHT: `schreibeEntwuerfe` ordnet ausschliesslich über diesen
        // Schlüssel zu. Ein Entwurf ohne thread_key wird still verworfen.
        thread_key: t.thread_key,
        contact_id: t.contact_id ?? null,
        name: t.name,
        company: t.company,
        profile_url: t.profile_url,
        preview: t.preview,
        // Der Verlauf ist beim Follow-up wichtiger als beim Antwort-Zwilling:
        // `preview` ist hier Kevins EIGENE letzte Nachricht, sagt über die
        // Gegenseite also nichts. Ohne den Verlauf urteilt der Agent allein
        // nach der Headline — und die lügt (Lehre vom 19.08.).
        verlauf: Array.isArray(t.verlauf) ? t.verlauf : [],
        tage_seit_kontakt: tageSeit(t.last_message_at, now),
        followup_stage: t.followup_stage,
        starred: Boolean(t.starred),
      })),
    },
  }
}

/**
 * Holt die fälligen Threads über PostgREST. Grob vorgefiltert auf der DB-Seite,
 * die endgültige Entscheidung trifft `istFaellig` — es gibt genau eine Regel.
 */
export async function holeFollowupThreads({ supabaseUrl, headers, brandSlug = 'herrmann', now = new Date() }) {
  const br = await fetch(
    `${supabaseUrl}/rest/v1/brands?slug=eq.${encodeURIComponent(brandSlug)}&select=id&limit=1`,
    { headers },
  )
  if (!br.ok) throw new Error(`Brand-Abfrage HTTP ${br.status}`)
  const [brand] = await br.json()
  if (!brand?.id) throw new Error(`Kein Brand mit slug="${brandSlug}"`)

  const res = await fetch(
    `${supabaseUrl}/rest/v1/linkedin_threads?brand_id=eq.${brand.id}&last_from=eq.me` +
      `&status=eq.active&select=*&order=last_message_at.asc`,
    { headers },
  )
  if (!res.ok) throw new Error(`linkedin_threads HTTP ${res.status}`)
  const rows = await res.json()

  const faellig = rows.filter((t) => istFaellig(t, now))
  const threads = faellig.filter((t) => istZielgruppe(t) && !istAkquiseVersuch(t))
  // Die Zahl gehört ins Protokoll, nicht ins Nichts: Greift der Filter eines
  // Tages zu scharf, sieht man es an dieser Zeile und nicht daran, dass ein
  // Makler nie nachgefasst bekam.
  return { brandId: brand.id, threads, uebersprungenOffIcp: faellig.length - threads.length }
}
