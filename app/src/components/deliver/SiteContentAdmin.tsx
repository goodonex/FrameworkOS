import { useState } from 'react'
import { useSiteContent } from '../../hooks/useSiteContent'
import type { SiteContentField, SiteContentFieldDef } from '../../hooks/useSiteContent'

/**
 * Owner-Seite des Website-CMS (in ProjectPage): freigeben was der Kunde als
 * Entwurf gespeichert hat (Alt→Neu-Diff), plus Feld-Definitionen anlegen
 * (key/label/typ/section). Nur additive DB-Operationen.
 */

const FIELD = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 9,
  background: 'var(--ck-panel)',
  border: '1px solid var(--ck-border)',
  color: 'var(--ck-text-1)',
  fontSize: 13,
} as const

function DiffRow({
  field,
  onApprove,
  onDiscard,
}: {
  field: SiteContentField
  onApprove: () => void
  onDiscard: () => void
}) {
  const isImg = field.field_type === 'image'
  return (
    <div
      className="ck-panel"
      style={{ borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{field.label}</span>
        <span className="font-mono" style={{ fontSize: 10.5, color: 'var(--ck-text-3)' }}>
          {field.section} · {field.field_key}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--ck-text-3)', marginBottom: 3 }}>
            LIVE
          </div>
          {isImg ? (
            field.value_published ? (
              <img src={field.value_published} alt="" style={{ maxWidth: '100%', borderRadius: 6, maxHeight: 90 }} />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>—</span>
            )
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--ck-text-2)', whiteSpace: 'pre-wrap' }}>
              {field.value_published || '—'}
            </div>
          )}
        </div>
        <div>
          <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--ck-accent)', marginBottom: 3 }}>
            NEU (Kunde)
          </div>
          {isImg ? (
            field.value_draft ? (
              <img src={field.value_draft} alt="" style={{ maxWidth: '100%', borderRadius: 6, maxHeight: 90 }} />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--ck-text-3)' }}>—</span>
            )
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--ck-text-1)', whiteSpace: 'pre-wrap' }}>
              {field.value_draft || '—'}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="font-mono"
          onClick={onDiscard}
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--ck-border-strong)', background: 'transparent', color: 'var(--ck-text-3)', cursor: 'pointer' }}
        >
          Verwerfen
        </button>
        <button
          type="button"
          className="font-mono"
          onClick={onApprove}
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--ck-accent)', background: 'color-mix(in srgb, var(--ck-accent) 14%, transparent)', color: 'var(--ck-accent)', cursor: 'pointer' }}
        >
          Freigeben
        </button>
      </div>
    </div>
  )
}

export function SiteContentAdmin({ projectId }: { projectId: string }) {
  const { fields, pending, loading, error, approve, discardDraft, seedFields, removeField } =
    useSiteContent(projectId)
  const [showDefs, setShowDefs] = useState(false)
  const [def, setDef] = useState<SiteContentFieldDef>({
    field_key: '',
    section: 'Startseite',
    label: '',
    field_type: 'text',
    value_published: '',
  })

  const addField = () => {
    if (!def.field_key.trim() || !def.label.trim()) return
    void seedFields([{ ...def, field_key: def.field_key.trim(), label: def.label.trim() }])
    setDef({ field_key: '', section: def.section, label: '', field_type: 'text', value_published: '' })
  }

  if (loading) return null

  return (
    <div className="ck-panel" style={{ borderRadius: 16, padding: 20, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Website-Inhalte (CMS)</h3>
        <button
          type="button"
          className="font-mono"
          onClick={() => setShowDefs((s) => !s)}
          style={{ fontSize: 11, padding: '5px 11px', borderRadius: 8, border: '1px solid var(--ck-border-strong)', background: 'transparent', color: 'var(--ck-text-2)', cursor: 'pointer' }}
        >
          {showDefs ? 'Felder ausblenden' : `Felder verwalten (${fields.length})`}
        </button>
      </div>
      <p className="font-mono" style={{ fontSize: 11.5, color: 'var(--ck-text-3)', margin: '0 0 14px', lineHeight: 1.5 }}>
        Der Kunde bearbeitet diese Felder im Portal. Änderungen erscheinen hier zur Freigabe und
        gehen erst danach live (die Website liest nur freigegebene Werte).
      </p>

      {error ? <p style={{ fontSize: 12, color: 'var(--ck-warn)' }}>{error}</p> : null}

      {pending.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: showDefs ? 16 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--accent-amber, #d97706)' }}>
              {pending.length} Änderung(en) warten auf Freigabe
            </span>
            <button
              type="button"
              className="font-mono"
              onClick={() => void approve(pending.map((f) => f.id))}
              style={{ fontSize: 11, padding: '5px 12px', borderRadius: 8, border: '1px solid var(--ck-accent)', background: 'color-mix(in srgb, var(--ck-accent) 18%, transparent)', color: 'var(--ck-accent)', cursor: 'pointer' }}
            >
              Alle freigeben
            </button>
          </div>
          {pending.map((f) => (
            <DiffRow
              key={f.id}
              field={f}
              onApprove={() => void approve([f.id])}
              onDiscard={() => void discardDraft(f.id)}
            />
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: 'var(--ck-text-3)', margin: 0 }}>
          Keine offenen Änderungen.
        </p>
      )}

      {showDefs ? (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--ck-border)', paddingTop: 14 }}>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--ck-text-2)', marginBottom: 8 }}>
            Feld anlegen
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input
              placeholder="Label (z.B. Überschrift Startseite)"
              value={def.label}
              onChange={(e) => setDef((d) => ({ ...d, label: e.target.value }))}
              style={FIELD}
            />
            <input
              placeholder="Key (z.B. hero.title)"
              value={def.field_key}
              onChange={(e) => setDef((d) => ({ ...d, field_key: e.target.value }))}
              style={FIELD}
            />
            <input
              placeholder="Sektion (z.B. Startseite)"
              value={def.section}
              onChange={(e) => setDef((d) => ({ ...d, section: e.target.value }))}
              style={FIELD}
            />
            <select
              value={def.field_type}
              onChange={(e) => setDef((d) => ({ ...d, field_type: e.target.value as SiteContentFieldDef['field_type'] }))}
              style={FIELD}
            >
              <option value="text">Text (kurz)</option>
              <option value="textarea">Text (lang)</option>
              <option value="image">Bild</option>
            </select>
          </div>
          {def.field_type !== 'image' ? (
            <input
              placeholder="Aktueller Wert (optional, geht direkt live)"
              value={def.value_published}
              onChange={(e) => setDef((d) => ({ ...d, value_published: e.target.value }))}
              style={{ ...FIELD, marginBottom: 8 }}
            />
          ) : null}
          <button
            type="button"
            className="font-mono"
            onClick={addField}
            style={{ fontSize: 11, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--ck-idle)', background: 'color-mix(in srgb, var(--ck-idle) 14%, transparent)', color: 'var(--ck-idle)', cursor: 'pointer' }}
          >
            Feld hinzufügen
          </button>

          {fields.length > 0 ? (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {fields.map((f) => (
                <div
                  key={f.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ck-text-2)' }}
                >
                  <span className="font-mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.section} · {f.label}{' '}
                    <span style={{ color: 'var(--ck-text-3)' }}>({f.field_type})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Feld „${f.label}" löschen?`)) void removeField(f.id)
                    }}
                    aria-label={`${f.label} löschen`}
                    style={{ background: 'none', border: 'none', color: 'var(--ck-warn)', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
