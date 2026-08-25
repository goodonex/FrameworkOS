import { icpUrteil } from './icp.mjs'

/**
 * runner/linkedin/sortierThreads.mjs — Eingabe für den Sortier-Agenten.
 *
 * **Der Auftrag (Kevin, 25.08.2026):** *„Den Agenten, der vorsortiert, mach den
 * auf jeden Fall. Den werden wir brauchen. Und der muss gut sein. Da darf
 * keiner wegfallen. Lieber einer zu viel als einer zu wenig, aber auch nicht
 * zu lasch."*
 *
 * Zwei Sätze, die sich widersprechen — und genau darin liegt der Zuschnitt.
 * „Keiner darf wegfallen" heißt: hoher Recall, im Zweifel bleibt der Lead drin.
 * „Nicht zu lasch" heißt: die eindeutigen Fälle müssen wirklich fallen, sonst
 * filtert der Agent nichts und war umsonst. Aufgelöst wird das nicht über eine
 * Schwelle, sondern über **Begründungspflicht**: Wer aussortieren will, muss
 * in einem Halbsatz sagen warum. Ein Urteil, das man begründen muss, fällt
 * vorsichtiger aus als eines, das man nur ankreuzt.
 *
 * **Warum der Agent AUCH die vom Wortfilter Aussortierten sieht.** Das ist der
 * Kern und der Unterschied zu allen bisherigen Filtern hier. `icpUrteil` liest
 * nur die Headline, und die Headline lügt in beide Richtungen: Sie lässt
 * Fitness-Coaches durch („Als Unternehmer 5-10KG Fett in 90 Tagen" stand am
 * 25.08. mitten in der fälligen Liste) und sie wirft Makler raus, die sich
 * ungewöhnlich beschreiben („Addicted to selling Houses and deep Housemusic",
 * „Do what you love. Love what you do."). Ein Agent, der nur die Durchgelassenen
 * prüft, kann den zweiten Fehler nie korrigieren — und genau der ist der teure.
 * Deshalb bekommt er den ganzen Stapel, mit dem Wortlisten-Urteil als
 * **Hinweis**, nicht als Vorentscheidung.
 *
 * Der Agent schreibt hier **keine Texte**. Das ist der ganze Trick: Urteilen
 * ohne Formulieren ist ein Bruchteil des Aufwands, also passen sechzig Threads
 * in einen Lauf statt zwanzig.
 */

/**
 * Höchstens so viele Threads gehen in einen Lauf.
 *
 * Der Antwort-Agent schaffte am 19.08. zehn *Entwürfe* in 2:21 Min. Ein Urteil
 * ist ein Bruchteil davon — kein Text, keine Website-Recherche, nur lesen und
 * einsortieren. Sechzig passen mit Reserve ins 10-Minuten-Limit, und der
 * Bestand von 200 offenen Urteilen ist damit in gut drei Läufen abgetragen.
 */
export const SORTIER_MAX = 60

/** Endzustände: über die urteilt niemand mehr. */
function istEndzustand(status) {
  return status === 'archived' || status === 'won' || status === 'lost'
}

/**
 * Braucht dieser Thread ein Urteil?
 *
 * Genau einmal je Thread. Ein Urteil gilt dauerhaft (Migration 0075) — schreibt
 * ein Akquisiteur erneut, ist er immer noch Akquisiteur, und Kevin soll
 * denselben Verkäufer nicht jede Woche neu vorgelegt bekommen. Wer ein Urteil
 * hat, kommt hier also nie wieder vor; korrigiert wird von Hand in der
 * Lead-Akte.
 */
export function brauchtUrteil(thread) {
  if (istEndzustand(thread.status)) return false
  const bestehend = typeof thread.agent_urteil === 'string' ? thread.agent_urteil.trim() : ''
  return bestehend === ''
}

/**
 * Baut den Agenten-Input.
 *
 * Reihenfolge: erst die Zweifelsfälle, dann der Rest. `unklar` und `off` sind
 * die beiden Gruppen, in denen der Wortfilter tatsächlich etwas entscheidet —
 * und damit die beiden, in denen er sich irren kann. Die `kern`-Fälle sind
 * meist echte Makler und können warten, ohne dass Schaden entsteht.
 */
export function baueSortierInput(threads, max = SORTIER_MAX) {
  const rang = { unklar: 0, off: 1, rand: 2, kern: 3 }

  const dran = threads
    .filter(brauchtUrteil)
    .map((t) => ({ t, wort: icpUrteil(t.company, t.name) }))
    .sort((a, b) => {
      const r = (rang[a.wort.urteil] ?? 9) - (rang[b.wort.urteil] ?? 9)
      if (r !== 0) return r
      // Innerhalb der Gruppe: der am längsten Wartende zuerst.
      const ta = a.t.last_message_at ? new Date(a.t.last_message_at).getTime() : Number.POSITIVE_INFINITY
      const tb = b.t.last_message_at ? new Date(b.t.last_message_at).getTime() : Number.POSITIVE_INFINITY
      return ta - tb
    })

  return {
    weitereWarten: Math.max(0, dran.length - max),
    input: {
      threads: dran.slice(0, max).map(({ t, wort }) => ({
        thread_key: t.thread_key,
        name: t.name,
        // Die LinkedIn-Headline. Heisst historisch `company`, ist aber Freitext.
        headline: t.company,
        profile_url: t.profile_url,
        // Der Verlauf ist das eigentliche Beweismittel: Wer da schreibt, steht
        // in den Nachrichten, nicht in der Selbstbeschreibung.
        verlauf: Array.isArray(t.verlauf) ? t.verlauf : [],
        preview: t.preview,
        /**
         * Was die Wortlisten sagen — ausdrücklich als HINWEIS, nicht als
         * Vorgabe. Der Agent darf und soll widersprechen; genau dafür ist er da.
         */
        wortfilter: wort.urteil,
        wortfilter_grund: wort.grund ?? null,
      })),
    },
  }
}

/**
 * Holt alle aktiven Threads ohne Urteil. Ohne Vorfilterung auf der DB-Seite:
 * Der Agent soll gerade auch die sehen, die der Wortfilter aussortiert hätte.
 */
export async function holeSortierThreads({ supabaseUrl, headers, brandSlug = 'herrmann' }) {
  const br = await fetch(
    `${supabaseUrl}/rest/v1/brands?slug=eq.${encodeURIComponent(brandSlug)}&select=id&limit=1`,
    { headers },
  )
  if (!br.ok) throw new Error(`Brand-Abfrage HTTP ${br.status}`)
  const [brand] = await br.json()
  if (!brand?.id) throw new Error(`Kein Brand mit slug="${brandSlug}"`)

  const rows = []
  // Blättern, ausnahmslos: PostgREST deckelt bei 1.000 Zeilen.
  for (let von = 0; ; von += 1000) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/linkedin_threads?brand_id=eq.${brand.id}` +
        `&status=in.(active,waiting_reply)&select=*&order=id`,
      { headers: { ...headers, Range: `${von}-${von + 999}` } },
    )
    if (!res.ok) throw new Error(`linkedin_threads HTTP ${res.status}`)
    const teil = await res.json()
    rows.push(...teil)
    if (teil.length < 1000) break
  }

  return { brandId: brand.id, threads: rows.filter(brauchtUrteil) }
}
