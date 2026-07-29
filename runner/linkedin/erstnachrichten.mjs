/**
 * Liest Kevins Vault-Datei mit den versandfertigen LinkedIn-Erstnachrichten und
 * macht daraus eine Arbeitsliste.
 *
 * Die Datei ist die Quelle der Wahrheit für den TEXT (der `linkedin-leads`-Skill
 * schreibt sie). Den STATUS — verschickt oder nicht — führt die Datenbank, damit
 * Kevin seine Stelle nicht mehr im Fließtext suchen muss und sie auch auf dem
 * Handy kennt.
 *
 * Erwartetes Format (so liegt es im Vault):
 *   ## Gruppe 9 — Neuzugänge LinkedIn (Stand 20.07.2026)
 *   ### Vorname Nachname — Firma — website.de
 *   ```
 *   Moin Vorname, …
 *   ```
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

/** Findet die neueste "LinkedIn-Leads Erstnachrichten"-Datei im Vertriebs-Ordner. */
export async function findeQuelldatei(vaultPfad) {
  const ordner = join(vaultPfad, '03 Bereiche', 'Vertrieb & Outreach')
  let namen
  try {
    namen = await readdir(ordner)
  } catch {
    return null
  }
  const treffer = namen.filter((n) => /^LinkedIn-Leads Erstnachrichten.*\.md$/i.test(n))
  if (!treffer.length) return null

  let neueste = null
  for (const n of treffer) {
    const p = join(ordner, n)
    const s = await stat(p)
    if (!neueste || s.mtimeMs > neueste.mtimeMs) neueste = { pfad: p, name: n, mtimeMs: s.mtimeMs }
  }
  return neueste
}

/** Zerlegt den Dateiinhalt in einzelne Leads, in Dateireihenfolge. */
export function parseErstnachrichten(text) {
  const zeilen = text.split('\n')
  const leads = []
  let gruppe = ''
  let aktuell = null
  let inBlock = false
  let block = []

  const abschliessen = () => {
    if (!aktuell) return
    const nachricht = block.join('\n').trim()
    if (nachricht) leads.push({ ...aktuell, nachricht })
    aktuell = null
    block = []
  }

  for (const zeile of zeilen) {
    if (zeile.startsWith('## ')) {
      abschliessen()
      // "## Gruppe 9 — Neuzugänge LinkedIn (Stand 20.07.2026)" → kompakt halten
      gruppe = zeile.slice(3).trim()
      continue
    }
    if (zeile.startsWith('### ')) {
      abschliessen()
      // "Name — Firma — website.de" · Klammer-Zusätze bleiben am Feld hängen
      const kopf = zeile.slice(4).trim()
      const teile = kopf.split('—').map((t) => t.trim())
      aktuell = {
        gruppe,
        name: teile[0] ?? kopf,
        firma: teile[1] ?? '',
        website: teile[2] ?? '',
        sortIndex: leads.length,
      }
      inBlock = false
      block = []
      continue
    }
    if (!aktuell) continue
    if (zeile.trimStart().startsWith('```')) {
      // Erster Zaun öffnet, zweiter schließt und beendet damit den Lead.
      if (!inBlock) {
        inBlock = true
      } else {
        inBlock = false
        abschliessen()
      }
      continue
    }
    if (inBlock) block.push(zeile)
  }
  abschliessen()

  // sortIndex nach dem Sammeln vergeben — die Dateireihenfolge ist Kevins Reihenfolge.
  return leads.map((l, i) => ({ ...l, sortIndex: i }))
}

/**
 * Zählt die frisch angenommenen Kontakte, für die noch KEIN Text existiert.
 * Die stehen in Gruppen ohne Code-Zäune als Aufzählung unter Kategorie-
 * Überschriften — sie sind noch nicht versendbar, aber genau die Arbeit, die
 * als Nächstes ansteht ("wer hat neu angenommen").
 */
export function zaehleOhneText(text) {
  const bloecke = text.split(/^## /m).slice(1)
  let offen = 0
  let gruppe = ''
  for (const b of bloecke) {
    // Nur echte Lead-Gruppen — nicht die Einleitungs-Abschnitte (Datenlage,
    // Umsatzpotenzial), die ebenfalls Aufzählungen enthalten.
    if (!/^Gruppe\s/i.test(b)) continue
    if (b.includes('```')) continue // hat Texte → schon abgearbeitet vom Parser
    const zeilen = b.split('\n')
    // Nur Personen zählen, keine Off-ICP-Aussortierten.
    let inOffIcp = false
    let n = 0
    for (const z of zeilen) {
      if (z.startsWith('### ')) inOffIcp = /off-icp/i.test(z)
      else if (!inOffIcp && /^\s*[-*]\s+/.test(z)) n++
    }
    if (n > 0) {
      offen += n
      gruppe = zeilen[0].trim()
    }
  }
  return { anzahl: offen, gruppe }
}

export async function ladeErstnachrichten(vaultPfad) {
  const datei = await findeQuelldatei(vaultPfad)
  if (!datei) return { datei: null, leads: [], ohneText: { anzahl: 0, gruppe: '' } }
  const text = await readFile(datei.pfad, 'utf8')
  return {
    datei: datei.name,
    leads: parseErstnachrichten(text),
    ohneText: zaehleOhneText(text),
  }
}
