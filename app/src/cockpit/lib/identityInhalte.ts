/**
 * Die Texte des Identity-OS — Kevins eigene Worte.
 *
 * **Quelle:** Vault `~/Second Brain/00 Kontext/Visionmap 2.0.md`, in der
 * redigierten Fassung aus `visionmap-2.0.html` (16.08.2026, 21:04). Diese HTML
 * trägt in der Fußzeile den Satz „Diese Seite ist die Design-Vorlage für das
 * Identity OS in Uriel" — sie ist damit für Aufbau **und** Wortlaut
 * maßgeblich. Wo Vault und Vorlage sich unterscheiden, gilt die Vorlage: sie
 * ist die spätere Redaktion und deutlich straffer.
 *
 * Warum die Texte als Konstanten im Code stehen und nicht aus dem Vault
 * gelesen werden: der Vault wird nicht mitdeployt und ist vom Handy aus nicht
 * erreichbar. Eine Morgenlese, die vom eingeschalteten Mac abhängt, wäre an
 * genau den Morgen kaputt, an denen sie zählt.
 *
 * **Regel beim Pflegen:** Der Vault bleibt die Quelle der Wahrheit. Wer die
 * Map ändert, ändert sie dort und trägt sie hier nach. Kürzen oder „schöner
 * schreiben" ist nicht erlaubt — das sind Kevins Formulierungen, ihre Wirkung
 * hängt am Wortlaut.
 */

export const VISIONMAP_QUELLE = 'Visionmap 2.0 · Stand 16.08.2026'

// ---------------------------------------------------------------------------
// ☀️ Die Morgenlese (2 Minuten) — was jeden Morgen gelesen wird
// ---------------------------------------------------------------------------

export const MORGENLESE = {
  leitsatz: 'Ich bin ein Verkäufer mit einer Agentur — kein Bastler mit einem Vertriebsproblem.',
  leitsatzFolge: 'Mein Tag beginnt mit dem, was Geld bringt, nicht mit dem, was sich sicher anfühlt.',
  saetze: [
    'Ich bin clean. Mein Kopf gehört mir — Belohnung gibt es abends, wenn ich sie bezahlt habe.',
    'Ich schließe Loops: erledigt, delegiert oder im Kalender. Nichts frisst im Hintergrund meinen Arbeitsspeicher.',
    'Ich bin ein Fels in der Brandung für mein Umfeld. Das beweise ich nicht mit Bildern im Kopf, sondern mit dem heutigen Block.',
  ],
  routine: {
    titel: 'Die eine Routine, die alles trägt',
    kern: '60–90 Minuten Vertrieb, vor allem anderen. ~7 Chats, 1 Loom.',
    zusatz: 'Bei Widerstand: nur 15 Minuten anfangen. Der Rest kommt von allein.',
  },
  standards: ['Durchziehen', 'Sauberkeit', 'Zufriedenheit', 'Clean'],
  warum:
    'Ab 10.000 € MRR kann ein Mensch, der mir wichtig ist, aufhören zu arbeiten. Dafür gehen die Nachrichten raus, auch ohne Lust.',
  afformationen: [
    'Wieso fällt mir der tägliche Vertriebsblock so leicht?',
    'Wieso bin ich so gerne clean?',
    'Wieso mache ich Dinge fertig, bevor ich Neues anfange?',
  ],
} as const

// ---------------------------------------------------------------------------
// Kapitel — jedes mit seinem Bild (Bannerbilder aus der Vorlage)
// ---------------------------------------------------------------------------

export interface Kapitel {
  id: string
  titel: string
  bild: string
}

export const KAPITEL: Record<'identitaet' | 'traumleben' | 'antivision' | 'regeln', Kapitel> = {
  identitaet: { id: 'identitaet', titel: 'Identität', bild: 'kapitel-identitaet.jpg' },
  traumleben: { id: 'traumleben', titel: 'Traumleben', bild: 'kapitel-traumleben.jpg' },
  antivision: { id: 'antivision', titel: 'Anti-Vision', bild: 'kapitel-anti-vision.jpg' },
  regeln: { id: 'regeln', titel: 'Regeln & Lehren', bild: 'kapitel-regeln.jpg' },
}

export const HERO_BILD = 'hero-marmor.jpg'
export const PORTRAET_BILD = 'portraet-visionstext.jpg'

// ---------------------------------------------------------------------------
// Identität
// ---------------------------------------------------------------------------

export interface VerhaltensZeile {
  auftakt: string
  text: string
}

export const VERHALTEN: VerhaltensZeile[] = [
  {
    auftakt: 'Sales-Calls',
    text: 'vorbereitet. Das Skript sitzt, die Recherche ist gemacht, ich führe. Always take control.',
  },
  { auftakt: 'Einwände', text: 'ruhig und neugierig. Ein Einwand ist eine Frage, kein Angriff.' },
  {
    auftakt: 'Preise',
    text: 'klar und ohne Rechtfertigung. 5.000 € Festpreis, Retainer 1.000 / 2.000 €.',
  },
  { auftakt: 'Entscheidungen', text: 'bedacht, dann endgültig. Flexibel in Plänen, starr in Zielen.' },
  { auftakt: 'Routinen', text: 'mechanisch, auch unmotiviert. Klarheit schlägt Motivation.' },
]

export const NICHT_MEHR: string[] = [
  'Kiffen. In keiner Dosis, zu keinem Anlass.',
  'Bauen, bevor der Vertriebsblock gelaufen ist.',
  'Offene Briefe und Loops liegen lassen.',
  'Snoozen. Auf den richtigen Zeitpunkt warten.',
]

export const JEDEN_TAG: string[] = [
  'Der 60–90-Minuten-Block, vor allem anderen.',
  'Sunrise Success Formel + Tagesplan.',
  'Abends: verdiente Belohnung, Reflexion, rechtzeitig ins Bett.',
]

/** Der Visionstext — steht mit Porträt zwischen Check-in und Board. */
export const VISIONSTEXT: string[] = [
  'Kevin Herrmann ist ein charismatischer Mann mit tadellosen Manieren. Er strahlt Erfolg und Souveränität aus. Eigenschaften, die er aufgrund seiner herausfordernden Anfänge besonders zu schätzen weiß. Durch kontinuierliche Arbeit an sich selbst ist Kevin zu einem Fels in der Brandung für sein Umfeld geworden, stets bereit, zu schützen und zu unterstützen.',
  'Kevin ist zuerst Verkäufer und Unternehmer. Er gewinnt jeden Tag neue Kunden, weil Akquise für ihn keine Überwindung ist, sondern Handwerk: ruhig, vorbereitet, in Führung. Ablehnung ist für ihn Information, kein Urteil. Sein Kopf ist klar und gehört ihm.',
  'Durch regelmäßige Checks und eigene Fitness-Tests weiß Kevin, er ist zu 100 % gesund und leistungsfähig. Kevin gleicht einem Marine, was seinen durchtrainierten Körper und seine Leistungsfähigkeit betrifft.',
  'Kevin ist äußerst gepflegt und stets dem Anlass entsprechend gekleidet. Er legt Wert auf hochwertige Materialien und Naturstoffe wie Leinen, Seide, Kaschmir oder Baum-/Wolle. Meist ist Kevin der mit dem besten Duft im Raum.',
  'Kevin spricht drei Sprachen: Deutsch, Englisch und Spanisch. Zudem hat Kevin einen Waffenschein, Flugschein und einen Bootsführerschein. Er besitzt eine bewundernswerte Uhrensammlung. Er fährt einen stilvollen Mercedes-Benz GLE mit Samtfolierung, Ambient-Beleuchtung, Hot-Stone-Massage-Sitzen sowie einem Panorama-/Sternenhimmel.',
  'Zudem verwaltet Kevin ein geniales Immobilienportfolio, bestehend aus Immobilien an Orten, die er als Airbnbs anbietet. Dadurch kann er überall dort wohnen, wo er sich gerade aufhält. Kevin agiert generell sehr durchdacht und effizient.',
  'Seinen Erfolg finanziert Kevin durch ein komplexes Geflecht aus verschiedenen Einkommensströmen, das er sich hart erarbeitet hat, darunter mehrere Unternehmen und kluge Investments. Ein besonders wertvolles Investment ist das in sein überragendes Netzwerk, welches er verstanden hat zu pflegen und zu inspirieren.',
  'Ruhe und Dankbarkeit findet er jeden Abend in seiner Meditation. Ausgeglichenheit in seinen Hobbys wie Schießen, mit dem Boot rausfahren oder Schach. Seine Freizeit verbringt er mit Sport, Essengehen und Reisen mit Freunden und Familie. Er erlebt aktiv die Welt. Abends widmet er sich mindestens eine halbe Stunde dem Lesen, um sich kontinuierlich weiterzubilden.',
  'Kevin Herrmann wurde erst zum Mann, auf den man sich in seiner Rolle verlassen kann, dann zum Seriengründer, der die Verantwortung über alle seine Mitarbeiter und Kunden sowie seine Familie und sein Umfeld trägt — um dann der zu werden, der fremden Menschen dabei helfen wird, ihr volles Potential zu entfalten und einen hundertjährigen Frieden einzuleiten.',
]

// ---------------------------------------------------------------------------
// Traumleben
// ---------------------------------------------------------------------------

export const STUFEN = [
  { zahl: '10 T€', name: 'Freiheit', text: 'Umfeld kann aufhören zu arbeiten (20 Retainer)' },
  { zahl: '15 T€', name: 'Komfort', text: 'Lebenshaltung komplett gedeckt' },
  { zahl: '20 T€', name: 'Traumleben', text: '≈ 40k Umsatz: 5 Neukunden + 25 Retainer' },
] as const

export const STUFEN_FUSS = 'Der Preis dafür ist keine Heldentat: 60–90 fokussierte Minuten Outreach am Tag.'

export const MENSCHEN_ERLEBEN: string[] = [
  'Urlaube: Lisa – Malle · Lisa & Mama – Malle · Mama – Teneriffa · Mama – Polarlichter',
  'Japan · Pyramiden · 4 Reisen im Jahr, Business Class, spontan',
  'Kampfsport 3× die Woche, mindestens 1 Jahr durchgezogen · Schießen · 110 % gesund',
  '10k-Omega für Martin · iPads & 3D-Drucker für die eigenen Projekte',
]

export const BUSINESS_WIRKUNG: string[] = [
  'Agentur mit extrem zufriedenen Mitarbeitern und Kunden: läuft, ohne dass ich etwas tun muss',
  'Live-Events mit glücklichen Teilnehmern · Immobilien-Investments',
  'Awards & Forbes-Listen · Amex Platinum → Centurion',
  'Wohnung mit Dachterrasse + Office · eigene Halle mit Gym, Lager & Electronic Lab · eigene Server · Oldtimer · Frankfurt-Airbnb',
  'Endgame: eigene Insel · eigener Jet · hundertjähriger Frieden',
]

// ---------------------------------------------------------------------------
// Anti-Vision und das Warum
// ---------------------------------------------------------------------------

export interface AntiVisionZeile {
  titel: string
  text: string
}

export const ANTI_VISION: AntiVisionZeile[] = [
  {
    titel: 'Tage ohne einen einzigen Erstkontakt',
    text: 'Ein Tag ohne Outreach ist ein Tag, an dem die Agentur nicht existiert hat.',
  },
  {
    titel: 'Werkzeug-Arbeit als Ersatzhandlung',
    text: 'Bauen fühlt sich wie Arbeit an, verkauft aber nichts.',
  },
  {
    titel: 'Belohnung vor Leistung',
    text: 'Erst die Belohnung, dann der Preis: der Preis überwiegt. Immer.',
  },
  {
    titel: 'Offene Loops im Hintergrund',
    text: 'Erledigt, delegiert oder im Kalender. Alles andere frisst RAM.',
  },
  {
    titel: 'Warten auf den richtigen Zeitpunkt',
    text: 'Ich werde nie mehr so viel Kraft haben wie jetzt.',
  },
]

export const ANTI_VISION_GRUNDSATZ =
  'Deine Welt entsteht aus der Kraft deines Entschlusses sowie aus den Dingen, die du nicht tolerierst.'

export const WARUM = {
  kern: 'Meine Verantwortung gegenüber meiner Freundin und meiner Familie. Ab 10.000 € MRR kann ein Mensch, der mir wichtig ist, mit dem Arbeiten aufhören. Es gab eine Krankheit in der Familie, die sich mit Geld deutlich besser hätte regeln lassen. Für genau solche Situationen baue ich das hier.',
  schluss: 'Und: Ich werde ein extrem guter Arbeitgeber. „Wer mit Kevin arbeitet, verdient Geld, und er ist ehrlich."',
} as const

// ---------------------------------------------------------------------------
// Regeln & Lehren
// ---------------------------------------------------------------------------

export interface Regel {
  titel: string
  text: string
  /** Die eine Regel, die den Tag entscheidet — steht im Akzent. */
  betont?: boolean
}

export const REGELN: Regel[] = [
  { titel: 'Vision', text: 'Jeden Morgen die Sunrise Success Formel. Der werden, der ich sein will, durch das, was ich heute tue.' },
  { titel: 'Schlaf', text: '8 Stunden Regeneration. Aufstehen fängt beim Schlafengehen an. Ich snooze nicht.' },
  {
    titel: 'Routinen',
    text: 'erfüllen, auch unmotiviert. Morgens: Zähne, Wasser, Bewegung, Duschen, Sunrise Success Formel, Dankbarkeit · Abends: Tag geplant, Kleidung rausgelegt, Handy weg, Meditieren, Lesen.',
  },
  {
    titel: 'Gesundheit',
    text: 'Sport nach aktuellem Protokoll · bewusste Ernährung · Prophylaxe · Clean: kein THC, kein Tabak.',
  },
  {
    titel: 'Vertrieb',
    text: '60–90 Minuten Outreach-Block, jeden Werktag, vor allem anderen. Erst wenn der Block gelaufen ist, darf gebaut werden.',
    betont: true,
  },
  { titel: 'Planung', text: 'jeden Tag mit Tagesplan.' },
  { titel: 'Ziele', text: 'Jahres-, Quartals-, Monats- und Wochenpläne.' },
  { titel: 'Beziehungen', text: 'dem Umfeld das Gefühl geben, geliebt zu werden. Jede Rolle voll ausfüllen.' },
  { titel: 'Zeit', text: 'eigene und fremde Zeit ernst nehmen, akkurat damit umgehen.' },
]

export const ACHT_SCHRITTE: string[] = [
  'Be positive',
  'Be prepared',
  'Be on time',
  'Always give 100%',
  'Work your territory',
  'Know what & why',
  'Protect your attitude',
  'Take control',
]

export const HERO_STORY = {
  auftakt:
    'Erst kam ich ins Heim. Dann setzte ich mehrere Ausbildungen in den Sand. Übergewichtig und drogenabhängig verließ ich die Bundeswehr, um in Hamburg auf eigenen Beinen neu anzufangen.',
  absaetze: [
    'Als Salesperson mit viel finanzieller Verantwortung bekam ich Einblicke in die verschiedensten Unternehmen. Was lief gut, was nicht. Ich blieb nie lange. Denn als jemand, dem die kontinuierliche Verbesserung von Prozessen im Blut steckt, ist es ein Krampf, für jemanden zu arbeiten, der stumpfes Abarbeiten erwartet.',
    'Deshalb musste ich ausbrechen. Selbst mit der Verantwortung, die ich trug, ging ich das höchste Risiko mit dem höchsten Return ein. Denn das ist der Platz, an dem ich den höchsten Mehrwert schaffen kann.',
  ],
} as const

export const THEATER = {
  morgens: [
    'Ich stehe morgens als Erstes im Haus auf und gehe mit Zeus raus. Nachdem wir zurück sind und ich ihm Essen gegeben habe, ziehe ich meine Morgenroutine durch wie jeden Tag. Ich genieße guten Kaffee aus einer guten Maschine. Ich ziehe mir für den Tag eine hochwertige, jedoch gemütliche Hose an, dazu ein weißes Hemd. Ich genieße es, meine 2 goldenen Ketten, meinen goldenen Oura-Ring und meine goldene Rolex anzuziehen.',
    'Meiner zurechtgemachten Frau gebe ich einen Kuss und passe auf, dass ihr Lippenstift nicht verwischt. Sie legt darauf Wert, dass ich auf sowas achte.',
    'Dann nehme ich Zeus mit in die Tiefgarage und steige in meinen velvet-folierten Mercedes-Benz GLE. Als Pardon zur hektischen Großstadt höre ich klassische Musik auf dem Weg ins Büro. Im Büro freut sich jeder, mich zu sehen, auch wenn viele schon voll in ihre Arbeit vertieft sind. Ich bin gespannt, was für Herausforderungen heute auf mich warten.',
  ],
  abends: [
    'Nachdem ich schon in der Mittagspause beim Sport war, komme ich nach der Arbeit direkt nach Hause. Auf mich wartet eine zurechtgemachte und wunderschöne Frau, die sich einen halben Tag frei genommen hat, um mein Lieblingsgericht zu kochen. Während wir essen, müssen wir uns dauernd verliebt in die Augen schauen.',
    'Nachdem wir zu dritt nochmal draußen waren und ich inspirierende Gespräche mit meiner Frau führte, starte ich meine Abendroutine wie jeden Tag.',
    'Ich reflektiere den Tag und mir fällt auf, wie viel ich heute gelacht, geliebt und gelernt habe. Dafür bin ich unendlich dankbar.',
  ],
} as const

export interface LehrBlock {
  titel: string
  absaetze: string[]
}

export const LEHREN: LehrBlock[] = [
  {
    titel: 'Grundsätze',
    absaetze: [
      'Fange nichts an, bevor du das andere im Prozess nicht abgeschlossen hast.',
      'Erledigt heißt: erledigt, delegiert oder im Kalender.',
      'Bezahlst du erst und bekommst dann deine Belohnung, überwiegt die Belohnung (Diät). Bekommst du erst die Belohnung und bezahlst dann, überwiegt der Preis (Saufen und Kiffen).',
      'Ich warte auf den richtigen Zeitpunkt? Ich werde nie mehr so viel Kraft haben wie jetzt!',
      'Lasse dir nicht sinnlos Wissen eintrichtern. Mache dich geistig zu dem, was du sein möchtest.',
      'Deine Welt entsteht aus der Kraft deines Entschlusses sowie aus den Dingen, die du nicht tolerierst.',
      'Positive Glaubenssätze + daraus resultierende Gewohnheiten bringen mich an meine Ziele.',
      'Sei flexibel in deinen Plänen, aber starr in deinen Zielen.',
      'Es ist in Ordnung, jetzt zu verzichten, um später mehr zu haben.',
      'Fehler sind die Basis zum Lernen. Wir lernen, wenn wir Erfahrungen reflektieren.',
    ],
  },
  {
    titel: 'Sein → Tun → Haben',
    absaetze: [
      'Erst sein, dann tun, dann haben. Veränderung fließt spirituell → mental → körperlich. Sunrise Success Formel = sein · Block = tun · Traumleben = haben.',
      'Selbstbild schlägt Weltbild. Nicht die richtige Strategie suchen, die richtige Person werden. Das Außen spiegelt das Innen, mit Verzögerung.',
      'Highest Self oder Lowest Self: jeden Tag meine Wahl. „Würde mein Highest Self jetzt so denken, sprechen, handeln?"',
      'Wichtigkeit niedrig halten. Wollen ohne festhalten. Was auf dem Podest steht, läuft weg. Der Block ist so unromantisch wie Zähneputzen; bewertet wird am Tagesende.',
      'Der Test vor dem Durchbruch. Beim Identitätswechsel räumt erst das Alte. Das ist das Räumen, nicht das Scheitern. State halten.',
      'Nicht weglaufen, durchfühlen. Trigger nicht betäuben: hinfühlen, annehmen, Zentrum. „Damals, als ich noch gekifft habe."',
      'Stille als Quelle. 20 Minuten Punkt-Meditation am Morgen. Segel ausrichten statt Boot schieben.',
    ],
  },
  {
    titel: 'Stoische Lehren',
    absaetze: [
      'Grundgedanken: Keine Sorgen über Unkontrollierbares · Es kommt nur auf deine Reaktion an · Demut beim Lernen · Nutze alles, was dir widerfährt · Beginne jetzt, als dein ideales Selbst zu leben.',
      'Amor Fati: Liebe dein Schicksal, deine Herausforderungen gehören dazu. Memento Mori: Du kannst jederzeit sterben; gestalte deine Zeit jetzt so effektiv und schön wie möglich. Kontrolle: Kontrolliere, was du kontrollieren kannst, akzeptiere den Rest.',
      'Die fünf Großen: Zeno · Chrysippos · Seneca · Epiktet · Mark Aurel.',
    ],
  },
  {
    titel: 'Hermetische Gesetze',
    absaetze: [
      'Schöpfung: Gedanken schaffen Realität; alles war erst eine Idee.',
      'Kausalität: Ursache & Wirkung. Karma!',
      'Entsprechung: Die Welt ist dein Spiegelbild.',
      'Gleichgewicht: Die Natur gleicht alles wieder aus.',
      'Polarität: Alles ist gut und schlecht zugleich; wer nicht wertet, manifestiert leichter.',
      'Rhythmus: Nach dem Regen kommt die Sonne. Immer! Einatmen, ausatmen.',
      'Anziehung: Gleiches zieht Gleiches an und wird durch Gleiches verstärkt.',
    ],
  },
  {
    titel: 'Learnings aus Büchern',
    absaetze: [
      'Psychokybernetik: Das Selbstbild ist der Thermostat. Du performst nie dauerhaft darüber hinaus. Mentale Probe funktioniert: das Theater of the Mind IST Maltz’ Methode.',
      'Prinzipien (Dalio): Klare Ziele → Probleme nicht tolerieren → Ursachen diagnostizieren → Plan → Dranbleiben.',
      'Denke nach und werde reich: Alles beginnt mit einer glasklaren Entscheidung.',
      'Die 1%-Methode: Jede Handlung ist eine Stimme für die Person, die du sein willst. Umgebung schlägt Willenskraft. Never miss twice.',
      '10x Rule: Der Hauptfehler ist die 10-fach unterschätzte Aktivitätsmenge. Massive Action ist die Normal-Dosis.',
      'Kunst des Krieges: Jede Schlacht ist gewonnen, bevor sie geschlagen wird. Der höchste Sieg ist der ohne Kampf.',
      '4-Stunden-Woche: 80/20 + Parkinson: enge Zeitfenster erzwingen Fokus. Eliminieren → Automatisieren → Delegieren.',
      '48 Gesetze: Der Ruf ist alles (5) · Taten statt Argumente (9) · Plane bis zum Ende (29).',
      'Kahneman: System 1 entscheidet, System 2 begründet. Entscheide nach Regeln, nicht aus dem Moment.',
      'Buch der fünf Ringe: Du kämpfst, wie du übst. Keine Lieblingswaffe. Setze das Tempo.',
      'Babylon: Zahle dich selbst zuerst. 10 % arbeiten immer für dich.',
      'Kopf schlägt Kapital: Konzept komponieren statt alles selbst machen. Einfachheit ist Stärke.',
      'Psychologie der Massen: Menschen entscheiden in Bildern und Gefühlen. Wer Souveränität ausstrahlt, führt.',
    ],
  },
]

/** Der Schluss: die Afformationen in voller Länge. */
export const AFFORMATIONEN_LANG = {
  stark: [
    'Warum habe ich so viel positive Energie?',
    'Wieso starte ich meine Tage immer so erfolgreich?',
    'Wieso fällt mir der tägliche Vertriebsblock so leicht?',
    'Wieso bin ich so gerne clean?',
  ],
  weitere: [
    'Wieso halte ich meine Routinen?',
    'Wieso mache ich Dinge fertig, bevor ich Neues anfange?',
    'Wieso gehe ich 3-mal zum Sport die Woche?',
    'Warum liebe ich es so, zu lächeln und zu lachen?',
    'Wieso habe ich Erfolg in meiner Arbeit?',
    'Warum bin ich so mächtig?',
    'Warum bin ich so verliebt in das Leben?',
    'Wieso überzeuge ich Kunden?',
  ],
  abends:
    'Abends: Was habe ich heute geschafft? · Was lief besonders gut? · Womit hatte ich zu kämpfen, was lerne ich daraus? · Wofür bin ich besonders dankbar?',
} as const

// ---------------------------------------------------------------------------
// Der Check-in — die drei Einheiten, die abgehakt werden
// ---------------------------------------------------------------------------

export interface CheckinEinheit {
  feld: 'vertriebsblock' | 'clean' | 'sport'
  titel: string
  /** Die eine Zeile darunter — woran man erkennt, dass es erledigt ist. */
  mass: string
}

export const CHECKIN_EINHEITEN: CheckinEinheit[] = [
  { feld: 'vertriebsblock', titel: 'Vertriebsblock', mass: '60–90 Minuten, vor allem anderen' },
  { feld: 'clean', titel: 'Clean geblieben', mass: 'kein THC, kein Tabak' },
  { feld: 'sport', titel: 'Sport', mass: 'nach Trainings- bzw. Reha-Protokoll' },
]

/**
 * Die Energie-Skala. Kevins Ausgangswert im Worksheet vom 16.08. war eine 4
 * („hoch beim Bauen, blockiert beim Senden") — deshalb steht die 4 nicht als
 * Vorbelegung im Regler: ein vorbelegter Wert wäre eine Antwort, die Kevin
 * nicht gegeben hat.
 */
export const ENERGIE_MIN = 1
export const ENERGIE_MAX = 10
