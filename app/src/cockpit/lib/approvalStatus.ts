import type { FollowupDraft } from './approvalDrafts'

/**
 * Persistenz für den Freigaben-Status (/freigaben).
 *
 * Vorher lebte „gesendet / kopiert / verworfen" nur im React-State: ein Reload
 * setzte jede Karte auf „pending" zurück — mit dem Risiko, dieselbe Follow-up-Mail
 * ein zweites Mal an einen Lead zu schicken.
 *
 * **Stand nach O5 (06.08.2026).** Die Entwürfe hängen nicht mehr an einem
 * einzelnen lokalen Run: `FreigabenArea` liest die letzten fünf Läufe über den
 * Runs-Spiegel, damit ein unbearbeiteter Entwurf den nächsten Lauf überlebt.
 * Der Status bleibt trotzdem hier und wandert NICHT in den Spiegel — der wird
 * vom Runner geschrieben und bei jedem Lauf überschrieben; ein „erledigt" aus
 * dem Browser wäre beim nächsten Push weg. Eine eigene Tabelle wäre die saubere
 * Lösung, kostet aber eine Migration und kollidiert mit der für O3 geplanten
 * 0067 — das gehört in dieselbe Runde wie der Morgen-Push, nicht davor.
 * Gegen den geräteübergreifenden Fall sichert der sales_email_logs-Abgleich in
 * FreigabenArea.
 */

/** Status, die eine Karte endgültig abschließen — nur die werden gespeichert. */
export type PersistedStatus = 'sent' | 'copied' | 'done' | 'rejected'

const STORAGE_KEY = 'cockpit.freigaben.status.v1'
/**
 * Ältere Runs sind erledigt; ein paar bleiben für den Blick zurück.
 *
 * O5: bewusst doppelt so viele, wie die Queue an Läufen liest (5). Aussortiert
 * wird nach Reihenfolge des ersten Schreibens, nicht nach Alter des Runs — mit
 * gleichem Wert könnte ein „erledigt" auf einem älteren, noch angezeigten Lauf
 * einen jüngeren aus dem Speicher drängen, und die Karte käme wieder hoch.
 */
const KEEP_RUNS = 10

type Store = Record<string, Record<string, PersistedStatus>>

/**
 * Stabile Identität eines Entwurfs innerhalb seines Runs. Der Index allein
 * reichte nicht: LinkedIn-Entwürfe haben oft gar keine `contact_id`, und ein
 * erneutes Parsen darf die Zuordnung nicht verschieben.
 */
export function draftKey(draft: FollowupDraft, index: number): string {
  return `${index}::${draft.channel}::${draft.contact_id || draft.name || ''}`
}

function read(): Store {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Store
  } catch {
    // Kaputter/fremder Eintrag darf die Seite nicht blockieren.
    return {}
  }
}

function write(store: Store): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* Speicher voll oder gesperrt → Status bleibt für diese Sitzung im State */
  }
}

/** Gespeicherte Status eines Runs (leer, wenn nichts abgeschlossen wurde). */
export function loadRunStatuses(runId: string): Record<string, PersistedStatus> {
  return read()[runId] ?? {}
}

/** Einen abgeschlossenen Entwurf festschreiben; ältere Runs werden ausgedünnt. */
export function saveDraftStatus(runId: string, key: string, status: PersistedStatus): void {
  const store = read()
  const runIds = Object.keys(store)
  // Nur die jüngsten Runs behalten — verhindert unbegrenztes Wachstum.
  if (!store[runId] && runIds.length >= KEEP_RUNS) {
    for (const old of runIds.slice(0, runIds.length - (KEEP_RUNS - 1))) delete store[old]
  }
  store[runId] = { ...(store[runId] ?? {}), [key]: status }
  write(store)
}

/** Status eines Entwurfs zurücknehmen (z. B. „doch nicht verworfen"). */
export function clearDraftStatus(runId: string, key: string): void {
  const store = read()
  if (!store[runId]) return
  delete store[runId][key]
  write(store)
}
