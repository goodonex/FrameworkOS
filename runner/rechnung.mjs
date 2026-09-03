/**
 * Rechnungen aus dem Cockpit (02.09.2026)
 *
 * Der Abschluss passiert im Call: Der Makler sagt zu, und die Rechnung mit
 * GiroCode soll rausgehen, solange die Zusage warm ist. Diese Bruecke ruft dafuer
 * den bestehenden Generator unter `~/rechnungen/` auf — dieselbe Maschine, die
 * auch der `rechnung`-Skill benutzt. Hier wird nichts nachgebaut: Nummernkreis,
 * DIN-5008-Layout und QR-Code liegen dort und bleiben dort.
 *
 * Zwei Dinge sind anders als bei einem gewoehnlichen Endpunkt:
 *
 * 1. **Jeder Lauf verbraucht eine Rechnungsnummer.** Nummern sind fortlaufend
 *    und duerfen keine Luecken haben; ein Doppelklick waere also kein
 *    Schoenheitsfehler, sondern eine Luecke in der Buchhaltung. Deshalb die
 *    Dublettensperre unten.
 * 2. **Python liegt in einer eigenen Umgebung.** Homebrew-Python verbietet
 *    globale Installs (PEP 668), reportlab und segno stecken im venv.
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export const RECHNUNG_ROOT = resolve(process.env.RECHNUNG_ROOT ?? join(homedir(), 'rechnungen'))
const VENV_PYTHON = join(RECHNUNG_ROOT, '.venv', 'bin', 'python')
const PAKETE_DATEI = join(RECHNUNG_ROOT, 'pakete.json')
const LOG_DATEI = join(RECHNUNG_ROOT, 'rechnungs_log.json')
export const OUTPUT_DIR = join(RECHNUNG_ROOT, 'output')

/** Laeuft die Rechnungsmaschine auf diesem Rechner? */
export function rechnungBereit() {
  return existsSync(VENV_PYTHON) && existsSync(join(RECHNUNG_ROOT, 'rechnung_generator.py'))
}

/** Die hinterlegten Standardpakete. Ohne Datei eine leere Liste, kein Absturz. */
export async function ladePakete() {
  try {
    const roh = JSON.parse(await readFile(PAKETE_DATEI, 'utf8'))
    return Object.entries(roh)
      .filter(([schluessel]) => !schluessel.startsWith('_'))
      .map(([schluessel, p]) => ({
        schluessel,
        titel: p.titel ?? schluessel,
        beschreibung: p.beschreibung ?? '',
        einzelpreis: Number(p.einzelpreis ?? 0),
        wiederkehrend: p.wiederkehrend ?? null,
      }))
  } catch {
    return []
  }
}

/** Die bisher erstellten Rechnungen, neueste zuerst. */
export async function listeRechnungen(limit = 50) {
  try {
    const log = JSON.parse(await readFile(LOG_DATEI, 'utf8'))
    const zeilen = Array.isArray(log?.rechnungen) ? log.rechnungen : []
    return [...zeilen].reverse().slice(0, limit)
  } catch {
    return []
  }
}

const text = (wert, max = 200) => String(wert ?? '').trim().slice(0, max)

/**
 * Dublettensperre: Gab es heute schon dieselbe Rechnung an denselben Kunden?
 *
 * Greift auf Kunde + Bruttobetrag + Tag. Das faengt den Doppelklick und den
 * "hat er es abgeschickt?"-Zweitversuch, laesst aber eine bewusste zweite
 * Rechnung ueber `erzwingen` durch — etwa Anzahlung und Restbetrag am selben
 * Tag, die sich ohnehin im Betrag unterscheiden.
 */
async function findeDublette(kundeName, brutto) {
  const heute = new Date().toISOString().slice(0, 10)
  const bisher = await listeRechnungen(200)
  return (
    bisher.find(
      (r) =>
        String(r.kunde ?? '') === kundeName &&
        Number(r.brutto) === Number(brutto) &&
        String(r.erstellt_am ?? '').slice(0, 10) === heute,
    ) ?? null
  )
}

/**
 * Erstellt eine Rechnung und gibt Nummer, Datei und Betraege zurueck.
 *
 * @param {object} auftrag
 * @param {object} auftrag.kunde        { firma, strasse, plz, ort }
 * @param {string} auftrag.paket        Schluessel aus pakete.json
 * @param {number} [auftrag.betrag]     ueberschreibt den Paketpreis
 * @param {string} [auftrag.leistungszeitraum]
 * @param {boolean} [auftrag.erzwingen] Dublettensperre uebergehen
 */
export async function erstelleRechnung(auftrag = {}) {
  if (!rechnungBereit()) {
    throw new Error(`Rechnungsmaschine fehlt unter ${RECHNUNG_ROOT} — Skill "rechnung" eingerichtet?`)
  }

  const kunde = auftrag.kunde ?? {}
  const firma = text(kunde.firma)
  if (!firma) throw new Error('Rechnungsempfänger fehlt')
  const strasse = text(kunde.strasse)
  const plz = text(kunde.plz, 10)
  const ort = text(kunde.ort, 80)
  if (!strasse || !plz || !ort) {
    throw new Error('Rechnungsanschrift unvollständig — Straße, PLZ und Ort werden gebraucht')
  }

  const pakete = await ladePakete()
  const paket = pakete.find((p) => p.schluessel === auftrag.paket)
  if (!paket) throw new Error(`Unbekanntes Paket: ${auftrag.paket}`)

  const betrag = Number(auftrag.betrag ?? paket.einzelpreis)
  if (!Number.isFinite(betrag) || betrag <= 0) throw new Error('Ungültiger Betrag')

  if (!auftrag.erzwingen) {
    const dublette = await findeDublette(firma, betrag)
    if (dublette) {
      const fehler = new Error(
        `Heute wurde für ${firma} bereits ${dublette.rechnungsnummer} über ${dublette.brutto} EUR erstellt.`,
      )
      fehler.code = 'dublette'
      fehler.vorhandene = dublette
      throw fehler
    }
  }

  const daten = {
    kunde: { firma, strasse, plz, ort },
    positionen: [{ beschreibung: paket.beschreibung, menge: 1, einzelpreis: betrag }],
    leistungszeitraum: text(auftrag.leistungszeitraum) || undefined,
  }

  // Der Generator wird als Bibliothek aufgerufen, nicht als Skript: So bleibt
  // sein Rueckgabewert (Nummer, Pfad, Betraege) strukturiert statt geparst.
  const code = [
    'import sys, json',
    'sys.path.insert(0, ".")',
    'from rechnung_generator import erstelle_rechnung',
    'print("__ERGEBNIS__" + json.dumps(erstelle_rechnung(json.load(sys.stdin))))',
  ].join('\n')

  const ergebnis = await new Promise((fertig, fehler) => {
    const p = spawn(VENV_PYTHON, ['-c', code], { cwd: RECHNUNG_ROOT })
    let aus = ''
    let err = ''
    const frist = setTimeout(() => {
      p.kill('SIGKILL')
      fehler(new Error('Rechnungslauf hat nicht geantwortet (60 s)'))
    }, 60_000)

    p.stdout.on('data', (d) => (aus += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', (e) => {
      clearTimeout(frist)
      fehler(new Error(`Python nicht startbar: ${e?.message ?? e}`))
    })
    p.on('close', (code) => {
      clearTimeout(frist)
      if (code !== 0) return fehler(new Error(err.trim().split('\n').pop() || `Python endete mit ${code}`))
      const zeile = aus.split('\n').find((z) => z.startsWith('__ERGEBNIS__'))
      if (!zeile) return fehler(new Error('Kein Ergebnis vom Generator'))
      try {
        fertig(JSON.parse(zeile.slice('__ERGEBNIS__'.length)))
      } catch (e) {
        fehler(new Error(`Ergebnis unlesbar: ${e?.message ?? e}`))
      }
    })

    p.stdin.end(JSON.stringify(daten))
  })

  return {
    rechnungsnummer: ergebnis.rechnungsnummer,
    datei: ergebnis.datei,
    dateiname: String(ergebnis.datei ?? '').split('/').pop(),
    netto: ergebnis.netto,
    brutto: ergebnis.brutto,
    paket: paket.schluessel,
    titel: paket.titel,
  }
}
