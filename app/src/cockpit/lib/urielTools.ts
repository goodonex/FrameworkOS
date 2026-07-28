/**
 * Uriel-Werkzeuge — die Fähigkeiten, die Uriel im Cockpit hat.
 * Definitionen (Anthropic-Schema) hier; die Ausführung (Executor) liegt im
 * Client (UrielDock), weil UI-Tools React-State treiben und Daten-Tools die
 * eingeloggte Supabase-Session brauchen. Beide Seiten leben im Repo und werden
 * zusammen reviewt.
 */
export interface UrielTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const URIEL_TOOLS: UrielTool[] = [
  // ---- Gedächtnis (Client persistiert lokal) ----
  {
    name: 'remember',
    description:
      'Merkt dir dauerhaft einen kurzen Fakt über Kevin oder seine Arbeit (Präferenz, Kontext, Entscheidung, Person), damit du ihn in KÜNFTIGEN Gesprächen kennst. Nutze das still im Hintergrund, wenn etwas Merkenswertes fällt — kündige es nicht groß an. Ein Fakt = ein knapper Satz.',
    input_schema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'Der zu merkende Fakt, ein knapper Satz.' },
      },
      required: ['fact'],
    },
  },
  // ---- UI-Steuerung (Client führt aus) ----
  {
    name: 'set_graph_view',
    description:
      'Schaltet den Nebula-Graphen im Cockpit auf eine der Ansichten. "leads" = Vertriebs-Pipelines (Kaltakquise/Loom/Sales), "rings" = Betriebssystem-Ringe (Skills/Memory/Routines/Apps), "nebula" = Galaxie-Cluster nach Bereich, "workflows" = Agenten und ihre letzten Läufe (Status-Farben). Nutze das, wenn Kevin eine Ansicht sehen will.',
    input_schema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: ['rings', 'nebula', 'leads', 'workflows'] },
      },
      required: ['view'],
    },
  },
  {
    name: 'search_graph',
    description:
      'Durchsucht/hebt Knoten im Nebula-Graphen hervor (Nicht-Treffer werden gedimmt). Leerer String hebt die Suche auf. Gut für "zeig mir X im Graphen".',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'navigate',
    description:
      'Navigiert zu einem Cockpit-Bereich. cockpit=Startseite/Graph, sales=Kontakte/Pipeline/Bibliothek (crm=Alias, gleiches Ziel), projekte=Kundenprojekte, ads=Ad-Review, content=Social/Content, agenten=Agenten-Hub, email=E-Mail, tracking=KPI-Tracking.',
    input_schema: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          enum: ['cockpit', 'sales', 'crm', 'projekte', 'ads', 'content', 'agenten', 'email', 'tracking'],
        },
      },
      required: ['area'],
    },
  },
  {
    name: 'set_active_brand',
    description:
      'Wechselt die aktive Brand im Cockpit (per Slug, z.B. "herrmann"). Nur nutzen, wenn Kevin ausdrücklich die Brand wechseln will.',
    input_schema: {
      type: 'object',
      properties: { slug: { type: 'string' } },
      required: ['slug'],
    },
  },
  {
    name: 'open_contact',
    description:
      'Öffnet einen konkreten CRM-Kontakt (per contact_id, wie von search_contacts geliefert). Führt zur Kontakt-Detailansicht.',
    input_schema: {
      type: 'object',
      properties: { contact_id: { type: 'string' } },
      required: ['contact_id'],
    },
  },
  // ---- Daten lesen (Client führt aus, aus geladenem Cockpit-State) ----
  {
    name: 'get_today_kpis',
    description:
      'Liefert Kevins Vertriebs-Zahlen von HEUTE für die aktive Brand: Anfragen, Nachrichten, Looms, vereinbarte Termine, Abschlüsse, Umsatz.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_week_vitals',
    description:
      'Liefert die Wochen-Vitals der aktiven Brand: je Kategorie (Anfragen, Nachrichten, Looms, Termine, Abschlüsse) der aktuelle Stand gegen das Wochenziel.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_month_revenue',
    description:
      'Liefert den Monatsumsatz der aktiven Brand gegen das Monatsziel (und den bis heute fälligen Soll-Stand).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_contacts',
    description:
      'Sucht CRM-Kontakte der aktiven Brand nach Name oder Firma. Liefert Treffer mit id, Name, Firma, Pipeline-Stage und geschätztem Potenzial. Nutze die id danach für open_contact.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
]
