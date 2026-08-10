import { useEffect, useRef, useState } from 'react'
import type { ContentPost } from '../../lib/contentApi'
import { socialFileUrl } from '../../lib/socialApi'

// Slides sind ein Fixed-Size-Canvas (design/slides.css: 1080×1350, Instagram 4:5).
// Das iframe rendert nativ in dieser Größe und wird per transform:scale auf die
// Container-Breite heruntergerechnet — sonst zeigt es die Slide 1:1 (reingezoomt).
const SLIDE_W = 1080
const SLIDE_H = 1350

/**
 * Vorschau eines Posts: ein Tab je Slide. Die Slide-HTML wird über die
 * ausgelieferte Runner-URL (`src`, NICHT `srcDoc`) geladen, damit die relativen
 * Asset-Pfade der Slides (`../../../../design/slides.css`, Logos) auflösen —
 * design/ liegt unter SOCIAL_ROOT und wird über /files/social/ serviert.
 */
export function ContentPreview({ post }: { post: ContentPost }) {
  const [idx, setIdx] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setScale(el.clientWidth / SLIDE_W)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const slides = post.slides
  const slide = slides[Math.min(idx, slides.length - 1)]
  if (!slide) {
    return <p className="ck-label">Keine Slides in diesem Post.</p>
  }
  const url = socialFileUrl(slide.path)
  if (!url) {
    // Slide-HTMLs verweisen relativ auf design/slides.css und Logos — das
    // funktioniert nur über den Runner. Ehrlicher Hinweis statt leerem Rahmen.
    return <p className="ck-label">Slide-Vorschau nur am Mac — die Slides laden ihre Assets lokal.</p>
  }

  return (
    <div>
      {slides.length > 1 ? (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {slides.map((s, i) => (
            <button
              key={`${s.path}-${i}`}
              className={`ck-btn${i === idx ? ' ck-btn--primary' : ''}`}
              style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => setIdx(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      ) : null}

      {/* Wrapper gibt die Breite vor; Höhe = skalierte Slide-Höhe. overflow:hidden
          kappt den transform-Überhang. */}
      <div
        ref={wrapRef}
        style={{
          width: '100%',
          height: SLIDE_H * scale,
          border: '1px solid var(--ck-border)',
          borderRadius: 'var(--ck-radius-innen)',
          overflow: 'hidden',
          background: 'var(--ck-medien-bg)',
        }}
      >
        <iframe
          key={slide.path}
          src={url}
          title={slide.path}
          scrolling="no"
          sandbox="allow-same-origin allow-scripts"
          style={{
            width: SLIDE_W,
            height: SLIDE_H,
            border: 0,
            display: 'block',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span className="ck-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {slide.path.split('/').pop()}
          {slide.note ? ` · ${slide.note}` : ''}
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
