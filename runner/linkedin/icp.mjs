import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Der ICP-Filter für den Runner (18.08.2026) — Zwilling von
 * `app/src/cockpit/lib/icp.ts`, mit DERSELBEN Regel-Datei.
 *
 * Warum es ihn braucht: Der Entwurfs-Agent schrieb Antworten für jeden, der
 * zurückgeschrieben hat — auch für Coaches, Recruiter und KI-Verkäufer, die
 * Kevin akquirieren wollten. Am 18.08. waren das 9 von 30 Entwürfen; Kevins
 * Urteil: „absolute Token-Verschwendung". Ein Off-ICP bekommt jetzt keinen
 * Entwurf mehr — der Thread bleibt sichtbar, nur der Agent lässt ihn liegen.
 *
 * Die Wortlisten liegen bewusst NICHT hier, sondern in
 * `app/src/cockpit/lib/icpRegeln.json`: zwei Kopien würden auseinanderlaufen,
 * sobald Kevin einen Begriff ergänzt — und dann sortierte die Oberfläche
 * anders, als der Agent schreibt. `scripts/verify-icp.ts` prüft, dass beide
 * Seiten dieselben Urteile fällen.
 */

const HIER = dirname(fileURLToPath(import.meta.url))
const REGEL_PFAD = join(HIER, '..', '..', 'app', 'src', 'cockpit', 'lib', 'icpRegeln.json')

let regeln = null
function ladeRegeln() {
  if (regeln) return regeln
  regeln = JSON.parse(readFileSync(REGEL_PFAD, 'utf8'))
  return regeln
}

function normalisiere(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function trifft(text, liste) {
  for (const wort of liste) {
    if (text.includes(normalisiere(wort))) return wort
  }
  return null
}

/**
 * @param {string|null} headline — die LinkedIn-Headline (Feld `company`).
 * @param {string|null} [name]
 * @returns {{urteil: 'kern'|'rand'|'unklar'|'off', grund: string|null}}
 */
export function icpUrteil(headline, name) {
  const r = ladeRegeln()
  const text = normalisiere(`${headline ?? ''} ${name ?? ''}`)
  if (!text.trim()) return { urteil: 'unklar', grund: null }

  // Wettbewerb zuerst — schlägt auch die Makler-Klammer darunter.
  const hart = trifft(text, r.hart_off ?? [])
  if (hart) return { urteil: 'off', grund: hart }

  const kern = trifft(text, r.kern)
  const off = trifft(text, r.off)
  // Wer sich selbst Makler nennt, bleibt drin — auch mit „Berater" in der Zeile.
  const nenntSichMakler = /immobilienmakler|maklerbuero|makler \||\| makler|immobilienberater/.test(text)
  if (off && !nenntSichMakler) return { urteil: 'off', grund: off }
  if (kern) return { urteil: 'kern', grund: kern }
  const rand = trifft(text, r.rand)
  if (rand) return { urteil: 'rand', grund: rand }
  return { urteil: 'unklar', grund: null }
}

/** Gehört die Person in Kevins Arbeitsvorrat? `unklar` zählt bewusst dazu. */
export function istArbeitsVorrat(urteil) {
  return urteil !== 'off'
}
