/**
 * Verifikation für O11 / D6 (docs/wargames/technik-fundament.md, Zug 9).
 * Reine Funktionen, keine DB — Start: npx tsx scripts/verify-abnahme.ts
 */
import { ABNAHME_LABEL, abnahmeTitel, baueAbnahme, leseAbnahme } from '../app/src/lib/abnahme'

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

// 1. Freigabe: Präfix ohne Text.
{
  const body = baueAbnahme('freigabe', 'dlv-logo')
  check('1a body', body, '[freigabe:dlv-logo]')
  check('1b gelesen', leseAbnahme(body), { art: 'freigabe', deliverableId: 'dlv-logo', text: '' })
}

// 2. Änderungswunsch: Präfix plus Freitext, Text kommt sauber zurück.
{
  const body = baueAbnahme('aenderung', 'dlv-brand_guidelines', '  Die Farbe ist zu kalt.  ')
  check('2a body', body, '[aenderung:dlv-brand_guidelines] Die Farbe ist zu kalt.')
  check('2b text ohne praefix', leseAbnahme(body)?.text, 'Die Farbe ist zu kalt.')
  check('2c art', leseAbnahme(body)?.art, 'aenderung')
}

// 3. Mehrzeiliger Wunsch überlebt die Runde.
{
  const text = 'Zeile eins\n\nZeile zwei'
  const gelesen = leseAbnahme(baueAbnahme('aenderung', 'dlv-logo', text))
  check('3 mehrzeilig bleibt erhalten', gelesen?.text, text)
}

// 4. Normale Nachrichten bleiben normale Nachrichten.
for (const body of [
  'Hallo Kevin, kurze Frage zum Termin.',
  '[irgendwas:dlv-logo] fremder Praefix',
  '[freigabe] ohne id',
  '[freigabe:] leere id',
  'Text davor [freigabe:dlv-logo]',
  '',
]) {
  check(`4 keine Abnahme: ${JSON.stringify(body)}`, leseAbnahme(body), null)
}

// 5. Titel-Auflösung über den Katalog — ohne dass das Projekt geladen sein muss.
{
  check('5a logo', abnahmeTitel('dlv-logo'), 'Logo')
  check('5b farbpalette', abnahmeTitel('dlv-color_palette'), 'Farbpalette')
  // Eigene Positionen haben eine zufällige Id — dafür gibt es keinen Titel.
  check('5c eigene position', abnahmeTitel('a1b2c3'), 'Position')
  check('5d unbekannter typ', abnahmeTitel('dlv-gibtsnicht'), 'Position')
  check('5e eigener fallback', abnahmeTitel('a1b2c3', 'Deliverable'), 'Deliverable')
}

// 6. Labels sind vollständig (sonst rendert die UI `undefined`).
{
  check('6a freigabe', ABNAHME_LABEL.freigabe, 'Freigabe')
  check('6b aenderung', ABNAHME_LABEL.aenderung, 'Änderungswunsch')
}

console.log(`${pass}/${pass + fail} Fälle korrekt`)
if (fail > 0) process.exit(1)
