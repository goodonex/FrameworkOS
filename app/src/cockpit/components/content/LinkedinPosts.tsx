import { useEffect, useMemo, useState } from 'react'
import type { ContentPost } from '../../lib/contentApi'
import { CONTENT_STATUS_LABEL } from '../../lib/contentApi'
import {
  MAX_ZEICHEN,
  SICHTBARE_MARKE,
  slidesOrdner,
  vorschauZeile,
  zeichenstand,
} from '../../lib/linkedinPost'

/**
 * LinkedIn als eigener Content-Kanal (Phase 2, Zug C1 · D10).
 *
 * **Text-first, nicht Slide-first.** Instagram lebt von Bildern und bleibt
 * unverändert daneben; ein LinkedIn-Beitrag IST sein Text. Deshalb: Liste mit
 * Textvorschau statt Slide-Vignette, Detail als Editor mit Zeichenzähler,
 * ein Kopier-Griff nach dem Erstnachrichten-Muster und „Als gepostet
 * markieren" über den bestehenden Endpunkt.
 *
 * **Kein neuer Agent** (D10): Beiträge entstehen weiter manuell oder über
 * Uriel. Bilder lädt Kevin selbst hoch — die App kann das nicht, aber sie kann
 * sagen, wo die Dateien liegen.
 */
export function LinkedinPosts({
  posts,
  onSetCaption,
  onMarkiereGepostet,
  runnerDirekt,
}: {
  /** Bereits auf `channel === 'linkedin'` gefiltert. */
  posts: ContentPost[]
  onSetCaption: (postId: string, caption: string) => void
  onMarkiereGepostet: (postId: string) => void
  /** Ohne direkten Runner gibt es keinen Weg zur Datei — der Knopf sagt das. */
  runnerDirekt: boolean
}) {
  const [offenId, setOffenId] = useState<string | null>(null)
  const offen = posts.find((p) => p.id === offenId) ?? null

  if (posts.length === 0) {
    return (
      <div className="ck-panel" style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--ck-text-2)', margin: 0 }}>
          Noch kein LinkedIn-Beitrag im Manifest.
        </p>
        <p className="ck-label" style={{ marginTop: 8 }}>
          Beiträge entstehen von Hand oder über Uriel — einen eigenen Agenten gibt es dafür
          bewusst noch nicht.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {posts.map((p) => {
        const stand = zeichenstand(p.caption ?? '')
        const vorschau = vorschauZeile(p.caption ?? '')
        return (
          <button
            key={p.id}
            type="button"
            className="ck-panel ck-zeile-karte"
            onClick={() => setOffenId(p.id)}
            style={{ alignItems: 'flex-start' }}
          >
            <span className="ck-zeile-karte-text">
              <span className="ck-zeile-karte-titel">{p.title || 'Ohne Titel'}</span>
              <span
                className="ck-zeile-karte-meta"
                style={{ whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
              >
                {vorschau || 'Noch kein Text.'}
              </span>
              <span className="ck-zahl" style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--ck-text-3)' }}>
                {stand.gesamt} Zeichen · {CONTENT_STATUS_LABEL[p.status]}
                {p.plannedFor ? ` · ${p.plannedFor}` : ''}
              </span>
            </span>
            <span className="ck-chip">{p.done ? 'Fertig' : 'Offen'}</span>
          </button>
        )
      })}

      {offen ? (
        <LinkedinDetail
          post={offen}
          onClose={() => setOffenId(null)}
          onSetCaption={onSetCaption}
          onMarkiereGepostet={onMarkiereGepostet}
          runnerDirekt={runnerDirekt}
        />
      ) : null}
    </div>
  )
}

function LinkedinDetail({
  post,
  onClose,
  onSetCaption,
  onMarkiereGepostet,
  runnerDirekt,
}: {
  post: ContentPost
  onClose: () => void
  onSetCaption: (postId: string, caption: string) => void
  onMarkiereGepostet: (postId: string) => void
  runnerDirekt: boolean
}) {
  const [text, setText] = useState(post.caption ?? '')
  const [kopiert, setKopiert] = useState(false)

  useEffect(() => {
    setText(post.caption ?? '')
  }, [post.id, post.caption])

  const stand = useMemo(() => zeichenstand(text), [text])
  const ordner = useMemo(() => slidesOrdner(post.slides.map((s) => s.path)), [post.slides])

  /**
   * Kopieren OHNE `await` — derselbe Grund wie bei den Erstnachrichten: nach
   * einem `await` gilt ein Folge-Klick dem Browser nicht mehr als Nutzergeste.
   */
  const kopieren = () => {
    try {
      void navigator.clipboard.writeText(text).catch(() => undefined)
      setKopiert(true)
      window.setTimeout(() => setKopiert(false), 1800)
    } catch {
      /* Zwischenablage gesperrt — der Text steht im Feld, er lässt sich markieren. */
    }
  }

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'var(--ck-backdrop)', zIndex: 40 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={post.title || 'LinkedIn-Beitrag'}
        className="ck-panel"
        style={{
          position: 'fixed',
          inset: 'auto 0 0 0',
          zIndex: 41,
          maxHeight: '86vh',
          overflowY: 'auto',
          borderRadius: 'var(--ck-radius) var(--ck-radius) 0 0',
          background: 'var(--ck-panel)',
          padding: '16px 16px calc(24px + env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, minWidth: 0 }}>{post.title || 'Ohne Titel'}</span>
          <button type="button" className="ck-btn" onClick={onClose}>
            Schließen
          </button>
        </div>

        <textarea
          className="ck-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== (post.caption ?? '')) onSetCaption(post.id, text)
          }}
          rows={14}
          aria-label="Beitragstext"
          style={{ width: '100%', resize: 'vertical', lineHeight: 1.55, fontSize: 14 }}
        />

        {/* Der Zähler nennt beide Marken: wo LinkedIn zusammenklappt, und wo
            es hart aufhört. */}
        <div className="ck-zahl" style={{ fontSize: 11.5, color: stand.ueberLimit ? 'var(--ck-danger)' : 'var(--ck-text-2)' }}>
          {stand.gesamt} / {MAX_ZEICHEN} Zeichen
          {stand.ueberLimit ? (
            <strong style={{ color: 'var(--ck-danger)' }}> — über dem Limit</strong>
          ) : stand.ueberMarke ? (
            <span style={{ color: 'var(--ck-warn)' }}>
              {' '}
              — ab {SICHTBARE_MARKE} klappt LinkedIn zusammen
            </span>
          ) : (
            <span> · noch {SICHTBARE_MARKE - stand.gesamt} bis zum „…mehr"</span>
          )}
        </div>

        {ordner ? (
          <div style={{ fontSize: 12, color: 'var(--ck-text-2)', lineHeight: 1.5 }}>
            <span className="ck-label" style={{ display: 'block', marginBottom: 4 }}>
              Bilder
            </span>
            {post.slides.length} Datei{post.slides.length === 1 ? '' : 'en'} liegen in{' '}
            <code style={{ fontSize: 11.5 }}>{ordner}</code> — beim Posten von Hand hochladen.
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="ck-btn ck-btn--primary" onClick={kopieren}>
            {kopiert ? 'Kopiert ✓' : 'Text kopieren'}
          </button>
          <a
            className="ck-btn"
            href="https://www.linkedin.com/feed/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            LinkedIn öffnen
          </a>
          <button
            type="button"
            className="ck-btn"
            disabled={!runnerDirekt || post.status === 'posted'}
            title={runnerDirekt ? undefined : 'Nur am Rechner — der Runner schreibt die Datei.'}
            onClick={() => onMarkiereGepostet(post.id)}
          >
            {post.status === 'posted' ? 'Gepostet' : 'Als gepostet markieren'}
          </button>
        </div>
      </div>
    </>
  )
}
