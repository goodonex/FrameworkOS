import { useEffect, useState } from 'react'
import { fetchSalesLibrary } from '../lib/salesLibraryApi'
import type { RunnerState } from '../lib/useRunnerStatus'

type Entry = { name: string; group: 'vault' | 'skripte'; key: string; mtime: string }

/** Schnellzugriff auf die 4 neuesten Bibliothek-Einträge, springt in /sales/bibliothek. */
export function BibliothekQuickPanel({
  runnerState,
  onOpen,
}: {
  runnerState: RunnerState
  onOpen: (key: string) => void
}) {
  const offline = runnerState !== 'online'
  const [entries, setEntries] = useState<Entry[] | null>(null)

  useEffect(() => {
    if (runnerState !== 'online') return
    let cancelled = false
    void fetchSalesLibrary()
      .then((lib) => {
        if (cancelled) return
        const all: Entry[] = [
          ...lib.vault.map((f) => ({ name: f.name, group: 'vault' as const, key: f.path, mtime: f.mtime })),
          ...lib.skripte.map((f) => ({ name: f.name, group: 'skripte' as const, key: f.rel, mtime: f.mtime })),
        ]
        all.sort((a, b) => (a.mtime < b.mtime ? 1 : -1))
        setEntries(all.slice(0, 4))
      })
      .catch(() => setEntries([]))
    return () => {
      cancelled = true
    }
  }, [runnerState])

  return (
    <section className="ck-panel" aria-label="Bibliothek — Schnellzugriff">
      <div className="ck-label" style={{ padding: '10px 12px 6px' }}>
        Bibliothek
      </div>
      {offline ? (
        <p style={{ padding: '0 12px 10px', margin: 0, color: 'var(--ck-text-3)', fontSize: 12 }}>
          Runner offline · Bibliothek nicht erreichbar
        </p>
      ) : !entries ? (
        <p style={{ padding: '0 12px 10px', margin: 0, color: 'var(--ck-text-3)', fontSize: 12 }}>Lädt…</p>
      ) : entries.length === 0 ? (
        <p style={{ padding: '0 12px 10px', margin: 0, color: 'var(--ck-text-3)', fontSize: 12 }}>
          Noch keine Dateien gefunden.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {entries.map((e, i) => (
            <button
              key={`${e.group}-${e.key}`}
              onClick={() => onOpen(e.key)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                background: 'none',
                border: 'none',
                borderBottom: i === entries.length - 1 ? 'none' : '1px solid var(--ck-border)',
                color: 'var(--ck-text-1)',
                fontFamily: 'var(--ck-font)',
                fontSize: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
              <span className="ck-label" style={{ flexShrink: 0 }}>
                {e.group === 'vault' ? 'Vault' : 'Vorlage'}
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => onOpen('')}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          borderTop: '1px solid var(--ck-border)',
          padding: '8px 12px',
          cursor: 'pointer',
          color: 'var(--ck-accent)',
          fontFamily: 'var(--ck-font)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Alle anzeigen →
      </button>
    </section>
  )
}
