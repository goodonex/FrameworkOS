/**
 * Verifikation für Wargame Zug 1 (docs/wargames/sales-arbeitsmodus.md).
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-prioritaet.ts
 */
import { ordnePosten, tagesstand, type Posten } from '../app/src/cockpit/lib/prioritaet'

const NOW = new Date('2026-07-29T12:00:00Z')
const dayAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

let idSeq = 0
function makePosten(overrides: Partial<Posten>): Posten {
  idSeq += 1
  return {
    id: `posten-${idSeq}`,
    spur: 'antwort',
    name: 'Test Kontakt',
    text: 'Text',
    timestamp: dayAgo(1),
    ...overrides,
  }
}

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

// 1. Kundenaufgabe steht über jeder Antwort.
{
  const liste = ordnePosten(
    {
      kundenaufgabe: [makePosten({ spur: 'kundenaufgabe', id: 'ka1' })],
      antwort: [makePosten({ spur: 'antwort', id: 'a1' })],
    },
    NOW,
  )
  check('1 kundenaufgabe vor antwort', liste[0].id, 'ka1')
  check('1b antwort danach', liste[1].id, 'a1')
}

// 2. Antwort steht über jedem Loom.
{
  const liste = ordnePosten(
    {
      antwort: [makePosten({ spur: 'antwort', id: 'a1' })],
      loom: [makePosten({ spur: 'loom', id: 'l1' })],
    },
    NOW,
  )
  check('2 antwort vor loom', liste[0].id, 'a1')
  check('2b loom danach', liste[1].id, 'l1')
}

// 3. Innerhalb der Antworten steht die älteste oben.
{
  const liste = ordnePosten(
    {
      antwort: [
        makePosten({ spur: 'antwort', id: 'jung', timestamp: dayAgo(1) }),
        makePosten({ spur: 'antwort', id: 'alt', timestamp: dayAgo(5) }),
      ],
    },
    NOW,
  )
  check('3 aeltestes zuerst', liste[0].id, 'alt')
  check('3b juengstes danach', liste[1].id, 'jung')
}

// 4. Ein Stern-Thread steht über einem gleich alten ohne Stern (innerhalb derselben Spur).
{
  const liste = ordnePosten(
    {
      antwort: [
        makePosten({ spur: 'antwort', id: 'ohne_stern', timestamp: dayAgo(3), starred: false }),
        makePosten({ spur: 'antwort', id: 'mit_stern', timestamp: dayAgo(3), starred: true }),
      ],
    },
    NOW,
  )
  check('4 stern vor gleich altem ohne stern', liste[0].id, 'mit_stern')
  check('4b ohne stern danach', liste[1].id, 'ohne_stern')
}

// 5. Volle Rangfolge über alle acht Spuren.
{
  const liste = ordnePosten(
    {
      kundenaufgabe: [makePosten({ spur: 'kundenaufgabe', id: 'r1' })],
      kunde_liegt: [makePosten({ spur: 'kunde_liegt', id: 'r2' })],
      antwort: [makePosten({ spur: 'antwort', id: 'r3' })],
      loom: [makePosten({ spur: 'loom', id: 'r4' })],
      erstnachricht: [makePosten({ spur: 'erstnachricht', id: 'r5' })],
      followup: [makePosten({ spur: 'followup', id: 'r6' })],
      anfrage: [makePosten({ spur: 'anfrage', id: 'r7' })],
      inmail: [makePosten({ spur: 'inmail', id: 'r8' })],
    },
    NOW,
  )
  check('5 volle rangfolge', liste.map((p) => p.id), ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'])
}

// 6. Fehlende Quelle lässt nur ihre Spur leer, bricht nicht die ganze Liste ab.
{
  const liste = ordnePosten(
    {
      kundenaufgabe: [makePosten({ spur: 'kundenaufgabe', id: 'ka1' })],
      // loom fehlt komplett (z. B. Migration 0061 nicht eingespielt)
      erstnachricht: [makePosten({ spur: 'erstnachricht', id: 'e1' })],
    },
    NOW,
  )
  check('6 fehlende spur bricht nicht ab', liste.map((p) => p.id), ['ka1', 'e1'])
}

// 7. ordnePosten gibt ALLES zurück, kein Tagespensum, keine Kürzung.
{
  const viele = Array.from({ length: 200 }, (_, i) => makePosten({ spur: 'erstnachricht', id: `e${i}`, timestamp: dayAgo(i) }))
  const liste = ordnePosten({ erstnachricht: viele }, NOW)
  check('7 keine kuerzung auf tagespensum', liste.length, 200)
}

// 8. tagesstand() zeigt nur an, schneidet nichts ab; inmailCredits als Bestand (RECON-1).
{
  const stand = tagesstand({ li_anfragen: 12 })
  check('8a anfragenHeute', stand.anfragenHeute, 12)
  check('8b anfragenLimit fest 30', stand.anfragenLimit, 30)
  check('8c inmailCredits default 150', stand.inmailCredits, 150)
  const standMitBestand = tagesstand({ li_anfragen: 0 }, 84)
  check('8d inmailCredits ueberschreibbar', standMitBestand.inmailCredits, 84)
}

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
