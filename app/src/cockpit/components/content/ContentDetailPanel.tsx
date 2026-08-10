import { useEffect, useState } from 'react'
import { useToast } from '../../../components/Toast'
import type {
  ContentChannel,
  ContentFormat,
  ContentPost,
  ContentStatus,
} from '../../lib/contentApi'
import {
  CONTENT_CHANNEL_LABEL,
  CONTENT_CHANNEL_ORDER,
  CONTENT_FORMAT_LABEL,
  CONTENT_FORMAT_ORDER,
  CONTENT_STATUS_LABEL,
  CONTENT_STATUS_ORDER,
} from '../../lib/contentApi'
import { ContentPreview } from './ContentPreview'

interface Props {
  post: ContentPost
  onClose: () => void
  onSetStatus: (postId: string, status: ContentStatus) => void
  onToggleDone: (postId: string) => void
  onSetPlannedFor: (postId: string, plannedFor: string | undefined) => void
  onSetChannel: (postId: string, channel: ContentChannel) => void
  onSetFormat: (postId: string, format: ContentFormat) => void
  onAddNote: (postId: string, text: string) => void
  /** O9 / D5: schreibt der Runner in content.json — nur direkt am Rechner möglich. */
  onMarkiereGepostet: (postId: string) => void
  runnerDirekt: boolean
}

/** Detail-Panel als overlay-right: Slide-Vorschau, Caption-Copy, Pipeline-Status, Datum, Notizen. */
export function ContentDetailPanel({
  post,
  onClose,
  onSetStatus,
  onToggleDone,
  onSetPlannedFor,
  onSetChannel,
  onSetFormat,
  onAddNote,
  onMarkiereGepostet,
  runnerDirekt,
}: Props) {
  const { show } = useToast()
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copyCaption = async () => {
    if (!post.caption) return
    try {
      await navigator.clipboard.writeText(post.caption)
      show('Caption kopiert.', 'success')
    } catch {
      show('Kopieren fehlgeschlagen.', 'error')
    }
  }

  const submitNote = () => {
    onAddNote(post.id, noteText)
    setNoteText('')
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'var(--ck-backdrop)', zIndex: 40 }}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{post.title}</div>
            {post.angle ? (
              <div className="ck-label" style={{ marginTop: 2 }}>
                {post.angle}
                {post.week ? ` · ${post.week}` : ''}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {post.status === 'posted' ? null : (
              <button
                className="ck-btn ck-btn--primary"
                onClick={() => onMarkiereGepostet(post.id)}
                disabled={!runnerDirekt}
                style={{ opacity: runnerDirekt ? 1 : 0.45 }}
                title={
                  runnerDirekt
                    ? 'Setzt den Post in content.json auf „Gepostet"'
                    : 'Am Rechner markieren — content.json liegt im Vault und nur der Runner schreibt sie'
                }
              >
                Als gepostet markieren
              </button>
            )}
            <button className="ck-btn" onClick={onClose}>
              Schließen
            </button>
          </div>
        </div>

        {/* Status / Kanal / Format / erledigt */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="ck-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Status
            <select
              className="ck-input"
              value={post.status}
              onChange={(e) => onSetStatus(post.id, e.target.value as ContentStatus)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              {CONTENT_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {CONTENT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="ck-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Kanal
            <select
              className="ck-input"
              value={post.channel}
              onChange={(e) => onSetChannel(post.id, e.target.value as ContentChannel)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              {CONTENT_CHANNEL_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CONTENT_CHANNEL_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="ck-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Format
            <select
              className="ck-input"
              value={post.format}
              onChange={(e) => onSetFormat(post.id, e.target.value as ContentFormat)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              {CONTENT_FORMAT_ORDER.map((f) => (
                <option key={f} value={f}>
                  {CONTENT_FORMAT_LABEL[f]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="ck-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Geplant
            <input
              type="date"
              className="ck-input"
              value={post.plannedFor ?? ''}
              onChange={(e) => onSetPlannedFor(post.id, e.target.value || undefined)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            />
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12.5 }}>
            <input
              type="checkbox"
              checked={post.done}
              onChange={() => onToggleDone(post.id)}
              style={{ accentColor: 'var(--ck-accent)' }}
            />
            erledigt
          </label>
        </div>

        <ContentPreview post={post} />

        {/* Caption + 1-Klick-Copy */}
        <section className="ck-panel" style={{ padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="ck-label">Caption</span>
            <button
              className="ck-btn"
              style={{ fontSize: 11.5, padding: '3px 10px' }}
              onClick={copyCaption}
              disabled={!post.caption}
            >
              Kopieren
            </button>
          </div>
          {post.caption ? (
            <p style={{ fontSize: 12.5, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap', color: 'var(--ck-text-2)' }}>
              {post.caption}
            </p>
          ) : (
            <p className="ck-label" style={{ margin: 0 }}>
              Noch keine Caption.
            </p>
          )}
        </section>

        {/* Notizen */}
        <section className="ck-panel" style={{ padding: 12 }}>
          <div className="ck-label" style={{ marginBottom: 8 }}>
            Anmerkungen
          </div>
          {(post.notes ?? []).length === 0 ? (
            <p className="ck-label" style={{ margin: '0 0 8px' }}>
              Noch keine Anmerkungen.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(post.notes ?? []).map((n, i) => (
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
