import type { WochenEintrag, Wochenkontrolle } from '../../lib/wochenkontrolle'

/**
 * Die Wochenkontrolle als Tafel (19.08.2026).
 *
 * Kevins Auftrag: „Ein Wochenbericht, der sagt, wer die Kontaktanfrage
 * angenommen hat und wer angeschrieben worden ist, sodass ich am Ende der
 * Woche sehe: gut, da ist kein ICP rübergefallen."
 *
 * Deshalb steht **aussortiert ganz oben**, obwohl es die kleinste Gruppe ist:
 * Das ist die einzige Liste, in der ein Fehler stecken kann. Steht dort ein
 * Makler, hat der Filter danebengegriffen — und das sieht Kevin in drei
 * Sekunden, weil die Headline danebensteht, an der entschieden wurde.
 *
 * Jeder Name ist ein Link aufs Profil: Wer einen Fehltreffer findet, will ihn
 * sofort anschauen, nicht suchen.
 */

function tagKurz(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

function Gruppe({
  titel,
  hinweis,
  eintraege,
  betont = false,
}: {
  titel: string
  hinweis: string
  eintraege: WochenEintrag[]
  betont?: boolean
}) {
  if (eintraege.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="ck-label" style={{ color: betont ? 'var(--ck-warn)' : undefined }}>
        {titel} · {eintraege.length}
      </div>
      <p style={{ fontSize: 12, color: 'var(--ck-text-3)', margin: '0 0 2px' }}>{hinweis}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {eintraege.map((e) => (
          <li key={e.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <a
              href={e.profileUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 14, color: 'var(--ck-text-1)', textDecoration: 'none', minHeight: 24 }}
            >
              {e.name}
              {e.pruefen ? ' · Zuordnung unsicher' : ''}
            </a>
            <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>
              {tagKurz(e.angenommenAt)}
              {e.headline ? ` · ${e.headline}` : ''}
              {e.grund ? ` · Filterwort: „${e.grund}"` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function WochenkontrolleTafel({ kontrolle }: { kontrolle: Wochenkontrolle }) {
  if (kontrolle.alle.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--ck-text-3)', margin: 0 }}>
        In den letzten sieben Tagen hat niemand eine Kontaktanfrage angenommen — oder der
        Netzwerk-Sync ist nicht durchgelaufen.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Gruppe
        titel="Aussortiert"
        hinweis="Hat angenommen, wurde nicht angeschrieben, weil der Filter sie nicht als Zielgruppe liest. Steht hier ein Makler, greift der Filter zu scharf — dann das Wort in icpRegeln.json anfassen."
        eintraege={kontrolle.aussortiert}
        betont
      />
      <Gruppe
        titel="Noch offen"
        hinweis="Zielgruppe, angenommen, aber noch ohne Erstnachricht. Das ist Arbeit, kein Fehler."
        eintraege={kontrolle.offen}
      />
      <Gruppe
        titel="Angeschrieben"
        hinweis="Angenommen und bearbeitet — der Normalfall."
        eintraege={kontrolle.angeschrieben}
      />
    </div>
  )
}
