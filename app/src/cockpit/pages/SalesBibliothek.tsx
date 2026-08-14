import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchOsFile, obsidianUrl, openInObsidian } from '../lib/runnerApi'
import { fetchSalesLibrary, salesFileUrl, type SalesLibrary } from '../lib/salesLibraryApi'
import { useRunnerStatus } from '../lib/useRunnerStatus'

type SelectionKey = { group: 'vault'; path: string } | { group: 'skripte'; rel: string; kind: 'md' | 'html' | 'pdf' }

function selectionKeyToParam(sel: SelectionKey): string {
  return sel.group === 'vault' ? sel.path : sel.rel
}

/** Kopiert Text ins Clipboard; Fallback über verstecktes Textarea, wenn die Clipboard-API blockiert ist. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

/** Splittet eine Vault-MD an `### `-Headings: Prolog als Intro, danach eine Karte je Abschnitt. */
/**
 * YAML-Frontmatter abschneiden. Die Vault-Notizen beginnen mit einem
 * `---`-Block (tags, status, erstellt, übergeordnet) — reine Ablage-Metadaten,
 * die im Skript-Fenster oben als erster Absatz standen und beim „Nachricht
 * kopieren" des ersten Abschnitts mit in der Zwischenablage landeten.
 *
 * Nur der Block ganz am Anfang, und nur mit schliessender Zeile: ein Dokument,
 * das mit einer Trennlinie arbeitet, wird nicht angeschnitten.
 */
export function ohneFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content
  const zeilen = content.split('\n')
  if (zeilen[0].trim() !== '---') return content
  const ende = zeilen.findIndex((z, i) => i > 0 && z.trim() === '---')
  if (ende === -1) return content
  return zeilen.slice(ende + 1).join('\n').replace(/^\n+/, '')
}

function splitSections(content: string): Array<{ heading: string | null; body: string }> {
  const lines = ohneFrontmatter(content).split('\n')
  const sections: Array<{ heading: string | null; body: string }> = []
  let current: { heading: string | null; body: string[] } = { heading: null, body: [] }
  for (const line of lines) {
    if (line.startsWith('### ')) {
      sections.push({ heading: current.heading, body: current.body.join('\n').trim() })
      current = { heading: line.slice(4).trim(), body: [] }
    } else {
      current.body.push(line)
    }
  }
  sections.push({ heading: current.heading, body: current.body.join('\n').trim() })
  return sections.filter((s) => s.heading != null || s.body.length > 0)
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)
  return (
    <button
      className="ck-btn"
      onClick={() => {
        void copyText(text).then((ok) => {
          setCopied(ok ? 'ok' : 'fail')
          window.setTimeout(() => setCopied(null), 1800)
        })
      }}
      style={{ flexShrink: 0 }}
    >
      {copied === 'ok' ? 'Kopiert ✓' : copied === 'fail' ? 'Kopieren fehlgeschlagen — Text markieren' : 'Nachricht kopieren'}
    </button>
  )
}

function VaultPreview({ path }: { path: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setContent(null)
    setError(null)
    fetchOsFile(path)
      .then((f) => setContent(f.content))
      .catch((e: Error) => setError(e.message))
  }, [path])

  if (error) return <p style={{ color: 'var(--ck-warn)', fontSize: 12.5 }}>{error}</p>
  if (content == null) return <p style={{ color: 'var(--ck-text-3)', fontSize: 12.5 }}>Lädt…</p>

  const sections = splitSections(content)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <a
          href={obsidianUrl(path)}
          onClick={(e) => {
            e.preventDefault()
            openInObsidian(path)
          }}
          style={{ fontSize: 11, color: 'var(--ck-text-3)' }}
        >
          In Obsidian öffnen ↗
        </a>
      </div>
      {sections.map((s, i) => (
        <div key={i} className="ck-panel" style={{ padding: '10px 12px' }}>
          {s.heading ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{s.heading}</span>
              <CopyButton text={s.body} />
            </div>
          ) : null}
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'var(--ck-font)',
              fontSize: 12.5,
              lineHeight: 1.55,
              color: 'var(--ck-text-2)',
            }}
          >
            {s.body}
          </pre>
        </div>
      ))}
    </div>
  )
}

function SkriptePreview({ rel, kind }: { rel: string; kind: 'md' | 'html' | 'pdf' }) {
  if (kind === 'html' || kind === 'pdf') {
    const url = salesFileUrl(rel)
    if (!url) {
      return (
        <p style={{ fontSize: 12.5, color: 'var(--ck-text-3)' }}>
          Diese Datei ist noch nicht im Spiegel — sobald der Runner sie hochgeladen hat, steht sie
          hier auch unterwegs.
        </p>
      )
    }
    return (
      <iframe
        src={url}
        title={rel}
        style={{ width: '100%', height: '78vh', border: '1px solid var(--ck-border)', borderRadius: 'var(--ck-radius-innen)', background: 'var(--ck-medien-bg)' }}
      />
    )
  }
  // .md im Sales-Skripte-Ordner (z.B. die Rubrik) liegt außerhalb des Vaults —
  // der Runner liefert nur Vault-Markdown inhaltlich aus (/os/file). Kein
  // toter Vorschau-Link, sondern klarer Hinweis, im Finder nachzusehen.
  return (
    <p style={{ fontSize: 12.5, color: 'var(--ck-text-3)' }}>
      Kein Inline-Vorschau für diese Datei — im Finder öffnen: „Sales Skripte/{rel}".
    </p>
  )
}

export function SalesBibliothek() {
  const runner = useRunnerStatus()
  const [searchParams, setSearchParams] = useSearchParams()
  const [library, setLibrary] = useState<SalesLibrary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionKey | null>(null)

  useEffect(() => {
    if (runner.state !== 'online') return
    let cancelled = false
    void fetchSalesLibrary()
      .then((lib) => {
        if (cancelled) return
        setLibrary(lib)
        const wanted = searchParams.get('f')
        if (wanted) {
          const vaultHit = lib.vault.find((v) => v.path === wanted)
          const skriptHit = lib.skripte.find((s) => s.rel === wanted)
          if (vaultHit) setSelection({ group: 'vault', path: vaultHit.path })
          else if (skriptHit) setSelection({ group: 'skripte', rel: skriptHit.rel, kind: skriptHit.kind })
        } else {
          const newest = [...lib.vault, ...lib.skripte].sort((a, b) => (a.mtime < b.mtime ? 1 : -1))[0]
          if (newest) {
            if ('path' in newest) setSelection({ group: 'vault', path: newest.path })
            else setSelection({ group: 'skripte', rel: newest.rel, kind: newest.kind })
          }
        }
      })
      .catch((e: Error) => setError(e.message))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner.state])

  const select = (sel: SelectionKey) => {
    setSelection(sel)
    setSearchParams({ f: selectionKeyToParam(sel) }, { replace: true })
  }

  const isSelected = (key: string) =>
    selection != null && selectionKeyToParam(selection) === key

  const vaultEntries = library?.vault ?? []
  const skripteEntries = library?.skripte ?? []

  if (runner.state !== 'online') {
    return (
      <section className="ck-panel" style={{ padding: '12px 14px' }}>
        <p className="ck-label" style={{ margin: 0 }}>Runner offline · Ressourcen nicht erreichbar</p>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ck-text-3)' }}>
          starte `npm run cockpit` im Repo-Root
        </p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="ck-panel" style={{ padding: '12px 14px', color: 'var(--ck-warn)', fontSize: 12.5 }}>
        {error}
      </section>
    )
  }

  return (
    <div className="ck-sales-bibliothek-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) 1fr', gap: 14, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section className="ck-panel">
          <div className="ck-label" style={{ padding: '10px 12px 4px' }}>Nachrichten &amp; Skripte (Vault)</div>
          {vaultEntries.length === 0 ? (
            <p style={{ padding: '0 12px 10px', margin: 0, fontSize: 12, color: 'var(--ck-text-3)' }}>Keine Dateien.</p>
          ) : (
            vaultEntries.map((f) => (
              <button
                key={f.path}
                onClick={() => select({ group: 'vault', path: f.path })}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: isSelected(f.path) ? 'color-mix(in srgb, var(--ck-accent) 14%, transparent)' : 'none',
                  border: 'none',
                  borderTop: '1px solid var(--ck-border)',
                  color: isSelected(f.path) ? 'var(--ck-accent)' : 'var(--ck-text-1)',
                  fontFamily: 'var(--ck-font)',
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                {f.name}
              </button>
            ))
          )}
        </section>
        <section className="ck-panel">
          <div className="ck-label" style={{ padding: '10px 12px 4px' }}>Vorlagen &amp; PDFs</div>
          {skripteEntries.length === 0 ? (
            <p style={{ padding: '0 12px 10px', margin: 0, fontSize: 12, color: 'var(--ck-text-3)' }}>Keine Dateien.</p>
          ) : (
            skripteEntries.map((f) => (
              <button
                key={f.rel}
                onClick={() => select({ group: 'skripte', rel: f.rel, kind: f.kind })}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: isSelected(f.rel) ? 'color-mix(in srgb, var(--ck-accent) 14%, transparent)' : 'none',
                  border: 'none',
                  borderTop: '1px solid var(--ck-border)',
                  color: isSelected(f.rel) ? 'var(--ck-accent)' : 'var(--ck-text-1)',
                  fontFamily: 'var(--ck-font)',
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                {f.name}
                <span className="ck-label" style={{ marginLeft: 6 }}>{f.kind}</span>
              </button>
            ))
          )}
        </section>
      </div>
      <div style={{ minWidth: 0 }}>
        {!selection ? (
          <p style={{ color: 'var(--ck-text-3)', fontSize: 12.5 }}>Links einen Eintrag wählen.</p>
        ) : selection.group === 'vault' ? (
          <VaultPreview path={selection.path} />
        ) : (
          <SkriptePreview rel={selection.rel} kind={selection.kind} />
        )}
      </div>
    </div>
  )
}
