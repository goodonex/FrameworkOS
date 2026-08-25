/**
 * Wache für die festen Follow-up-Texte (25.08.2026).
 *
 * Diese Texte gehen ungelesen an Leute raus — Kevin kopiert sie aus dem
 * Cockpit und fügt sie in LinkedIn ein. Ein Fehler hier ist deshalb nicht
 * still, sondern peinlich: „Moin [Vorname]," oder „Moin --," in einer echten
 * Nachricht an einen Makler.
 *
 * Start: npx tsx scripts/verify-followup-vorlagen.ts
 */
import { FOLLOWUP_VORLAGEN, followupVorlage, vornameAus } from '../app/src/cockpit/lib/followupVorlagen'
import { FOLLOWUP_THRESHOLDS_DAYS } from '../app/src/cockpit/lib/linkedinFollowups'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

/* ── Eine Vorlage je Follow-up-Stufe ───────────────────────────────────── */
check(
  'für jede Follow-up-Stufe gibt es genau einen Text',
  FOLLOWUP_VORLAGEN.length === FOLLOWUP_THRESHOLDS_DAYS.length,
  `${FOLLOWUP_VORLAGEN.length} Texte, ${FOLLOWUP_THRESHOLDS_DAYS.length} Stufen`,
)

/* ── Kevins harte Stimm-Regeln (Skill `herrmann-outreach`) ─────────────── */
{
  const emoji = /\p{Extended_Pictographic}/u
  const verboten: [string, RegExp][] = [
    ['Rückzugsfloskel „lass dich in Ruhe"', /lass ich (dich|Sie)/i],
    ['toter Satz „weißt ja, wo du mich findest"', /wo (du|Sie) mich findest/i],
    ['Rückzug „halte dich nicht weiter auf"', /nicht weiter auf(halten|zuhalten)/i],
    ['Entschuldigung für Verspätung', /sorry|entschuldig|verzeih/i],
    ['Corporate-Weichspüler „gerne würde ich"', /gerne würde ich/i],
    ['Weichspüler „wollte mal nachfragen"', /wollte (mal )?nachfragen/i],
    ['Bittsteller „hätte ich Interesse"', /hätte ich/i],
  ]

  FOLLOWUP_VORLAGEN.forEach((text, stufe) => {
    check(`Stufe ${stufe}: keine Emojis`, !emoji.test(text), text)
    check(`Stufe ${stufe}: Anrede „Moin"`, text.startsWith('Moin [Vorname],'), text.slice(0, 30))
    check(`Stufe ${stufe}: enthält den Platzhalter`, text.includes('[Vorname]'))
    // Geduzt wird durchgehend. Auf „Sie" allein lässt sich das nicht prüfen —
    // in Stufe 1 verweist es auf die Maklerseite („Sie ist für Käufer gebaut"),
    // nicht auf den Leser. Eindeutig sind nur die Possessiv-/Dativformen der
    // Höflichkeitsanrede, und dass überhaupt eine Du-Form vorkommt.
    check(`Stufe ${stufe}: keine Höflichkeitsanrede`, !/\b(Ihnen|Ihre[mnrs]?)\b/.test(text), text)
    check(`Stufe ${stufe}: duzt erkennbar`, /\b(du|dir|dich|euch|eure[mnrs]?)\b/i.test(text), text)
    for (const [name, muster] of verboten) {
      check(`Stufe ${stufe}: ${name} kommt nicht vor`, !muster.test(text), text)
    }
    // Kurz halten: Kevins Regel ist „wäre sie kürzer besser?". Vier Sätze sind
    // für ein Follow-up die Obergrenze.
    const saetze = text.split(/[.?!]\s/).filter((t) => t.trim()).length
    check(`Stufe ${stufe}: höchstens vier Sätze`, saetze <= 4, `${saetze} Sätze`)
  })

  // Die ersten beiden Stufen wollen eine Reaktion, also endet der Text auf eine
  // Frage (CTA als letzter Satz). Stufe 2 ist selbst nur eine Frage.
  FOLLOWUP_VORLAGEN.forEach((text, stufe) => {
    check(`Stufe ${stufe}: endet auf eine Frage`, text.trimEnd().endsWith('?'), text.slice(-40))
  })
}

/* ── Kein Text ist wie der andere ──────────────────────────────────────── */
{
  const einzig = new Set(FOLLOWUP_VORLAGEN)
  check('drei verschiedene Texte, kein Duplikat', einzig.size === FOLLOWUP_VORLAGEN.length)
}

/* ── Vorname lösen ─────────────────────────────────────────────────────── */
{
  const faelle: [string | null, string | null][] = [
    ['Felix Range', 'Felix'],
    ['Bernd Benno Herrfurth', 'Bernd'],
    ['Timo  Kinzinger', 'Timo'], // doppeltes Leerzeichen steht so im Bestand
    ['  Anna   Meier ', 'Anna'],
    ['Dr. Frank Meierhofer', 'Frank'],
    ['Prof. Dr. Klaus Weber', 'Klaus'],
    ['Sven-Oliver Drasdo', 'Sven-Oliver'],
    ['BizBuilder', 'BizBuilder'], // ein Wort, aber ein gültiger Name
    ['--', null],
    ['', null],
    [null, null],
    ['   ', null],
    ['A', null], // ein Zeichen ist kein Vorname
    ['|', null],
  ]
  for (const [eingabe, erwartet] of faelle) {
    check(`Vorname aus ${JSON.stringify(eingabe)} = ${JSON.stringify(erwartet)}`, vornameAus(eingabe) === erwartet, String(vornameAus(eingabe)))
  }
}

/* ── Der fertige Entwurf ───────────────────────────────────────────────── */
{
  const e = followupVorlage({ name: 'Felix Range', followup_stage: 0 })
  check('Stufe 0 liefert einen Entwurf', Boolean(e))
  check('der Platzhalter ist ersetzt', !e?.text.includes('[Vorname]'), e?.text)
  check('der Vorname steht drin', e?.text.startsWith('Moin Felix,') === true, e?.text.slice(0, 20))
  check('eine Vorlage veraltet nicht', e?.veraltet === false)
  check('eine Vorlage behauptet kein Entstehungsdatum', e?.erstelltAm === null)
}

{
  // Der Fall, der Kevin blamieren würde.
  check('unbrauchbarer Name = kein Entwurf', followupVorlage({ name: '--', followup_stage: 0 }) === undefined)
  check('leerer Name = kein Entwurf', followupVorlage({ name: '', followup_stage: 1 }) === undefined)
}

{
  // Ab Stufe 3 übernimmt die laute Kette (Instagram, PDF, Postkarte, Anruf) —
  // ein LinkedIn-Text wäre dort der falsche Kanal.
  check('Stufe 3 bekommt keine LinkedIn-Vorlage', followupVorlage({ name: 'Felix Range', followup_stage: 3 }) === undefined)
  check('negative Stufe stürzt nicht ab', followupVorlage({ name: 'Felix Range', followup_stage: -1 }) === undefined)
  check(
    'krumme Stufe stürzt nicht ab',
    followupVorlage({ name: 'Felix Range', followup_stage: 1.5 as number }) === undefined,
  )
}

{
  // Jede Stufe liefert ihren eigenen Text — sonst bekäme derselbe Lead
  // dreimal dieselbe Nachricht, und das ist der Vorwurf, den Automation
  // verdient hat.
  const texte = [0, 1, 2].map((stufe) => followupVorlage({ name: 'Felix Range', followup_stage: stufe })?.text)
  check('drei Stufen, drei verschiedene Nachrichten', new Set(texte).size === 3, JSON.stringify(texte))
  check('alle drei sprechen den Lead mit Namen an', texte.every((t) => t?.includes('Felix')))
}

console.log(`\nverify-followup-vorlagen: ${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
