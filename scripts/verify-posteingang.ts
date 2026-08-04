/**
 * Verifikation für Etappe 4, Schritt 3: Kunden-Posteingang.
 * Start: npx tsx scripts/verify-posteingang.ts
 *
 * Deckt die reine Logik ab: Wartezeit + 24-h-Frist, Sortierung der
 * Warteschlange, Alt-Neu-Vergleich, Zählung je Projekt.
 */
import {
  ANTWORT_FRIST_STUNDEN,
  beschreibeAenderung,
  ordnePosteingang,
  wartetSeit,
  zaehleJeProjekt,
  zaehleNachrichten,
  type PosteingangEintrag,
} from '../app/src/cockpit/lib/posteingang'

const JETZT = new Date('2026-08-04T12:00:00Z')
const vorStunden = (h: number) => new Date(JETZT.getTime() - h * 3600_000).toISOString()

let fehler = 0
function pruefe(label: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  const ok = a === b
  if (!ok) fehler++
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `\n    ist:  ${a}\n    soll: ${b}`}`)
}

// --- Wartezeit + 24-h-Versprechen ------------------------------------------
pruefe('frisch → gerade eben, nicht überfällig', wartetSeit(vorStunden(0.2), JETZT), {
  stunden: 0,
  label: 'gerade eben',
  ueberfaellig: false,
})
pruefe('5 h → Stundenangabe, noch in der Frist', wartetSeit(vorStunden(5), JETZT), {
  stunden: 5,
  label: 'seit 5 h',
  ueberfaellig: false,
})
// Die Grenze ist der ganze Punkt: 23 h ist ok, 24 h bricht das Portal-Versprechen.
pruefe('23 h → noch in der Frist', wartetSeit(vorStunden(23), JETZT).ueberfaellig, false)
pruefe('24 h → überfällig', wartetSeit(vorStunden(ANTWORT_FRIST_STUNDEN), JETZT).ueberfaellig, true)
pruefe('exakt 24 h → „seit gestern"', wartetSeit(vorStunden(24), JETZT).label, 'seit gestern')
pruefe('72 h → „seit 3 Tagen"', wartetSeit(vorStunden(72), JETZT).label, 'seit 3 Tagen')
pruefe('kein Zeitstempel stürzt nicht ab', wartetSeit(null, JETZT).label, 'gerade eben')
pruefe('Datenmüll stürzt nicht ab', wartetSeit('kein-datum', JETZT).label, 'gerade eben')

// --- Sortierung der Warteschlange -------------------------------------------
function eintrag(over: Partial<PosteingangEintrag> & { id: string; seit: string }): PosteingangEintrag {
  return {
    art: 'nachricht',
    projektId: 'p1',
    projektName: 'Projekt',
    titel: 'Kunde',
    text: 'Hallo',
    alt: null,
    neu: null,
    bereich: null,
    ...over,
  }
}

const gemischt: PosteingangEintrag[] = [
  eintrag({ id: 'neu', seit: vorStunden(1) }),
  eintrag({ id: 'alt', seit: vorStunden(50), art: 'website' }),
  eintrag({ id: 'mittel', seit: vorStunden(10) }),
]
pruefe(
  'ältester Posten zuerst — Art spielt keine Rolle',
  ordnePosteingang(gemischt).map((e) => e.id),
  ['alt', 'mittel', 'neu'],
)

// Stabilität: gleiche Zeit darf über Reloads nicht umspringen.
const gleichzeitig = [
  eintrag({ id: 'b', seit: vorStunden(3) }),
  eintrag({ id: 'a', seit: vorStunden(3) }),
]
pruefe(
  'gleicher Zeitstempel → stabile Reihenfolge über die ID',
  ordnePosteingang(gleichzeitig).map((e) => e.id),
  ['a', 'b'],
)
pruefe('Sortieren verändert die Eingabe nicht', gemischt.map((e) => e.id), ['neu', 'alt', 'mittel'])
pruefe('leere Liste bleibt leer', ordnePosteingang([]), [])

// --- Alt-Neu-Vergleich ------------------------------------------------------
pruefe('leer → Text = neu befüllt', beschreibeAenderung(null, 'Hallo Welt'), {
  art: 'hinzugefuegt',
  zeichenDelta: 10,
})
pruefe('Text → leer = geleert', beschreibeAenderung('Hallo Welt', ''), {
  art: 'entfernt',
  zeichenDelta: -10,
})
pruefe('Text → anderer Text = geändert', beschreibeAenderung('Hallo', 'Hallo Welt'), {
  art: 'geaendert',
  zeichenDelta: 5,
})
// Reine Leerraum-Änderung ist keine Änderung — sonst stünde ein Posten in der
// Queue, bei dem Kevin keinen Unterschied sieht.
pruefe('nur Leerraum → unverändert', beschreibeAenderung('Hallo', '  Hallo  '), {
  art: 'unveraendert',
  zeichenDelta: 0,
})
pruefe('beide leer → unverändert', beschreibeAenderung(null, null), {
  art: 'unveraendert',
  zeichenDelta: 0,
})

// --- Zählung ----------------------------------------------------------------
const ueberProjekte: PosteingangEintrag[] = [
  eintrag({ id: 'm1', seit: vorStunden(2), projektId: 'p1' }),
  eintrag({ id: 'm2', seit: vorStunden(3), projektId: 'p1' }),
  eintrag({ id: 'w1', seit: vorStunden(4), projektId: 'p2', art: 'website' }),
]
pruefe(
  'Zähler je Projekt zählt beide Arten',
  [...zaehleJeProjekt(ueberProjekte).entries()].sort(),
  [['p1', 2], ['p2', 1]],
)
pruefe('Projekt ohne Posten taucht nicht auf', zaehleJeProjekt(ueberProjekte).get('p3'), undefined)
pruefe('Heute-Deck zählt nur Nachrichten', zaehleNachrichten(ueberProjekte), 2)
pruefe('Heute-Deck bei leerer Liste', zaehleNachrichten([]), 0)

console.log(fehler === 0 ? '\nPosteingang-Logik stimmt.' : `\n${fehler} Fehler.`)
process.exit(fehler === 0 ? 0 : 1)
