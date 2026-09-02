import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContacts } from '../../../hooks/useContacts'
import { useCurrentBrandSlug } from '../../../hooks/useCurrentBrandSlug'
import {
  filterPipelineContacts,
  formatEuroDe,
  pipelineValueEuro,
  PIPELINE_STAGES,
  STAGE_LABEL,
  ymdToday,
  type FollowFilter,
  type StageFilter,
} from '../../../lib/salesPipelineFilters'
import { sortPipelineContacts } from '../../../lib/pipelineContactSort'
import { SalesImportDrawer } from '../../../components/sales/SalesImportDrawer'
import type { KanbanColumnSort } from '../../../lib/crmViewStorage'
import type { Contact } from '../../../types/db'

/**
 * Die Lead-Liste im Cockpit-Look (Phase 2, Zug B1 · D5).
 *
 * Nach dem AUFBAU von Close, nicht nach seiner Optik: Filter stehen **in** der
 * Liste statt in einem Panel daneben, ein Satz „Smart Views" nimmt die drei
 * Fragen vorweg, die Kevin morgens sowieso stellt (Wer ist heute fällig? Was
 * ist überfällig? Wo liegt Geld?), und die Zeilen sind dicht mit klarer
 * Hierarchie: Name gross, Firma und Grund klein, rechts der Wert.
 *
 * **Diese Datei filtert und sortiert NICHT selbst.** `filterPipelineContacts`
 * und `sortPipelineContacts` sind die bestehenden Bibliotheken; die Smart
 * Views setzen nur deren Parameter. Sonst gäbe es zwei Antworten auf die Frage
 * „welche Leads sind heute fällig".
 */

/** Ein gespeicherter Blick. Setzt Filter, erfindet keine eigene Auswahl. */
interface SmartView {
  id: string
  label: string
  stage: StageFilter
  follow: FollowFilter
  /** Nur überfällige — die Bibliothek kennt „today" als „heute ODER früher". */
  nurUeberfaellig?: boolean
  /** Nur Kontakte mit diesem Tag — die Bibliothek filtert, hier steht nur der Parameter. */
  tag?: string
}

const SMART_VIEWS: SmartView[] = [
  { id: 'alle', label: 'Alle', stage: 'all', follow: 'all' },
  { id: 'heute', label: 'Heute fällig', stage: 'all', follow: 'today' },
  { id: 'ueberfaellig', label: 'Überfällig', stage: 'all', follow: 'today', nurUeberfaellig: true },
  { id: 'woche', label: 'Diese Woche', stage: 'all', follow: 'week' },
  { id: 'ohne', label: 'Ohne Follow-up', stage: 'all', follow: 'none' },
  { id: 'deal', label: 'Im Deal', stage: 'deal', follow: 'all' },
  // Die Whale-Bank (01.09.2026): ~28 handverlesene Groß-Häuser aus der
  // DACH-Recherche, geseedet über scripts/whales-seed.ts. Ruht ohne
  // Follow-up-Datum — Kevin greift zu, wenn der Tagesvertrieb leer ist.
  { id: 'whales', label: 'Whales', stage: 'all', follow: 'all', tag: 'whale' },
]

/**
 * Nur Sortierungen, die `sortPipelineContacts` schon kennt. „Nach Wert" wäre
 * die einzige, die es dort nicht gibt — sie hier nachzubauen hiesse, eine
 * zweite Sortier-Wahrheit anzulegen. Der Wert steht in jeder Zeile.
 */
const SORTIERUNG: Array<{ id: KanbanColumnSort; label: string }> = [
  { id: 'follow_up', label: 'Follow-up zuerst' },
  { id: 'updated_desc', label: 'Zuletzt bewegt' },
  { id: 'created_desc', label: 'Neueste zuerst' },
  { id: 'name_asc', label: 'Name A → Z' },
]

function datumKurz(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

/**
 * Die Meta-Zeile einer Lead-Zeile. Der GRUND steht vorn, die Firma dahinter —
 * auf 390px wird abgeschnitten, und abgeschnitten werden darf die Firma, nicht
 * „überfällig".
 */
function meta(c: Contact, heute: string): { text: string; warnung: boolean } {
  const firma = c.company || 'Ohne Firma'
  const faellig = c.next_follow_up_at?.slice(0, 10) ?? null
  if (faellig && faellig < heute) return { text: `Überfällig seit ${datumKurz(c.next_follow_up_at)} · ${firma}`, warnung: true }
  if (faellig === heute) return { text: `Heute fällig · ${firma}`, warnung: false }
  if (faellig) return { text: `Follow-up ${datumKurz(c.next_follow_up_at)} · ${firma}`, warnung: false }
  return { text: firma, warnung: false }
}

export function LeadListe() {
  const slug = useCurrentBrandSlug()
  const navigate = useNavigate()
  const contacts = useContacts(slug)

  const [viewId, setViewId] = useState('alle')
  const [q, setQ] = useState('')
  const [stage, setStage] = useState<StageFilter>('all')
  const [sortierung, setSortierung] = useState<KanbanColumnSort>('follow_up')
  /** Zug B3: nach Stufe gruppieren statt eine lange Liste. */
  const [gruppiert, setGruppiert] = useState(false)
  /**
   * D9: Der Listen-Import bleibt funktional erhalten und bekommt nur die neue
   * Huelle. Es ist DERSELBE Drawer wie in der Altwelt — Kevin braucht ihn
   * selten, aber wenn, dann braucht er ihn.
   */
  const [importOffen, setImportOffen] = useState(false)

  const view = SMART_VIEWS.find((v) => v.id === viewId) ?? SMART_VIEWS[0]
  const heute = ymdToday()

  const gefiltert = useMemo(() => {
    const basis = filterPipelineContacts(contacts.items, {
      q,
      // Der Stufen-Filter der Leiste sticht den der Ansicht — wer ihn anfasst,
      // meint ihn.
      stage: stage !== 'all' ? stage : view.stage,
      follow: view.follow,
      potenzial: 'all',
      tag: view.tag,
    })
    const eng = view.nurUeberfaellig
      ? basis.filter((c) => (c.next_follow_up_at?.slice(0, 10) ?? '') < heute)
      : basis
    return sortPipelineContacts(eng, sortierung)
  }, [contacts.items, q, stage, view, sortierung, heute])

  const gruppen = useMemo(() => {
    if (!gruppiert) return null
    return PIPELINE_STAGES.map((s) => ({
      stufe: s,
      leads: gefiltert.filter((c) => c.pipeline_stage === s),
    })).filter((g) => g.leads.length > 0)
  }, [gruppiert, gefiltert])

  const wert = pipelineValueEuro(gefiltert)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Kopf: was da ist, und was es wert ist. */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 600 }}>Leads</span>
          <span className="ck-zahl" style={{ fontSize: 12, color: 'var(--ck-text-2)' }}>
            {gefiltert.length} von {contacts.items.length}
            {wert > 0 ? ` · ${formatEuroDe(wert)}` : ''}
          </span>
        </div>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="ck-btn" onClick={() => setImportOffen(true)}>
            Importieren
          </button>
          <button type="button" className="ck-btn ck-btn--primary" onClick={() => navigate('/sales/new')}>
            Neuer Lead
          </button>
        </span>
      </div>

      {/* Smart Views — die Fragen des Morgens als Pillen. */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {SMART_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`ck-btn${v.id === viewId ? ' ck-btn--primary' : ''}`}
            onClick={() => setViewId(v.id)}
            style={{ flexShrink: 0 }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Inline-Filter: in der Liste, nicht in einem Panel daneben. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="ck-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, Firma, E-Mail …"
          aria-label="Leads durchsuchen"
          style={{ flex: '1 1 180px', minWidth: 0 }}
        />
        <select
          className="ck-select"
          value={stage}
          onChange={(e) => setStage(e.target.value as StageFilter)}
          aria-label="Stufe"
        >
          <option value="all">Alle Stufen</option>
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="ck-select"
          value={sortierung}
          onChange={(e) => setSortierung(e.target.value as KanbanColumnSort)}
          aria-label="Sortierung"
        >
          {SORTIERUNG.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`ck-btn${gruppiert ? ' ck-btn--primary' : ''}`}
          onClick={() => setGruppiert((g) => !g)}
          aria-pressed={gruppiert}
        >
          Nach Stufe
        </button>
      </div>

      {contacts.loading ? (
        <div className="ck-panel" style={{ padding: '24px 16px', fontSize: 13, color: 'var(--ck-text-2)' }}>
          Lädt …
        </div>
      ) : gefiltert.length === 0 ? (
        <div className="ck-panel" style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--ck-text-2)' }}>
          Kein Lead passt zu diesem Blick.
        </div>
      ) : gruppen ? (
        gruppen.map((g) => (
          <section key={g.stufe} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', paddingLeft: 2 }}>
              <span className="ck-label">{STAGE_LABEL[g.stufe]}</span>
              <span className="ck-zahl" style={{ fontSize: 11, color: 'var(--ck-text-2)' }}>{g.leads.length}</span>
            </div>
            {g.leads.map((c) => (
              <LeadZeile key={c.id} contact={c} heute={heute} onOeffnen={() => navigate(`/sales/${c.id}`)} />
            ))}
          </section>
        ))
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {gefiltert.map((c) => (
            <LeadZeile key={c.id} contact={c} heute={heute} onOeffnen={() => navigate(`/sales/${c.id}`)} />
          ))}
        </div>
      )}

      <SalesImportDrawer open={importOffen} onClose={() => setImportOffen(false)} brandSlug={slug} />
    </div>
  )
}

function LeadZeile({
  contact,
  heute,
  onOeffnen,
}: {
  contact: Contact
  heute: string
  onOeffnen: () => void
}) {
  const m = meta(contact, heute)
  const wert = contact.potenzial_betrag ?? 0
  return (
    <button type="button" className="ck-panel ck-zeile-karte" onClick={onOeffnen} aria-label={`${contact.name} öffnen`}>
      <span className="ck-zeile-karte-text">
        <span className="ck-zeile-karte-titel">{contact.name || 'Ohne Namen'}</span>
        <span className={`ck-zeile-karte-meta${m.warnung ? ' ist-warnung' : ''}`}>{m.text}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {wert > 0 ? (
          <span className="ck-zahl" style={{ fontSize: 12.5, color: 'var(--ck-text-2)' }}>{formatEuroDe(wert)}</span>
        ) : null}
        <span className="ck-chip">{STAGE_LABEL[contact.pipeline_stage]}</span>
      </span>
    </button>
  )
}
