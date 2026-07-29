import { useMemo, useState } from 'react'
import { useErstnachrichten, type Erstnachricht } from '../../hooks/useErstnachrichten'

/**
 * Arbeitsliste für die versandfertigen LinkedIn-Erstnachrichten.
 *
 * Kevin kopiert die Texte am Laptop und verschickt sie vom Handy — deshalb ist
 * das hier auf genau einen Ablauf zugeschnitten: nächster Lead, Text kopieren,
 * abhaken, nächster. Kein Scrollen durch eine 1300-Zeilen-Datei, und der Stand
 * ist auf beiden Geräten derselbe.
 */
function LeadKarte({
  lead,
  onKopiert,
  onGesendet,
  onUebersprungen,
}: {
  lead: Erstnachricht
  onKopiert: () => void
  onGesendet: () => void
  onUebersprungen: () => void
}) {
  const [kopiert, setKopiert] = useState(false)

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(lead.nachricht)
      setKopiert(true)
      onKopiert()
      window.setTimeout(() => setKopiert(false), 2000)
    } catch {
      /* Zwischenablage gesperrt — Text steht sichtbar da und lässt sich markieren */
    }
  }

  return (
    <section className="ck-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-text-1)' }}>{lead.name}</span>
          {lead.firma ? (
            <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}> · {lead.firma}</span>
          ) : null}
        </div>
        {lead.website ? (
          <a
            href={`https://${lead.website.replace(/^https?:\/\//, '').split(' ')[0]}`}
            target="_blank"
            rel="noreferrer"
            className="ck-label"
            style={{ color: 'var(--ck-accent)', textDecoration: 'none', flexShrink: 0 }}
          >
            {lead.website.split(' ')[0]} ↗
          </a>
        ) : null}
      </div>

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--ck-text-2)',
          whiteSpace: 'pre-wrap',
          background: 'var(--ck-panel-2)',
          borderRadius: 6,
          padding: 12,
        }}
      >
        {lead.nachricht}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="ck-btn ck-btn--primary"
          style={{ fontSize: 11, minHeight: 40, paddingInline: 16 }}
          onClick={() => void kopieren()}
        >
          {kopiert ? '✓ kopiert' : 'Nachricht kopieren'}
        </button>
        <button
          type="button"
          className="ck-btn"
          style={{ fontSize: 11, minHeight: 40, paddingInline: 16 }}
          onClick={onGesendet}
        >
          Verschickt
        </button>
        <button
          type="button"
          className="ck-btn"
          style={{ fontSize: 11, minHeight: 40, marginLeft: 'auto', color: 'var(--ck-text-3)' }}
          onClick={onUebersprungen}
        >
          Überspringen
        </button>
      </div>
    </section>
  )
}

export function ErstnachrichtenListe({ brandSlug }: { brandSlug: string | undefined }) {
  const q = useErstnachrichten(brandSlug)
  const [anzahlSichtbar, setAnzahlSichtbar] = useState(5)

  const offen = useMemo(() => q.items.filter((i) => i.status === 'offen'), [q.items])
  const erledigt = q.items.length - offen.length
  const sichtbar = offen.slice(0, anzahlSichtbar)

  if (q.tableMissing) {
    return (
      <div className="ck-panel" style={{ padding: '28px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-3)' }}>
        Migration 0060 muss noch eingespielt werden.
      </div>
    )
  }
  if (q.loading) return <div style={{ fontSize: 12, color: 'var(--ck-text-3)', padding: 12 }}>Lädt …</div>

  if (!q.items.length) {
    return (
      <div className="ck-panel" style={{ padding: '28px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-3)' }}>
        Noch keine Erstnachrichten gespiegelt. Der Runner liest sie aus dem Vault — er muss dafür
        einmal gelaufen sein.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="ck-panel" style={{ padding: '10px 14px', flex: 1, minWidth: 140 }}>
          <div className="ck-label" style={{ fontSize: 9 }}>Offen</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: offen.length ? 'var(--ck-accent)' : 'var(--ck-text-1)' }}>
            {offen.length}
          </div>
        </div>
        <div className="ck-panel" style={{ padding: '10px 14px', flex: 1, minWidth: 140 }}>
          <div className="ck-label" style={{ fontSize: 9 }}>Erledigt</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ck-text-1)' }}>{erledigt}</div>
        </div>
      </div>

      {q.error ? <div style={{ fontSize: 11, color: 'var(--ck-warn)' }}>{q.error}</div> : null}

      {offen.length === 0 ? (
        <div className="ck-panel" style={{ padding: '28px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-3)' }}>
          Alle Erstnachrichten raus. Neue kommen über den Skill <code>linkedin-leads</code> dazu.
        </div>
      ) : (
        <>
          {sichtbar.map((lead) => (
            <LeadKarte
              key={lead.id}
              lead={lead}
              onKopiert={() => undefined}
              onGesendet={() => void q.setzeStatus(lead.id, 'gesendet')}
              onUebersprungen={() => void q.setzeStatus(lead.id, 'uebersprungen')}
            />
          ))}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {offen.length > sichtbar.length ? (
              <button
                type="button"
                className="ck-btn"
                style={{ fontSize: 10 }}
                onClick={() => setAnzahlSichtbar((n) => n + 5)}
              >
                5 weitere zeigen ({offen.length - sichtbar.length} übrig)
              </button>
            ) : null}
            {sichtbar.length > 0 ? (
              <button
                type="button"
                className="ck-btn"
                style={{ fontSize: 10, color: 'var(--ck-text-3)' }}
                title="Einmaliger Einstieg: alles oberhalb dieses Leads als längst verschickt abhaken"
                onClick={() => void q.alleDavorErledigen(sichtbar[0].sort_index)}
              >
                Alles vor „{sichtbar[0].name}" ist raus
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
