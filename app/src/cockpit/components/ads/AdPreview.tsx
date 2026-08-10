import { useState } from 'react'
import type { AdVersion, Kunde } from '../../lib/adsApi'
import { kundenFileUrl } from '../../lib/adsApi'

const FORMAT_LABEL: Record<string, string> = { '1:1': '1:1 Feed', '9:16': '9:16 Story', mockup: 'Mockup' }

/**
 * Vorschau einer Ad-Version: ein Tab je Datei-Eintrag.
 * HTML → iframe (eigene Dateien, kein sandbox nötig), PNG → <img>.
 */
export function AdPreview({ kunde, version }: { kunde: Kunde; version: AdVersion }) {
  const [idx, setIdx] = useState(0)
  const files = version.files
  const file = files[Math.min(idx, files.length - 1)]
  if (!file) {
    return <p className="ck-label">Keine Dateien in dieser Version.</p>
  }
  const url = kundenFileUrl(kunde, file.path)
  if (!url) {
    return <p className="ck-label">Diese Datei liegt noch nicht im Spiegel — am Mac ist sie da.</p>
  }
  const isHtml = file.path.endsWith('.html')

  return (
    <div>
      {files.length > 1 ? (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {files.map((f, i) => (
            <button
              key={`${f.path}-${i}`}
              className={`ck-btn${i === idx ? ' ck-btn--primary' : ''}`}
              style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => setIdx(i)}
            >
              {FORMAT_LABEL[f.format] ?? f.format}
            </button>
          ))}
        </div>
      ) : null}

      <div
        style={{
          border: '1px solid var(--ck-border)',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--ck-medien-bg)',
        }}
      >
        {isHtml ? (
          <iframe
            src={url}
            title={file.path}
            style={{ width: '100%', height: 480, border: 0, display: 'block', background: 'var(--ck-medien-bg)' }}
          />
        ) : (
          <img src={url} alt={file.path} style={{ width: '100%', display: 'block' }} />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span className="ck-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.path}
          {file.note ? ` · ${file.note}` : ''}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="ck-btn"
          style={{ fontSize: 11, padding: '3px 10px', flexShrink: 0, textDecoration: 'none' }}
        >
          Groß öffnen ↗
        </a>
      </div>
    </div>
  )
}
