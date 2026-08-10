# Sales-Neubau — Paritäts-Karte (Zug B0, 2026-08-10)

Die Checkliste für **B7 („Abriss nach Parität")**. Sie hält fest, was die
Glass-Altwelt kann, wohin es im Neubau geht — und was bewusst **nicht**
mitkommt. Gesetz 8 der Blaupause: Alt-Code fliegt erst, wenn hier jede Zeile
abgehakt ist. Steht auch nur eine auf „offen", gilt **Abbruch statt Abriss**.

## Die Altwelt

| Datei | Zeilen | Rolle |
|---|---|---|
| `pages/sales/SalesMode.tsx` | 2.500 | Pipeline + Listen, fünf Ansichts-Modi, Bulk, Drawer |
| `pages/sales/ContactPage.tsx` | 638 | Lead-Detail (Stammdaten links, Phase/Timeline rechts) |
| `pages/sales/ContactListsContent.tsx` | 1.175 | Kontaktlisten, in SalesMode eingebettet |
| `pages/sales/CallModePage.tsx` | 641 | Anruf-Modus (D6: geparkte Insel) |
| `pages/sales/SalesNewLeadPage.tsx` | 50 | Neuer Lead |
| `cockpit/pages/SalesDashboard.tsx` | 700 | Kachel-Dashboard „Jetzt dran" + Arbeitsmodus — **bleibt** |

## Funktion für Funktion

| # | Funktion der Altwelt | Wohin | Stand |
|---|---|---|---|
| 1 | Schnellsuche über Name/Firma | Neue Liste, Inline-Filter | **B1** |
| 2 | Filter Stufe / Follow-up / Potenzial / Produkt | Neue Liste, Inline-Filter | **B1** |
| 3 | Gespeicherte CRM-Filter je Marke (`crmFilters`) | Smart Views der neuen Liste | **B1** |
| 4 | Sortierung (Follow-up, Wert, Name, Aktivität) | Neue Liste, Spaltenkopf | **B1** |
| 5 | Pipeline-Wert als Summe (€) | Kopfzeile der neuen Liste | **B1** |
| 6 | Stufen-Gruppierung / Stufen-Spalte | Neue Liste, Gruppen-Modus | **B3** |
| 7 | Lead-Detail: Stammdaten, Felder, Speicherstatus | Neues Detail, Seitenspalte | **B2** |
| 8 | Lead-Detail: Aktivitäts-Timeline, Notizen, Anruf-Ergebnis | Neues Detail, Mitte | **B2** |
| 9 | Lead-Detail: Opportunities / Phasen-Kopf | Neues Detail, Mitte | **B2** |
| 10 | Lead-Detail: Deliver-Projekt-Verknüpfung | Neues Detail, Seitenspalte | **B2** |
| 11 | Follow-up „+N Tage" | Neues Detail + Listen-Zeile | **B2** |
| 12 | Skripte/Vorlagen am Lead | Ressourcen-Panel im Detail | **B4** |
| 13 | Bibliothek als eigener Bereich | „Ressourcen" | **B4** |
| 14 | Listen-Import (CSV) | Gleicher Drawer, neue Hülle | **B6** |
| 15 | Call-Mode | Bleibt unangetastet, Hinweis-Banner | **B5** (D6) |
| 16 | Kanban mit Drag & Drop (Stufe ziehen) | — | **bleibt Altwelt** (D7: kein Kanban-Zwang) |
| 17 | Fünf Ansichts-Modi (Karten/Kanban/Liste/Tabelle/Karussell) | — | **bleibt Altwelt** |
| 18 | Mehrfachauswahl + Bulk (Stufe, Follow-up, Tag, Löschen) | — | **bleibt Altwelt** |
| 19 | Schnell-Lead-Erfassung inkl. Dubletten-Prüfung | — | **bleibt Altwelt** (`/sales/new` bleibt) |
| 20 | E-Mail-Vorlagen-Drawer | — | **bleibt Altwelt** |
| 21 | Meeting-Link-Drawer | — | **bleibt Altwelt** |
| 22 | Pipeline-Umschalter (mehrere Pipelines) | — | **bleibt Altwelt** |
| 23 | Kontextmenü „in neuem Tab öffnen" | — | **bleibt Altwelt** |
| 24 | Kontaktlisten (`ContactListsContent`) | — | **bleibt Altwelt** (`/sales/lists`) |

## Folge für B7

Neun Funktionen (16–24) haben im Neubau **keinen Ersatz** und sind auch keine,
die man ersatzlos streichen kann, ohne Kevin zu fragen — Bulk-Aktionen und die
Schnell-Erfassung sind Tagesgeschäft, der Pipeline-Umschalter hängt an Daten.

**Damit ist die Paritäts-Bedingung aus B7 nicht erfüllt: es wird nichts
abgerissen.** Die Altwelt bleibt unter `/sales/klassisch` erreichbar und trägt
ein Banner, das sagt, was nur dort liegt. Der Abriss ist eine eigene Runde,
sobald entschieden ist, welche der neun Funktionen wirklich mitkommen.

## Die Datenwege (unangetastet, Gesetz 4)

`useContacts` (Laden/Anlegen/Ändern/Löschen) · `useOpportunities` ·
`useDeliverProjects` · `useContactLists` · `useSalesPipelines` ·
`useContactFieldSave` · `lib/salesPipelineFilters` · `lib/crmFilters` ·
`lib/pipelineContactSort` · `lib/crmViewStorage`. Der Neubau **liest und
schreibt ausschließlich über diese** — keine zweite Abfrage, keine zweite
Filter- oder Sortier-Wahrheit.
