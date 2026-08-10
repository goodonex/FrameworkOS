import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSalesLibrary, type SalesLibrary } from '../../lib/salesLibraryApi'
import type { Contact } from '../../../types/db'

/**
 * Ressourcen am Lead (Phase 2, Zug B4 · D8).
 *
 * Dieselbe Quelle wie der Bereich „Ressourcen" (`/sales/bibliothek`, Runner
 * bzw. sein Spiegel) — nur gefiltert auf das, was zu diesem Lead passt. Es
 * entsteht **keine neue Datenhaltung**: kein zweiter Endpunkt, keine Kopie der
 * Skripte am Kontakt.
 *
 * Die Zuordnung ist bewusst simpel und erklärbar: die Pipeline-Stufe des Leads
 * bringt Stichwörter mit, und getroffen wird, was diese Stichwörter im
 * Dateinamen trägt. Findet sich nichts, steht hier die volle Liste statt einer
 * leeren Karte — im Zweifel ist ein Griff zu viel besser als keiner.
 */

/** Stichwörter je Stufe. Nur Dateinamen-Treffer, keine Inhaltsanalyse. */
const STICHWORTE: Record<Contact['pipeline_stage'], string[]> = {
  first_contact: ['erstnachricht', 'erstkontakt', 'outreach', 'anfrage'],
  conversation: ['quali', 'erstgespräch', 'erstgespraech', 'discovery'],
  follow_up: ['follow', 'nachfass', 'loom'],
  proposal: ['angebot', 'pitch', 'closing', 'sales-call', 'wertanalyse'],
  deal: ['onboarding', 'vertrag', 'closing'],
  paused: ['reaktivier', 'follow'],
}

export function RessourcenPanel({ contact }: { contact: Contact }) {
  const [lib, setLib] = useState<SalesLibrary | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    let abgebrochen = false
    fetchSalesLibrary()
      .then((l) => {
        if (!abgebrochen) setLib(l)
      })
      .catch((e: Error) => {
        if (!abgebrochen) setFehler(e.message)
      })
    return () => {
      abgebrochen = true
    }
  }, [])

  const treffer = useMemo(() => {
    if (!lib) return []
    const worte = STICHWORTE[contact.pipeline_stage] ?? []
    const alle = [
      ...lib.skripte.map((s) => ({ name: s.name, id: s.rel })),
      ...lib.vault.map((v) => ({ name: v.name, id: v.path })),
    ]
    const passend = alle.filter((e) => {
      const n = e.name.toLowerCase()
      return worte.some((w) => n.includes(w))
    })
    // Lieber die volle Liste als eine leere Karte.
    return (passend.length > 0 ? passend : alle).slice(0, 6)
  }, [lib, contact.pipeline_stage])

  return (
    <section className="ck-panel" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span className="ck-label">Ressourcen</span>
        <Link to="/sales/bibliothek" style={{ fontSize: 11, color: 'var(--ck-accent-text)', textDecoration: 'none' }}>
          Alle
        </Link>
      </div>

      {fehler ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ck-text-2)' }}>
          Ressourcen nicht erreichbar — der Runner muss dafür einmal gelaufen sein.
        </p>
      ) : !lib ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ck-text-2)' }}>Lädt …</p>
      ) : treffer.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ck-text-2)' }}>Noch keine Skripte abgelegt.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {treffer.map((t) => (
            <li key={t.id}>
              <Link
                to={`/sales/bibliothek?f=${encodeURIComponent(t.id)}`}
                style={{
                  display: 'block',
                  fontSize: 12.5,
                  color: 'var(--ck-text-1)',
                  textDecoration: 'none',
                  padding: '7px 0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
