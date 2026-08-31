/**
 * Wer wartet auf seine Erstnachricht? (31.08.2026)
 *
 * **Der Anlass.** Kevin am 31.08. mit einem Screenshot: „ERSTNACHRICHTEN ·
 * LINKEDIN — 0 von 0 ✓", während vier frisch angenommene Makler im
 * LinkedIn-Postfach lagen und 508 Angenommene ohne Nachricht in der Datenbank
 * standen. Die Kachel zählte den Entwurfs-Topf, nicht die Menschen — und der
 * Topf war leer, weil ihn nichts füllt außer Kevins Hand.
 *
 * Dieses Skript ist die erste Hälfte der Antwort: Es sagt, WER wartet. Die
 * zweite Hälfte schreibt der Agent `linkedin-erstnachrichten`.
 *
 * **Warum ein TypeScript-Kindprozess und keine .mjs im Runner.** Die Frage „wer
 * wartet" ist bereits beantwortet — in `app/src/cockpit/lib/funnelStufen.ts`,
 * derselben Funktion, die im Canvas die Karte „Erstnachricht" füllt, samt
 * Namens- und URL-Abgleich gegen Threads und schon gesendete Nachrichten. Eine
 * zweite Fassung in .mjs wäre eine zweite Wahrheit; genau daran hing der
 * 78-Erstnachrichten-Fehler vom 17.08. Ein Prozessstart je Lauf ist billiger
 * als zwei Zahlen, die auseinanderlaufen.
 *
 * Ausgabe: JSON auf stdout, `{ leads: [...], gesamt, weitereWarten }`.
 * Start: npx tsx scripts/erstnachrichten-input.ts [--limit=12]
 */
import { readFileSync } from 'node:fs'
import { ERSTNACHRICHT_STICHTAG, angenommenOhneErstnachricht, nachStichtag } from '../app/src/cockpit/lib/funnelStufen'
import { icpUrteil, istArbeitsVorrat } from '../app/src/cockpit/lib/icp'

/**
 * Wie viele Leads ein Lauf höchstens bearbeitet.
 *
 * Zwölf, nicht fünfzig: Der Agent sieht sich je Lead die Website an
 * (WebFetch/WebSearch), und ein Lauf soll in Minuten durch sein, nicht in einer
 * halben Stunde. Das ist die Grenze DIESES Laufs, kein Tagespensum — in der
 * Kachel stehen alle Wartenden (Kevin am 31.08.: „Alle raus. Sind nicht so
 * viele."). Der aufgelaufene Bestand wird über mehrere Läufe abgetragen.
 */
const STANDARD_LIMIT = 12

function argZahl(name: string, fallback: number): number {
  const roh = process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
  const n = Number(roh)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback
}

async function main() {
  const env = Object.fromEntries(
    readFileSync(new URL('../runner/.env', import.meta.url), 'utf8')
      .split('\n')
      .filter((z) => z.includes('=') && !z.trim().startsWith('#'))
      .map((z) => {
        const i = z.indexOf('=')
        return [z.slice(0, i).trim(), z.slice(i + 1).trim()] as [string, string]
      }),
  )
  const url = (env.SUPABASE_URL ?? '').replace(/\/$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen (runner/.env)')
  const kopf = { apikey: key, Authorization: `Bearer ${key}` }
  const slug = env.LINKEDIN_BRAND_SLUG ?? 'herrmann'

  /** Blättern ist Pflicht: PostgREST deckelt bei 1000, das Netzwerk hat 1.786 Zeilen. */
  async function alle<T>(pfad: string): Promise<T[]> {
    const out: T[] = []
    for (let off = 0; off < 50_000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/${pfad}&limit=1000&offset=${off}`, { headers: kopf })
      if (!res.ok) throw new Error(`GET ${pfad} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const zeilen = (await res.json()) as T[]
      out.push(...zeilen)
      if (zeilen.length < 1000) break
    }
    return out
  }

  const marken = await alle<{ id: string }>(`brands?slug=eq.${encodeURIComponent(slug)}&select=id`)
  const bid = marken[0]?.id
  if (!bid) throw new Error(`Keine Marke mit slug="${slug}"`)

  const [netzwerk, threads, erst] = await Promise.all([
    alle<any>(
      `linkedin_netzwerk?brand_id=eq.${bid}&select=name,profil_key,profile_url,status,headline,angenommen_at&order=profil_key`,
    ),
    alle<any>(`linkedin_threads?brand_id=eq.${bid}&select=name,profile_url&order=id`),
    alle<any>(`linkedin_erstnachrichten?brand_id=eq.${bid}&select=name,status&order=id`),
  ])

  const wartend = angenommenOhneErstnachricht(netzwerk, threads, erst, new Date())
  /**
   * Der ICP-Filter wie überall sonst — der Nacht-Agent meldet dieselbe Zahl
   * („37 Off-ICP übersprungen"). `unklar` bleibt drin und wird wie ICP
   * behandelt: Ein fälschlich aussortierter Makler ist ein verlorener Kunde,
   * ein fälschlich behaltener Coach kostet einen Blick.
   */
  const vorrat = wartend
    // Kevins Stichtag (31.08.): „ab Januar 26." — Begründung an der Konstante.
    .filter((p) => nachStichtag(p.seit))
    .filter((p) => istArbeitsVorrat(icpUrteil(p.info ?? '', p.name).urteil))

  /**
   * **Sichere Makler zuerst, dann die Unklaren** — und innerhalb davon die
   * Jüngsten (31.08.2026, zweiter Halbsatz von „nur da wo es sinn macht").
   *
   * Der Wortlisten-Filter urteilt `unklar`, sobald kein Off-Wort fällt; im
   * Vorrat sind das über die Hälfte, und der erste echte Lauf hat davon 6 von
   * 12 aussortiert. Nähme der Agent stur die Jüngsten, ginge der halbe Lauf für
   * Fitness-Coaches drauf, und Kevin fände morgens sechs Texte statt zwölf.
   * Mit dieser Reihenfolge liegt zuerst brauchbares Material da; die Unklaren
   * kommen dran, wenn die Sicheren durch sind — aussortiert werden müssen sie
   * ohnehin, aber sie halten dann niemanden auf.
   *
   * Innerhalb einer Gruppe die Jüngsten zuerst: Wer gestern angenommen hat,
   * erinnert sich an die Anfrage; bei einer Annahme aus dem Februar ist sie
   * eine Randnotiz.
   */
  const rang = { kern: 0, rand: 1, unklar: 2, off: 3 } as const
  const sortiert = [...vorrat].sort((a, b) => {
    const ra = rang[icpUrteil(a.info ?? '', a.name).urteil] ?? 9
    const rb = rang[icpUrteil(b.info ?? '', b.name).urteil] ?? 9
    if (ra !== rb) return ra - rb
    return String(b.seit ?? '').localeCompare(String(a.seit ?? ''))
  })
  const limit = argZahl('limit', STANDARD_LIMIT)
  const auswahl = sortiert.slice(0, limit)

  process.stdout.write(
    JSON.stringify({
      stichtag: ERSTNACHRICHT_STICHTAG,
      gesamt: sortiert.length,
      weitereWarten: Math.max(0, sortiert.length - auswahl.length),
      leads: auswahl.map((p) => ({
        /** PFLICHT im Rückgabe-Block — daran hängt der Runner die Zeile. */
        profil_key: p.key,
        name: p.name,
        headline: p.info,
        profile_url: p.profileUrl,
        angenommen_vor_tagen: p.tage,
        icp: icpUrteil(p.info ?? '', p.name).urteil,
      })),
    }),
  )
}

void main().catch((e) => {
  console.error(String(e?.message ?? e))
  process.exit(1)
})
