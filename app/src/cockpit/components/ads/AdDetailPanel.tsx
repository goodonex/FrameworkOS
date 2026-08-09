import { useEffect, useMemo, useState } from 'react'
import type { Ad, AdStatus, ChecklistItem, Kunde } from '../../lib/adsApi'
import { AD_STATUS_LABEL, AD_STATUS_ORDER, seedReview } from '../../lib/adsApi'
import { AdPreview } from './AdPreview'

/** Wo im Durchgang stehen wir (O8) — 0-basierter Index, Anzeige ist 1-basiert. */
export interface AdPosition {
  index: number
  gesamt: number
  freigegeben: number
}

interface Props {
  kunde: Kunde
  ad: Ad
  onClose: () => void
  onToggleCheck: (adId: string, v: number, kind: 'design' | 'copy', itemId: string) => void
  onAddNote: (adId: string, v: number, text: string) => void
  onSetStatus: (adId: string, status: AdStatus) => void
  /** Blättern im Review — fehlt, wenn es keinen Vorgänger/Nachfolger gibt. */
  onPrev?: () => void
  onNext?: () => void
  position?: AdPosition
}

/** Tippen in ein Feld darf nicht durch die Ads blättern. */
function tipptGerade(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/** Review-Panel als overlay-right: Version wählen, Preview, Copy, Checklisten, Notizen. */
export function AdDetailPanel({
  kunde,
  ad,
  onClose,
  onToggleCheck,
  onAddNote,
  onSetStatus,
  onPrev,
  onNext,
  position,
}: Props) {
  const versions = ad.versions
  const [v, setV] = useState(versions[versions.length - 1]?.v ?? 1)
  const version = useMemo(
    () => versions.find((x) => x.v === v) ?? versions[versions.length - 1],
    [versions, v],
  )
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Sonst springt das Tippen einer Anmerkung die Ads um.
      if (tipptGerade(e.target)) return
      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault()
        onPrev()
      } else if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault()
        onNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  if (!version) return null
  const review = version.review ?? seedReview()

  const submitNote = () => {
    onAddNote(ad.id, version.v, noteText)
    setNoteText('')
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }}
      />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(640px, 96vw)',
          zIndex: 41,
          background: 'var(--ck-bg)',
          borderLeft: '1px solid var(--ck-border)',
          overflowY: 'auto',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Am Handy ist das Panel nur ~374 px breit. Ohne Umbruch quetschen
            Zähler, ‹ › und „Schließen" den Titel auf ein Wort pro Zeile und
            laufen rechts aus dem Panel — deshalb wrapt die Kopfzeile, und der
            Titel behält eine Mindestbreite. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 180px' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{ad.title}</div>
            {ad.angle ? (
              <div className="ck-label" style={{ marginTop: 2 }}>
                {ad.angle}
              </div>
            ) : null}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
              marginLeft: 'auto',
            }}
          >
            {position ? (
              <span className="ck-label" style={{ whiteSpace: 'nowrap' }}>
                Ad {position.index + 1}/{position.gesamt} · {position.freigegeben} freigegeben
              </span>
            ) : null}
            {onPrev || onNext ? (
              <>
                <button
                  className="ck-btn"
                  onClick={onPrev}
                  disabled={!onPrev}
                  title="Vorherige Ad (←)"
                  aria-label="Vorherige Ad"
                  style={{ opacity: onPrev ? 1 : 0.4 }}
                >
                  ‹
                </button>
                <button
                  className="ck-btn"
                  onClick={onNext}
                  disabled={!onNext}
                  title="Nächste Ad (→)"
                  aria-label="Nächste Ad"
                  style={{ opacity: onNext ? 1 : 0.4 }}
                >
                  ›
                </button>
              </>
            ) : null}
            <button className="ck-btn" onClick={onClose}>
              Schließen
            </button>
          </div>
        </div>

        {/* Version + Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {versions.map((ver) => (
              <button
                key={ver.v}
                className={`ck-btn${ver.v === version.v ? ' ck-btn--primary' : ''}`}
                style={{ fontSize: 11, padding: '3px 10px' }}
                onClick={() => setV(ver.v)}
              >
                v{ver.v}
              </button>
            ))}
          </div>
          <label className="ck-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Status
            <select
              className="ck-input"
              value={ad.status}
              onChange={(e) => onSetStatus(ad.id, e.target.value as AdStatus)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              {AD_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {AD_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <AdPreview kunde={kunde} version={version} />

        {/* Copy (bewusst read-only — Änderungen macht Claude auf den Dateien) */}
        {version.copy ? (
          <section className="ck-panel" style={{ padding: 12 }}>
            <div className="ck-label" style={{ marginBottom: 8 }}>
              Copy (v{version.v})
            </div>
            {version.copy.headline ? (
              <p style={{ fontSize: 13.5, fontWeight: 600, margin: '0 0 6px' }}>{version.copy.headline}</p>
            ) : null}
            {version.copy.primary ? (
              <p style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 6px', color: 'var(--ck-text-2)' }}>
                {version.copy.primary}
              </p>
            ) : null}
            {version.copy.cta ? (
              <p className="ck-label" style={{ margin: 0 }}>
                CTA: {version.copy.cta}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Checklisten */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <ChecklistSection
            title="Design"
            items={review.design}
            onToggle={(itemId) => onToggleCheck(ad.id, version.v, 'design', itemId)}
          />
          <ChecklistSection
            title="Copy"
            items={review.copy}
            onToggle={(itemId) => onToggleCheck(ad.id, version.v, 'copy', itemId)}
          />
        </div>

        {/* Notizen */}
        <section className="ck-panel" style={{ padding: 12 }}>
          <div className="ck-label" style={{ marginBottom: 8 }}>
            Anmerkungen (v{version.v})
          </div>
          {(version.notes ?? []).length === 0 ? (
            <p className="ck-label" style={{ margin: '0 0 8px' }}>
              Noch keine Anmerkungen.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(version.notes ?? []).map((n, i) => (
                <li key={`${n.at}-${i}`} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  <span className="ck-label" style={{ display: 'block' }}>
                    {new Date(n.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  {n.text}
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="ck-input"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNote()
              }}
              placeholder="Anmerkung… (Enter)"
              style={{ flex: 1, fontSize: 12.5 }}
            />
            <button className="ck-btn ck-btn--primary" onClick={submitNote} disabled={!noteText.trim()}>
              +
            </button>
          </div>
        </section>
      </aside>
    </>
  )
}

function ChecklistSection({
  title,
  items,
  onToggle,
}: {
  title: string
  items: ChecklistItem[]
  onToggle: (itemId: string) => void
}) {
  const done = items.filter((c) => c.done).length
  return (
    <section className="ck-panel" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="ck-label">{title}</span>
        <span className="ck-label" style={{ color: done === items.length ? 'var(--ck-accent)' : undefined }}>
          {done}/{items.length}
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((c) => (
          <li key={c.id}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', fontSize: 12.5, lineHeight: 1.4 }}>
              <input
                type="checkbox"
                checked={c.done}
                onChange={() => onToggle(c.id)}
                style={{ marginTop: 2, accentColor: 'var(--ck-accent)' }}
              />
              <span style={{ color: c.done ? 'var(--ck-text-3)' : undefined, textDecoration: c.done ? 'line-through' : undefined }}>
                {c.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
