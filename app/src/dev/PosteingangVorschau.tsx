import { useState } from 'react'
import { KundenPosteingang } from '../cockpit/components/KundenPosteingang'
import { ordnePosteingang, type PosteingangEintrag } from '../cockpit/lib/posteingang'

/**
 * Dev-Vorschau (nur import.meta.env.DEV, ohne Login): der Kunden-Posteingang
 * gegen Fixtures. Grund wie bei SalesVorschau/ZielVorschau — /freigaben liegt
 * hinter dem Supabase-Login.
 *
 * Hier ist der Grund noch zwingender: Ein „Antwort an Kunden senden" gegen die
 * echte Datenbank schreibt in `project_messages` UND stößt die Benachrichtigungs-
 * Mail an einen echten Kunden an. Das darf kein Prüfklick auslösen. Die Aktionen
 * unten sind deshalb Attrappen, die nur den Zustand der Liste verändern.
 * Kein Produktions-Code-Pfad.
 */

const jetzt = Date.now()
const vorStunden = (h: number) => new Date(jetzt - h * 3600_000).toISOString()

const FIXTURES: PosteingangEintrag[] = [
  {
    id: 'm-1',
    art: 'nachricht',
    projektId: 'p-reichentrog',
    projektName: 'Reichentrog & Kollegen',
    titel: 'Nadine Reichentrog',
    seit: vorStunden(31),
    text: 'Hallo Kevin,\n\nwir haben uns die Entwürfe angesehen. Die Farbwelt passt, aber der Claim auf der Startseite klingt uns zu technisch. Können wir da nochmal ran?\n\nViele Grüße',
    alt: null,
    neu: null,
    bereich: null,
  },
  {
    id: 'w-1',
    art: 'website',
    projektId: 'p-reichentrog',
    projektName: 'Reichentrog & Kollegen',
    titel: 'Überschrift Startseite',
    seit: vorStunden(6),
    text: null,
    alt: 'Ihre Immobilie in den richtigen Händen',
    neu: 'Diskret verkaufen — mit einer Kanzlei, die den Markt kennt',
    bereich: 'Startseite',
  },
  {
    id: 'm-2',
    art: 'nachricht',
    projektId: 'p-develo',
    projektName: 'Develo Immobilien',
    titel: 'Markus Develo',
    seit: vorStunden(2),
    text: 'Kurze Frage: Wann geht die Seite live?',
    alt: null,
    neu: null,
    bereich: null,
  },
  {
    id: 'w-2',
    art: 'website',
    projektId: 'p-develo',
    projektName: 'Develo Immobilien',
    titel: 'Team-Text',
    seit: vorStunden(70),
    text: null,
    alt: 'Wir sind seit 2011 für Sie da.',
    neu: '',
    bereich: 'Über uns',
  },
]

export function PosteingangVorschau() {
  const [eintraege, setEintraege] = useState(() => ordnePosteingang(FIXTURES))
  const [protokoll, setProtokoll] = useState<string[]>([])

  const merke = (zeile: string) => setProtokoll((p) => [zeile, ...p].slice(0, 8))
  const entferne = (id: string) => setEintraege((es) => es.filter((e) => e.id !== id))

  return (
    <div
      className="ck-root"
      style={{ minHeight: '100vh', background: 'var(--ck-bg)', padding: 24, pointerEvents: 'auto' }}
    >
      <div className="ck-label" style={{ marginBottom: 14 }}>
        Dev-Vorschau · Kunden-Posteingang (Fixtures) — Aktionen sind Attrappen, es
        wird nichts gesendet oder veröffentlicht
      </div>
      <div style={{ maxWidth: 720 }}>
        <KundenPosteingang
          eintraege={eintraege}
          loading={false}
          onAntworten={async (e, text) => {
            merke(`Antwort an ${e.titel} (${text.length} Zeichen) — würde gesendet`)
            return { ok: true }
          }}
          onNachrichtAbhaken={(id) => {
            merke(`Nachricht ${id} abgehakt (read_at gesetzt)`)
            entferne(id)
          }}
          onWebsiteFreigeben={async (e) => {
            merke(`„${e.titel}" veröffentlicht (draft → published)`)
            entferne(e.id)
            return { ok: true }
          }}
          onWebsiteVerwerfen={async (e) => {
            merke(`„${e.titel}" verworfen (draft ← published)`)
            entferne(e.id)
            return { ok: true }
          }}
        />
        {protokoll.length > 0 ? (
          <div className="ck-panel" style={{ marginTop: 14, padding: 12 }}>
            <div className="ck-label" style={{ marginBottom: 6 }}>
              Was passiert wäre
            </div>
            {protokoll.map((z, i) => (
              <div key={i} style={{ fontSize: 12.5, color: 'var(--ck-text-2)' }}>
                {z}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
