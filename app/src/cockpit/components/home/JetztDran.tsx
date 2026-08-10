import type { Posten } from '../../lib/prioritaet'

/**
 * „Jetzt dran" auf dem Homescreen (Phase 2, D4): die obersten drei Posten der
 * einen Rangfolge, in der Zeilen-Grammatik des V5-Mocks.
 *
 * **Keine zweite Rangfolge.** Die Liste kommt fertig sortiert aus
 * `usePosten` → `ordnePosten` (lib/prioritaet.ts) und wird hier nur
 * abgeschnitten. Wer die Reihenfolge ändern will, ändert sie dort — sonst
 * stünde auf dem Homescreen etwas anderes obenauf als im Arbeitsmodus.
 *
 * Auch das Ziel ist nicht neu: jede Zeile führt in denselben Arbeitsmodus, den
 * der „Loslegen"-Knopf öffnet. Ein eigener Tiefensprung je Posten wäre eine
 * zweite Route für dieselbe Arbeit.
 */

/** Die Aufschrift der einen Aktion — je Spur ein Verb, keine neue Logik. */
const SPUR_AKTION: Record<Posten['spur'], string> = {
  kundenaufgabe: 'Öffnen',
  kunde_liegt: 'Nachfassen',
  antwort: 'Antworten',
  loom: 'Aufnehmen',
  erstnachricht: 'Schreiben',
  followup: 'Follow-up',
  anfrage: 'Anfragen',
  inmail: 'InMail',
}

/** Die Meta-Zeile: was diesen Posten fällig macht. */
function meta(p: Posten): { text: string; warnung: boolean } {
  if (p.entwurf && !p.entwurf.veraltet) return { text: 'Entwurf liegt bereit', warnung: false }
  if (p.entwurf?.veraltet) return { text: 'Entwurf veraltet — er hat nachgelegt', warnung: true }
  if (p.starred) return { text: 'Loom zugesagt', warnung: false }
  if (p.firma) return { text: p.firma, warnung: false }
  return { text: p.text.slice(0, 60), warnung: false }
}

export function JetztDran({
  posten,
  entwuerfe,
  laedt,
  onOeffnen,
}: {
  /** Bereits sortiert (`ordnePosten`). Diese Komponente sortiert NICHT. */
  posten: Posten[]
  /** Wartende Entwürfe über alle Spuren (`entwuerfeOffen`). */
  entwuerfe: number
  laedt: boolean
  onOeffnen: () => void
}) {
  const top = posten.slice(0, 3)

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Die zwei Zahlen des Morgens standen bis Phase 2 im Heute-Widget.
          Sie sind nicht verschwunden, sie stehen jetzt an der Überschrift der
          Liste, die sie meinen. */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, paddingLeft: 2 }}>
        <span className="ck-label" style={{ letterSpacing: '0.16em' }}>
          Jetzt dran
        </span>
        {laedt ? null : (
          <span className="ck-zahl" style={{ fontSize: 11, color: 'var(--ck-text-2)' }}>
            {posten.length} offen
            {entwuerfe > 0 ? (
              <span style={{ color: 'var(--ck-accent)' }}>
                {' · '}
                {entwuerfe} {entwuerfe === 1 ? 'Entwurf fertig' : 'Entwürfe fertig'}
              </span>
            ) : null}
          </span>
        )}
      </div>

      {laedt ? (
        <div className="ck-panel" style={{ padding: '18px 16px', fontSize: 13, color: 'var(--ck-text-2)' }}>
          Lädt …
        </div>
      ) : top.length === 0 ? (
        <div className="ck-panel" style={{ padding: '18px 16px', fontSize: 13, color: 'var(--ck-text-2)' }}>
          Nichts offen — für heute ist alles abgearbeitet.
        </div>
      ) : (
        top.map((p) => {
          const m = meta(p)
          return (
            <button
              key={p.id}
              type="button"
              className="ck-panel ck-zeile-karte"
              onClick={onOeffnen}
              aria-label={`${p.name} — im Arbeitsmodus öffnen`}
            >
              <span className="ck-zeile-karte-text">
                <span className="ck-zeile-karte-titel">{p.name}</span>
                <span className={`ck-zeile-karte-meta${m.warnung ? ' ist-warnung' : ''}`}>{m.text}</span>
              </span>
              <span className="ck-zeile-karte-tu">{SPUR_AKTION[p.spur] ?? 'Öffnen'}</span>
            </button>
          )
        })
      )}
    </section>
  )
}
