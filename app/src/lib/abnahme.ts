/**
 * Deliverable-Abnahme im Kundenportal (O11 / D6, docs/wargames/technik-fundament.md).
 * Reine Funktionen, kein React, kein Supabase — per
 * `npx tsx scripts/verify-abnahme.ts` prüfbar.
 *
 * **Keine neue Tabelle, kein neues Statusfeld.** Freigabe und Änderungswunsch
 * sind strukturierte `project_messages` mit `sender_role='client'` und einem
 * Präfix im Body. Der Kunde erzeugt damit ein *Ereignis*; den Status eines
 * Deliverables ändert weiterhin ausschließlich der Owner. Beides läuft über den
 * bestehenden Sendepfad (`sendeProjektNachricht`) und die bestehenden
 * RLS-Policies aus 0038 — der Client darf dort genau `sender_role='client'`
 * einfügen.
 *
 * Warum ein Präfix und kein JSON-Body: die Nachricht muss auch dann lesbar
 * bleiben, wenn sie irgendwo ohne Badge gerendert wird (Mail-Benachrichtigung,
 * altes Portal, Datenbank-Ansicht).
 */
import { DELIVERABLE_CATALOG } from './deliverableCatalog'

export type AbnahmeArt = 'freigabe' | 'aenderung'

export interface Abnahme {
  art: AbnahmeArt
  deliverableId: string
  /** Freitext des Kunden — bei einer Freigabe in aller Regel leer. */
  text: string
}

const ABNAHME_RE = /^\[(freigabe|aenderung):([^\]]+)\]\s*([\s\S]*)$/

/** Der Text, der als `project_messages.body` in die Datenbank geht. */
export function baueAbnahme(art: AbnahmeArt, deliverableId: string, text = ''): string {
  const id = deliverableId.trim()
  const rest = text.trim()
  return rest ? `[${art}:${id}] ${rest}` : `[${art}:${id}]`
}

/** Null = eine ganz normale Nachricht. */
export function leseAbnahme(body: string): Abnahme | null {
  const m = ABNAHME_RE.exec(body.trim())
  if (!m) return null
  const deliverableId = m[2].trim()
  if (!deliverableId) return null
  return { art: m[1] as AbnahmeArt, deliverableId, text: m[3].trim() }
}

/**
 * Katalog-Deliverables tragen die stabile Id `dlv-<type>` — daraus lässt sich
 * der Titel überall auflösen, auch dort, wo das Projekt gar nicht geladen ist
 * (Posteingang über alle Projekte). Eigene Positionen haben eine zufällige Id;
 * dafür gibt es keinen Titel und die Anzeige sagt schlicht „Position".
 */
export function abnahmeTitel(deliverableId: string, fallback = 'Position'): string {
  const typ = deliverableId.startsWith('dlv-') ? deliverableId.slice(4) : null
  if (!typ) return fallback
  return DELIVERABLE_CATALOG.find((t) => t.type === typ)?.title ?? fallback
}

export const ABNAHME_LABEL: Record<AbnahmeArt, string> = {
  freigabe: 'Freigabe',
  aenderung: 'Änderungswunsch',
}
