import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useArbeitsDauern } from '../../hooks/useArbeitsDauern'
import { useContentPieces } from '../../hooks/useContentPieces'
import { entwuerfeOffen, usePosten } from '../../hooks/usePosten'
import { useBookings } from '../../hooks/useSalesPro'
import { eventsByDate, termineAmTag, ymd, type CalEvent } from '../lib/termineEvents'
import type { Posten } from '../lib/prioritaet'
import { KACHEL_JE_SPUR, SPUR_LABEL } from '../lib/spurAnzeige'
import { tagesansage } from '../lib/tagesansage'
import { CALENDAR_ICAL_KEY, useCalendarFeed } from '../lib/useCalendarFeed'
import { useKundenPosteingang } from '../lib/useKundenPosteingang'

const COLLAPSE_KEY = 'ck.heute.collapsed'
const TOP = 5

/**
 * Heute-Deck v2 (Etappe 3, Schritt 4) — der EINE Morgen-Einstieg.
 *
 * Vorher beantwortete das Deck „was zuerst?" mit einer eigenen Kontakt-Logik
 * (next_follow_up_at), während die Posten-Engine hinter dem Sales-Dashboard
 * dieselbe Frage anders beantwortete. Jetzt liest es `ordnePosten` über
 * `usePosten` — dieselbe Rangfolge wie „Jetzt dran".
 *
 * Es baut bewusst KEINE eigene Abarbeitungs-UI: Klick auf einen Posten öffnet
 * das zuständige Kachel-Fenster im Sales-Bereich (`/sales?kachel=…`), wo Haken,
 * Kopieren und Entwurf schon liegen. Sonst gäbe es zwei Orte zum Abhaken.
 */

function greeting(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}

export function HeuteDeck({ slug }: { slug: string | undefined }) {
  const navigate = useNavigate()
  const { geordnet, jetzt, contacts } = usePosten(slug)
  const dauern = useArbeitsDauern(slug)
  const bookings = useBookings(slug)
  const content = useContentPieces(slug)
  const { nachrichtenAnzahl } = useKundenPosteingang(slug)

  const [icalUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(CALENDAR_ICAL_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const cal = useCalendarFeed(icalUrl || null)

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  const heuteTermine = useMemo<CalEvent[]>(() => {
    const map = eventsByDate({
      bookings: bookings.items,
      contacts: contacts.items,
      content: content.items,
      kalender: cal.events,
    })
    return termineAmTag(map, ymd(jetzt))
  }, [bookings.items, contacts.items, content.items, cal.events, jetzt])

  const offeneEntwuerfe = useMemo(() => entwuerfeOffen(geordnet), [geordnet])
  const ansage = useMemo(() => tagesansage(geordnet, dauern, jetzt), [geordnet, dauern, jetzt])

  const oeffnePosten = useCallback(
    (p: Posten) => navigate(`/sales?kachel=${KACHEL_JE_SPUR[p.spur]}`),
    [navigate],
  )

  const top = geordnet.slice(0, TOP)
  const rest = geordnet.length - top.length

  return (
    <section className="ck-panel" aria-label="Heute" style={{ overflow: 'hidden' }}>
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          borderBottom: collapsed ? 'none' : '1px solid var(--ck-border)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <span
            className="ck-label"
            style={{ color: geordnet.length ? 'var(--ck-accent)' : 'var(--ck-text-3)' }}
          >
            Heute
          </span>
          <span
            style={{
              fontSize: 12.5,
              color: 'var(--ck-text-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {greeting()}. {ansage}
          </span>
        </span>
        <span aria-hidden style={{ color: 'var(--ck-text-3)', fontSize: 12, flexShrink: 0 }}>
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {collapsed ? null : (
        <>
          {/* Zuerst die Termine: was heute feststeht, rahmt alles andere ein. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '9px 14px',
              borderBottom: '1px solid var(--ck-border)',
              fontSize: 12.5,
            }}
          >
            <span className="ck-label" style={{ flexShrink: 0 }}>
              Termine
            </span>
            {heuteTermine.length === 0 ? (
              <span style={{ color: 'var(--ck-text-3)' }}>Heute keine.</span>
            ) : (
              heuteTermine.map((e) => (
                <span key={e.id} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ color: 'var(--ck-accent)', fontVariantNumeric: 'tabular-nums' }}>
                    {e.time ?? '—'}
                  </span>
                  {e.href ? (
                    <button
                      type="button"
                      onClick={() => navigate(e.href as string)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--ck-text-1)',
                        font: 'inherit',
                      }}
                    >
                      {e.title}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--ck-text-1)' }}>{e.title}</span>
                  )}
                </span>
              ))
            )}
            <span style={{ flex: 1 }} />
            {/* Nur zählen und hinspringen — abgearbeitet wird in /freigaben,
                sonst gäbe es zwei Orte für dieselbe Warteschlange. */}
            {nachrichtenAnzahl > 0 ? (
              <button
                type="button"
                onClick={() => navigate('/freigaben')}
                className="ck-btn"
                style={{ fontSize: 11, padding: '4px 10px', color: 'var(--ck-accent)' }}
              >
                {nachrichtenAnzahl}{' '}
                {nachrichtenAnzahl === 1 ? 'Kundennachricht' : 'Kundennachrichten'}
              </button>
            ) : null}
            {offeneEntwuerfe > 0 ? (
              <button
                type="button"
                onClick={() => navigate('/sales?kachel=antworten')}
                className="ck-btn"
                style={{ fontSize: 11, padding: '4px 10px', color: 'var(--ck-accent)' }}
              >
                {offeneEntwuerfe} {offeneEntwuerfe === 1 ? 'Entwurf wartet' : 'Entwürfe warten'}
              </button>
            ) : null}
          </div>

          {/* Top-5 der Posten-Engine — Klick springt ins zuständige Kachel-Fenster. */}
          {top.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--ck-text-3)' }}>
              Liste leer. Für heute ist alles abgearbeitet.
            </div>
          ) : (
            <div style={{ paddingBottom: 6 }}>
              {top.map((p) => (
                <div
                  key={p.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px' }}
                >
                  <span
                    className="ck-label"
                    style={{ flexShrink: 0, minWidth: 92, color: 'var(--ck-text-3)' }}
                  >
                    {SPUR_LABEL[p.spur]}
                  </span>
                  <button
                    type="button"
                    onClick={() => oeffnePosten(p)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'var(--ck-text-1)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.name}
                    {p.firma && p.firma !== p.name ? (
                      <span style={{ color: 'var(--ck-text-3)' }}> · {p.firma}</span>
                    ) : null}
                  </button>
                  {p.entwurf && !p.entwurf.veraltet ? (
                    <span style={{ flexShrink: 0, fontSize: 10, color: 'var(--ck-accent)' }}>Entwurf da</span>
                  ) : null}
                  {p.starred ? (
                    <span aria-label="Loom zugesagt" style={{ flexShrink: 0, fontSize: 10, color: 'var(--ck-warn)' }}>
                      ★
                    </span>
                  ) : null}
                </div>
              ))}
              {rest > 0 ? (
                <button
                  type="button"
                  onClick={() => navigate('/sales?kachel=jetzt-dran')}
                  style={{
                    margin: '4px 14px 8px',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: 11,
                    color: 'var(--ck-text-3)',
                  }}
                >
                  {rest} weitere in „Jetzt dran" →
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  )
}
