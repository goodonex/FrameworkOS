import { useMemo, useState } from 'react'
import { useErstnachrichten, type Erstnachricht } from '../../hooks/useErstnachrichten'
import { useLinkedinThreads } from '../../hooks/useLinkedinThreads'
import { teileErstnachrichten } from '../lib/erstnachrichtenOffen'

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

  /**
   * D4: kopieren OHNE `await` vor der Navigation. `window.open`/ein Link-Klick
   * nach einem `await` gilt dem Browser nicht mehr als Nutzergeste — der
   * Popup-Blocker schluckt ihn (Lehre aus O3 Zug 9, dort an der Loom-Stelle
   * dokumentiert). Der Aufruf selbst ist synchron, nur sein Promise ist es nicht.
   */
  const kopieren = () => {
    try {
      void navigator.clipboard.writeText(lead.nachricht).catch(() => undefined)
    } catch {
      /* Zwischenablage gesperrt — Text steht sichtbar da und lässt sich markieren */
      return
    }
    setKopiert(true)
    onKopiert()
    window.setTimeout(() => setKopiert(false), 2000)
  }

  // RECON: `linkedin_erstnachrichten` (0060) führt kein Profil-Feld, nur
  // `website`. Deshalb heißt der Knopf auch „Website" und nicht „Profil" —
  // sobald es ein Profil-Feld gibt, kommt es hier davor.
  const ziel = lead.website
    ? `https://${lead.website.replace(/^https?:\/\//, '').split(' ')[0]}`
    : null

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
          <span className="ck-label" style={{ color: 'var(--ck-text-3)', flexShrink: 0 }}>
            {lead.website.split(' ')[0]}
          </span>
        ) : null}
      </div>

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--ck-text-2)',
          whiteSpace: 'pre-wrap',
          background: 'var(--ck-panel-2)',
          borderRadius: 'var(--ck-radius-innen)',
          padding: 12,
        }}
      >
        {lead.nachricht}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ziel ? (
          <a
            href={ziel}
            target="_blank"
            rel="noreferrer"
            className="ck-btn ck-btn--primary"
            style={{
              fontSize: 11,
              minHeight: 40,
              paddingInline: 16,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            title="Kopiert die Nachricht und öffnet die Website im neuen Tab"
            onClick={kopieren}
          >
            {kopiert ? '✓ kopiert' : 'Kopieren + Website ↗'}
          </a>
        ) : (
          <button
            type="button"
            className="ck-btn ck-btn--primary"
            style={{ fontSize: 11, minHeight: 40, paddingInline: 16 }}
            onClick={kopieren}
          >
            {kopiert ? '✓ kopiert' : 'Nachricht kopieren'}
          </button>
        )}
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
  const threads = useLinkedinThreads(brandSlug)
  const [anzahlSichtbar, setAnzahlSichtbar] = useState(5)

  // Der Haken im Cockpit ist nur die halbe Wahrheit — das Postfach ist die
  // andere (17.08.2026). Wer dort einen Thread hat, ist angeschrieben.
  const { offen, schonRaus, hatGeantwortet } = useMemo(
    () => teileErstnachrichten(q.items, threads.items),
    [q.items, threads.items],
  )
  const erledigt = q.items.filter((i) => i.status !== 'offen').length
  const ausPostfach = [...schonRaus, ...hatGeantwortet]
  const sichtbar = offen.slice(0, anzahlSichtbar)

  if (q.tableMissing) {
    return (
      <div className="ck-panel" style={{ padding: '28px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-2)' }}>
        Migration 0060 muss noch eingespielt werden.
      </div>
    )
  }
  if (q.loading) return <div style={{ fontSize: 12, color: 'var(--ck-text-2)', padding: 12 }}>Lädt …</div>

  if (!q.items.length) {
    return (
      <div className="ck-panel" style={{ padding: '28px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-2)' }}>
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
        {ausPostfach.length ? (
          <div className="ck-panel" style={{ padding: '10px 14px', flex: 1, minWidth: 140 }}>
            <div className="ck-label" style={{ fontSize: 9 }}>Laut Postfach raus</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--ck-text-1)' }}>{ausPostfach.length}</div>
            {hatGeantwortet.length ? (
              <div style={{ fontSize: 10, color: 'var(--ck-accent)' }}>
                {hatGeantwortet.length} davon haben geantwortet
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {ausPostfach.length ? (
        <div
          className="ck-panel"
          style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <span style={{ fontSize: 12, color: 'var(--ck-text-2)', flex: 1, minWidth: 200 }}>
            {ausPostfach.length} dieser Leads haben bereits einen Thread im Postfach — sie stehen hier nicht mehr
            in der Liste.
            {hatGeantwortet.length ? ` ${hatGeantwortet.length} haben geantwortet und liegen unter „Antworten".` : ''}
          </span>
          <button
            type="button"
            className="ck-btn"
            style={{ fontSize: 10 }}
            title="Setzt den Status dieser Zeilen dauerhaft auf „gesendet“"
            onClick={() => void q.erledigeViele(ausPostfach.map((l) => l.id))}
          >
            Als verschickt verbuchen
          </button>
        </div>
      ) : null}

      {q.error ? <div style={{ fontSize: 11, color: 'var(--ck-warn)' }}>{q.error}</div> : null}

      {offen.length === 0 ? (
        <div className="ck-panel" style={{ padding: '28px 14px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-2)' }}>
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
