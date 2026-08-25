import { useMemo, useState } from 'react'
import type { Lead, LeadEreignis, LinkedinThread } from '../../../types/db'
import { icpUrteil, istArbeitsVorrat } from '../../lib/icp'
import { AKQUISE_START } from '../../lib/arbeitsmodusQuellen'
import {
  STATION_REIHENFOLGE,
  STATION_TITEL,
  leadStation,
  type Station,
  type StationErgebnis,
} from '../../lib/leadStation'

/**
 * Die Pipeline-Sicht — wie viele stecken gerade wo?
 *
 * Kevins Auftrag (20.08.2026): *„Dann kann man auch wirklich sehen: okay, wie
 * viele Leute sind denn gerade in der Pipeline?"* — und, genauso wichtig:
 * *„eine Datenbank, wo ich einem Mitarbeiter sagen kann: hier, tausend Leute,
 * die meine Anfrage nicht angenommen haben, die fragst du jetzt erst mal an."*
 *
 * Deshalb ist jede Station aufklappbar und als CSV exportierbar. Der Export
 * ist die Delegations-Funktion dieser Runde — keine Accounts, keine Rollen,
 * sondern eine Liste, die man weitergeben kann.
 *
 * **Der ICP-Filter gehört hierher, nicht in `leadStation`.** Die Station sagt,
 * wo jemand im Ablauf steht — das ist unabhängig davon, ob er Kevins Zielgruppe
 * ist. Ob er in die Arbeitsliste gehört, ist eine zweite Frage, und sie wird
 * mit derselben Regel beantwortet wie überall sonst (`icp.ts`, seit 18.08.).
 * Ohne diesen Filter stand hier „Erstnachricht fällig: 440", darunter 71
 * Recruiter, Consultants und Coaches — dieselbe Sorte Rauschen, die Kevin am
 * 18.08. aus der Antworten-Spur werfen ließ. Sie verschwinden nicht, sie stehen
 * zugeklappt unter „Nicht in der Zielgruppe".
 *
 * **Dasselbe gilt für die Zeit vor `AKQUISE_START`.** Kevin arbeitet erst seit
 * Januar 2026 auf Makler; was davor im Postfach liegt, ist Post von Leuten, die
 * IHN akquiriert haben. Beim ersten Blick auf diese Pipeline stand „Antwort da:
 * 20", ganz oben ein Recruiter vom Januar 2025 („ich suche ehrgeizige
 * Vertriebler wie Dich"). Die Regel ist dieselbe wie in `arbeitsmodusQuellen`,
 * importiert statt nachgebaut.
 */

export interface LeadPipelineProps {
  leads: Lead[]
  ereignisseJeLead: Map<string, LeadEreignis[]>
  /** Threads je lead_id — bestimmt, ob der Hauptweg oder der stille Zweig gilt. */
  threadsJeLead: Map<string, LinkedinThread>
  onLeadOeffnen: (leadId: string) => void
}

interface Reihe {
  lead: Lead
  stand: StationErgebnis
  /** Gehört der Lead in Kevins Arbeitsvorrat? `unklar` zählt bewusst als Ja. */
  imVorrat: boolean
}

/**
 * Eingegangen, bevor Kevin auf Makler umgestellt hat. Nur Threads, in denen die
 * ANDERE Seite zuletzt geschrieben hat, zählen hier — bei einem Thread, den
 * Kevin selbst angefangen hat, gilt weiter seine Regel „nichts, was liegen
 * geblieben ist, fällt weg".
 */
function istVorDerAkquise(thread: LinkedinThread | null): boolean {
  if (!thread || thread.last_from !== 'them') return false
  return thread.last_message_at != null && thread.last_message_at < AKQUISE_START
}

function csvFeld(wert: string): string {
  const sauber = String(wert ?? '').replace(/"/g, '""')
  return /[",;\n]/.test(sauber) ? `"${sauber}"` : sauber
}

export function LeadPipeline({ leads, ereignisseJeLead, threadsJeLead, onLeadOeffnen }: LeadPipelineProps) {
  const [offen, setOffen] = useState<Station | null>(null)
  const [nurFaellige, setNurFaellige] = useState(false)
  const [zeigeAusserhalb, setZeigeAusserhalb] = useState(false)
  const jetzt = useMemo(() => new Date(), [])

  const reihen = useMemo<Reihe[]>(
    () =>
      leads.map((lead) => ({
        lead,
        imVorrat:
          istArbeitsVorrat(icpUrteil(lead.headline, lead.name).urteil) &&
          !istVorDerAkquise(threadsJeLead.get(lead.id) ?? null),
        stand: leadStation(
          {
            lead_status: lead.lead_status,
            wiedervorlage_am: lead.wiedervorlage_am,
            // `details` muss mit: dort steht bei `uebersprungen` (0080), wohin
            // Kevin den Lead von Hand gesetzt hat.
            ereignisse: (ereignisseJeLead.get(lead.id) ?? []).map((e) => ({ typ: e.typ, at: e.at, details: e.details })),
            thread: threadsJeLead.get(lead.id) ?? null,
          },
          jetzt,
        ),
      })),
    [leads, ereignisseJeLead, threadsJeLead, jetzt],
  )

  const jeStation = useMemo(() => {
    const karte = new Map<Station, Reihe[]>()
    for (const r of reihen) {
      if (!r.imVorrat) continue
      if (nurFaellige && !r.stand.faellig) continue
      const liste = karte.get(r.stand.station)
      if (liste) liste.push(r)
      else karte.set(r.stand.station, [r])
    }
    for (const liste of karte.values()) {
      // Am längsten Wartende zuerst — sie sind am ehesten in Vergessenheit geraten.
      liste.sort((a, b) => new Date(a.stand.faelligAm ?? 0).getTime() - new Date(b.stand.faelligAm ?? 0).getTime())
    }
    return karte
  }, [reihen, nurFaellige])

  const inmailPool = useMemo(() => reihen.filter((r) => r.imVorrat && r.stand.imInmailPool), [reihen])
  const ausserhalb = useMemo(() => reihen.filter((r) => !r.imVorrat), [reihen])
  const markierte = useMemo(() => reihen.filter((r) => r.lead.markiert), [reihen])

  function exportiere(station: Station, liste: Reihe[]) {
    const kopf = ['Name', 'Headline', 'Profil', 'Station', 'Faellig am']
    const zeilen = liste.map((r) =>
      [
        r.lead.name,
        r.lead.headline,
        r.lead.profile_url,
        STATION_TITEL[r.stand.station],
        r.stand.faelligAm ? new Date(r.stand.faelligAm).toLocaleDateString('de-DE') : '',
      ]
        .map(csvFeld)
        .join(';'),
    )
    const csv = [kopf.join(';'), ...zeilen].join('\n')
    // Semikolon und BOM, damit Excel die Umlaute und die Spalten trifft.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${station}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ck-text-1)' }}>Pipeline</div>
        <span style={{ fontSize: 13, color: 'var(--ck-text-3)' }}>
          {leads.length - ausserhalb.length} in der Zielgruppe · {leads.length} gesamt
        </span>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={nurFaellige} onChange={(e) => setNurFaellige(e.target.checked)} />
          nur was heute dran ist
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
        <span
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--ck-radius-pille)',
            background: 'var(--ck-panel-2)',
            color: 'var(--ck-text-2)',
          }}
        >
          InMail-Pool: <strong style={{ color: 'var(--ck-text-1)' }}>{inmailPool.length}</strong> — läuft nebenbei
        </span>
        {markierte.length > 0 ? (
          <span
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--ck-radius-pille)',
              background: 'var(--ck-panel-2)',
              color: 'var(--ck-text-2)',
            }}
          >
            ★ markiert: <strong style={{ color: 'var(--ck-text-1)' }}>{markierte.length}</strong>
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STATION_REIHENFOLGE.map((station) => {
          const liste = jeStation.get(station) ?? []
          if (liste.length === 0) return null
          const auf = offen === station
          const faellige = liste.filter((r) => r.stand.faellig).length
          return (
            <div
              key={station}
              style={{
                border: '1px solid var(--ck-border)',
                borderRadius: 'var(--ck-radius-innen)',
                background: 'var(--ck-panel)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setOffen(auf ? null : station)}
                aria-expanded={auf}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '12px 14px',
                  minHeight: 44,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span aria-hidden="true" style={{ color: 'var(--ck-text-3)', fontSize: 12 }}>
                  {auf ? '▾' : '▸'}
                </span>
                <span style={{ flex: 1, color: 'var(--ck-text-1)', fontSize: 14 }}>{STATION_TITEL[station]}</span>
                {faellige > 0 ? (
                  <span
                    style={{
                      fontSize: 12,
                      padding: '2px 8px',
                      borderRadius: 'var(--ck-radius-pille)',
                      background: 'var(--ck-accent)',
                      // Dunkel auf dem Akzent, nicht hell: der Salbei ist eine helle Farbe,
                      // `--ck-accent-text` darauf kam auf ~1,1:1 (am 20.08. im Browser
                      // gemessen). Dieselbe Lehre steht schon in Badge.tsx.
                      color: 'var(--ck-bg)',
                    }}
                  >
                    {faellige} dran
                  </span>
                ) : null}
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-text-1)', minWidth: 40, textAlign: 'right' }}>
                  {liste.length}
                </span>
              </button>

              {auf ? (
                <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    type="button"
                    className="ck-btn"
                    onClick={() => exportiere(station, liste)}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Als CSV exportieren ({liste.length})
                  </button>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* Bewusst gedeckelt: 200 Namen sind zum Draufschauen da, für
                        alles darüber ist der CSV-Export der richtige Weg. */}
                    {liste.slice(0, 200).map((r) => (
                      <li key={r.lead.id}>
                        <button
                          type="button"
                          onClick={() => onLeadOeffnen(r.lead.id)}
                          style={{
                            display: 'flex',
                            gap: 10,
                            width: '100%',
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid var(--ck-border)',
                            padding: '8px 0',
                            minHeight: 40,
                            cursor: 'pointer',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ck-text-1)' }}>
                            {r.lead.name}
                            {r.lead.markiert ? ' ★' : ''}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--ck-text-3)', flexShrink: 0 }}>
                            {r.stand.faellig
                              ? 'dran'
                              : r.stand.faelligAm
                                ? new Date(r.stand.faelligAm).toLocaleDateString('de-DE')
                                : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {liste.length > 200 ? (
                    <div style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>
                      … und {liste.length - 200} weitere. Der CSV-Export enthält alle.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}

        {/* Die Aussortierten der Zielgruppen-Regel — sichtbar, aber nicht im Weg.
            Sie stehen hier, damit ein Filterfehler auffällt, statt still 71
            Leute verschwinden zu lassen (die Lehre vom 19.08.: „ich bin mir
            nicht sicher, ob die Leute, die rein müssen, auch reingekommen sind"). */}
        {ausserhalb.length > 0 ? (
          <div
            style={{
              border: '1px solid var(--ck-border)',
              borderRadius: 'var(--ck-radius-innen)',
              background: 'var(--ck-panel)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setZeigeAusserhalb((v) => !v)}
              aria-expanded={zeigeAusserhalb}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '12px 14px',
                minHeight: 44,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span aria-hidden="true" style={{ color: 'var(--ck-text-3)', fontSize: 12 }}>
                {zeigeAusserhalb ? '▾' : '▸'}
              </span>
              <span style={{ flex: 1, color: 'var(--ck-text-3)', fontSize: 14 }}>Nicht in der Zielgruppe</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ck-text-3)', minWidth: 40, textAlign: 'right' }}>
                {ausserhalb.length}
              </span>
            </button>
            {zeigeAusserhalb ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ausserhalb.slice(0, 200).map((r) => (
                  <li key={r.lead.id}>
                    <button
                      type="button"
                      onClick={() => onLeadOeffnen(r.lead.id)}
                      style={{
                        display: 'flex',
                        gap: 10,
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--ck-border)',
                        padding: '8px 0',
                        minHeight: 40,
                        cursor: 'pointer',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ck-text-2)' }}>{r.lead.name}</span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--ck-text-3)',
                          flexShrink: 0,
                          maxWidth: '55%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.lead.headline}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
