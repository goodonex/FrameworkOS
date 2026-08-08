/**
 * Das große Widget des Homescreens (O18, Zug 2): Tagesansage, die zwei Zahlen
 * des Morgens und der Loslegen-Knopf.
 *
 * **Widget = Arbeit, Icon = Absprung** (Gesetz 1 der Blaupause). Deshalb steht
 * hier oben, was zu tun ist — und nicht eine Icon-Wand, durch die man sich erst
 * klicken müsste (Klick-Ökonomie: Öffnen → Loslegen → erster Posten).
 *
 * Das Widget rechnet nichts. Alle Werte kommen als Props aus dem einen
 * Eltern-Container, der die Hooks ruft — sonst hätte jedes Widget eigene
 * Subscriptions (Muster `arbeitsmodusTracking`: Deps injizieren).
 */
export function HeuteWidget({
  ansage,
  offen,
  entwuerfe,
  laedt,
  onLoslegen,
}: {
  /** Zeile aus `tagesansage(geordnet, dauern, jetzt)`. */
  ansage: string
  offen: number
  entwuerfe: number
  /** Solange die Quellen laden, steht hier eine Skeleton-Zeile statt „Nichts offen". */
  laedt: boolean
  onLoslegen: () => void
}) {
  return (
    <section className="ck-panel" aria-label="Heute" style={{ padding: '12px 14px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <span className="ck-label" style={{ color: offen ? 'var(--ck-accent)' : 'var(--ck-text-3)' }}>
          Heute
        </span>
        {laedt ? null : (
          <span
            style={{
              fontSize: 26,
              lineHeight: 1,
              color: offen ? 'var(--ck-accent)' : 'var(--ck-text-3)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {offen}
          </span>
        )}
      </div>

      {/* Ladeflacker-Gegenzug (Zug 3): beim ersten Frame ist `geordnet` leer —
          ohne diese Weiche stünde für einen Moment „Liste leer" da, obwohl
          gleich 209 Posten kommen. */}
      {laedt ? (
        <div
          aria-hidden
          style={{
            height: 13,
            width: '72%',
            marginTop: 10,
            borderRadius: 3,
            background: 'var(--ck-border)',
          }}
        />
      ) : (
        <p style={{ margin: '8px 0 0', fontSize: 13.5, color: 'var(--ck-text-2)', lineHeight: 1.5 }}>{ansage}</p>
      )}

      {!laedt && entwuerfe > 0 ? (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ck-accent)' }}>
          {entwuerfe} {entwuerfe === 1 ? 'Entwurf fertig' : 'Entwürfe fertig'}
        </p>
      ) : null}

      {/* Ein Knopf, ein Ziel — derselbe wie auf /morgen (D4: gleiche Bausteine,
          gleiche Zahlen), damit Push-Landung und Homescreen nicht auseinanderlaufen. */}
      <button
        type="button"
        className="ck-btn ck-btn--primary"
        onClick={onLoslegen}
        disabled={laedt || offen === 0}
        style={{ width: '100%', minHeight: 54, fontSize: 15, marginTop: 12 }}
      >
        {laedt ? 'Lädt …' : offen === 0 ? 'Nichts offen' : 'Loslegen'}
      </button>
    </section>
  )
}
