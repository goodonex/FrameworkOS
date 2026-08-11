/**
 * Uriel-Werkzeuge — die Fähigkeiten, die Uriel im Cockpit hat.
 * Definitionen (Anthropic-Schema) hier; die Ausführung (Executor) liegt im
 * Client (UrielDock), weil UI-Tools React-State treiben und Daten-Tools die
 * eingeloggte Supabase-Session brauchen. Beide Seiten leben im Repo und werden
 * zusammen reviewt.
 */
import { METRIC_FIELDS, METRIK_LABEL } from './metrikFelder'

export interface UrielTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/** „li_anfragen = Vernetzungsanfragen (LinkedIn) · …" — die Feldkarte für Uriel. */
const FELD_KARTE = METRIC_FIELDS.map((f) => `${f} = ${METRIK_LABEL[f]}`).join(' · ')

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
  // ---- Tracking schreiben (Client führt aus, über useDailyMetrics) ----
  {
    name: 'log_metric',
    description:
      'Trägt Kevins Tages-Tracking in daily_metrics ein — das einzige Werkzeug, das Zahlen SCHREIBT. ' +
      'Nutze es, wenn Kevin sagt, was er getan hat („trag 30 Vernetzungsanfragen ein", „ich hab heute 5 Looms gemacht", ' +
      '„gestern 12 Follow-ups"). Der Wert wird ADDIERT, nicht überschrieben — steht für den Tag schon etwas, kommt es dazu. ' +
      'Zum Korrigieren einen negativen Wert schicken. Nur EIN Feld je Aufruf; für mehrere Angaben mehrfach aufrufen. ' +
      `Feldkarte: ${FELD_KARTE}. ` +
      'Umsatz kann dieses Werkzeug NICHT — der wird gesetzt, nicht addiert; dafür auf /tracking verweisen. ' +
      'Nenne in deiner Antwort den zurückgegebenen Tages- und Wochenstand, damit Kevin einen Vertipper sofort sieht.',
    input_schema: {
      type: 'object',
      properties: {
        feld: {
          type: 'string',
          enum: [...METRIC_FIELDS],
          description: 'Das Metrik-Feld. Nur exakt diese Namen — nichts erfinden oder ableiten.',
        },
        wert: {
          type: 'integer',
          description: 'Wie viel dazukommt. Negativ zum Korrigieren (z.B. -5). 0 ist nicht erlaubt.',
        },
        datum: {
          type: 'string',
          description:
            'Optional, Format YYYY-MM-DD. Ohne Angabe: heute. Nur Vergangenheit bis 45 Tage zurück; die Zukunft lehnt das Werkzeug ab.',
        },
      },
      required: ['feld', 'wert'],
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
      'Kevins Vertriebs-Zahlen von HEUTE (bis jetzt) für die aktive Brand: Anfragen, ' +
      'Nachrichten, Looms, vereinbarte Termine, Abschlüsse, Umsatz. ' +
      'HERKUNFT, die in die Auskunft gehoert: das sind AUSSCHLIESSLICH von Hand gebuchte ' +
      'Zahlen (Zaehl-Modus, QuickTrack, log_metric) — nicht von LinkedIn gemessen. Eine 0 ' +
      'heisst „noch nicht gebucht", nicht zwingend „nicht gemacht". Was tatsaechlich im ' +
      'Postfach passiert ist, steht in get_linkedin_postfach.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_week_vitals',
    description:
      'Die Wochen-Vitals der aktiven Brand: je Kategorie (Anfragen, Nachrichten, Looms, ' +
      'Termine, Abschlüsse) der Stand gegen das Wochenziel. Die Woche laeuft MONTAG bis ' +
      'SONNTAG der laufenden Kalenderwoche — nicht „die letzten 7 Tage". Am Montagmorgen ' +
      'stehen die Zahlen deshalb naturgemaess bei fast null; das ist kein Einbruch. ' +
      'Gleiche Herkunft wie get_today_kpis: von Hand gebucht, nicht gemessen.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_month_revenue',
    description:
      'Der Monatsumsatz der aktiven Brand gegen das Monatsziel, dazu der bis heute faellige ' +
      'Soll-Stand. Der Soll-Verlauf ist BACK-LOADED, nicht linear: er steigt zum Monatsende ' +
      'hin staerker, weil Akquise dem Ergebnis nachlaeuft. Aus „Soll bis heute" darf also ' +
      'nicht Monatsziel geteilt durch Tage gerechnet werden.',
    input_schema: { type: 'object', properties: {} },
  },
  // ---- LinkedIn-Postfach (11.08.) ----
  /**
   * Uriel behauptete auf die Frage „wie viele haben angenommen" sinngemaess,
   * das Cockpit kenne nur handgetippte Zahlen. Das stimmte nicht: der
   * Voyager-Sync spiegelt Kevins Postfach nach `linkedin_threads`. Uriel hatte
   * nur kein Werkzeug dafuer — also erzaehlte es etwas ueber die App, statt
   * nachzusehen. Ab hier kann es nachsehen.
   *
   * Was es damit NICHT kann, steht ausdruecklich in der Beschreibung: wer eine
   * offene Vernetzungsanfrage angenommen hat, steht in keinem gespiegelten
   * Datensatz. Ein Werkzeug, das seine eigene Grenze nicht nennt, laedt zum
   * naechsten selbstbewussten Irrtum ein.
   */
  /**
   * Die Eimer-Namen standen hier zuerst OHNE Bedeutung — nur als Liste. Uriel
   * hat sich daraufhin ausgedacht, was `faellig` heisst, und Kevin gesagt, das
   * seien 61 Leute ohne Erstnachricht. Das Gegenteil ist der Fall: in `faellig`
   * liegt nur, wo Kevin BEREITS geschrieben hat und das Follow-up ueberfaellig
   * ist. Haette er danach gehandelt, waeren 61 zweite „erste" Nachrichten
   * rausgegangen. Seitdem steht jede Bedeutung ausgeschrieben da.
   */
  {
    name: 'get_linkedin_postfach',
    description:
      'Der Stand von Kevins LinkedIn-Postfach, wie ihn der Voyager-Sync gespiegelt hat. ' +
      'Ein Thread existiert hier NUR, wenn schon eine Unterhaltung laeuft. Die Eimer ' +
      'bedeuten genau das hier — nicht raten, sondern diese Bedeutung benutzen: ' +
      '`faellig` = Kevin hat zuletzt geschrieben und das Follow-up ist ueberfaellig ' +
      '(3/7/14 Tage je Stufe); `du_bist_dran` = der Lead hat geantwortet, Kevin ist am Zug; ' +
      '`wartet` = Kevin hat geschrieben, die Frist laeuft noch; ' +
      '`verwaist` = Kevin hat vor ueber 30 Tagen geschrieben und nie nachgefasst; ' +
      '`abschluss` = drei Follow-ups durch, Break-up faellig; ' +
      '`pruefen` = Sync unsicher, wer zuletzt schrieb; `ruht` = archiviert, gewonnen, ' +
      'verloren oder schlafen gelegt. ' +
      'In ALLEN diesen Eimern hat Kevin bereits geschrieben — ausser `du_bist_dran` und ' +
      '`pruefen`. Keiner davon beantwortet „an wen muss ich noch eine Erstnachricht ' +
      'schicken": dafuer gibt es das Feld `erstnachrichten_offen` in der Antwort. ' +
      'Auch dessen Herkunft gehoert in die Auskunft: das sind die VORBEREITETEN ' +
      'Erstnachrichten aus dem letzten Lauf des linkedin-leads-Skills, die noch nicht ' +
      'verschickt sind. Wer erst nach diesem Lauf angenommen hat oder als Off-ICP ' +
      'aussortiert wurde, steht NICHT darin — die Zahl ist der Arbeitsvorrat mit fertigem ' +
      'Text, nicht die Gesamtzahl aller Angenommenen. ' +
      'Und wer eine OFFENE Vernetzungsanfrage angenommen hat, steht hier gar nicht — ' +
      'das spiegelt der Sync nicht.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_linkedin',
    description:
      'Sucht eine Person im gespiegelten LinkedIn-Postfach (Name oder Firma) und gibt ' +
      'zurueck, in welchem Eimer sie liegt, wer zuletzt geschrieben hat, wann das war, ' +
      'ob ein Entwurf bereitliegt und ob sie einen Stern hat. Damit laesst sich „habe ich ' +
      'dem schon geschrieben" beantworten, ohne dass Kevin nachsieht.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Name oder Firma' } },
      required: ['query'],
    },
  },
  {
    name: 'search_contacts',
    description:
      'Sucht CRM-Kontakte der aktiven Brand nach Name oder Firma. Liefert id, Name, Firma, ' +
      'Pipeline-Stufe und geschaetztes Potenzial. Nutze die id danach fuer open_contact. ' +
      'Die Stufen bedeuten genau das hier — nicht raten: ' +
      '`first_contact` = angeschrieben, noch kein Gespraech; ' +
      '`conversation` = im Gespraech; ' +
      '`follow_up` = wartet auf Nachfassen; ' +
      '`proposal` = Angebot draussen; ' +
      '`deal` = gewonnen; ' +
      '`paused` = zurueckgestellt. ' +
      'Das Potenzial ist eine SCHAETZUNG von Kevin, kein vereinbarter Betrag.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
]
