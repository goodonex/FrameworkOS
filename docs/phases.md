> ⚠️ **HISTORISCH (Mai 2026, „Brand OS").** Die Phasen 1–7 beschreiben die
> Vor-Rebuild-App mit sechs Denk-Modi; Foundation, Discovery und Intelligence sind
> seit Phase 6 (07.07.2026) gelöscht. Nichts hier ist ein offener Punkt.
> Aktueller Stand: [`BACKLOG.md`](BACKLOG.md) · [`rebuild-notes.md`](rebuild-notes.md).

# Brand OS — Bauphasen

## Phase 1 — Fundament & 3D Shell ✓ DONE
**Ziel:** App läuft, sieht richtig aus, 3D Node Graph funktioniert.

- Vite + React 19 + TypeScript strict
- Design Tokens, Fonts, Background + Orbs
- AppHeader, BrandSwitcher, ModeNav, Drawer
- 3D Node Graph (R3F + Bloom + Tunnel)
- Mock-Daten (useBrands), Supabase-Scaffold
- Routing: / → NodeGraph, /brand/:slug → BrandPage + Modi

---

## Phase 2 — Building Mode ✓ DONE

**Session 1 ✓**
- localStorage-Persistenz (lib/storage.ts)
- useICPs, useWordBank, usePositioning
- ICPSection + ICPEditor (Drawer)
- WordBankSection (Ja/Nein, Cluster)
- PositioningSection (Statement + Tone)
- Context Export (lib/contextExport.ts + Button)
- Toast-System

**Session 2 ✓**
- Business Model Editor (Wer/Was/Wie/Für wen/Womit)
- Assets (URL + Embed-Preview)
- SOP Editor (Tiptap)
- ModeNav: Discovery-Modus ergänzen

---

## Phase 3 — Discovery Mode ✓ DONE (Mock)

**Discovery Foundation**
- Markt / Wettbewerber / Nische + Mock-Analyse
- Übernahme nach Building (ICP, Word Bank, Positioning)

**Discovery Feed**
- Mock-Feed, Intervall-Einstellung, Refresh

_(Echter Agent / APIs — später)_

---

## Phase 4 — Promo Mode + Tracking ✓ DONE (App-seitig)

- [x] Content-Piece Editor (Tiptap + Auto-Tagging aus Foundation)
- [x] Kampagnen-Verwaltung
- [x] Kalender-View (kompakt)
- [x] Performance-Eingabe (manuell)
- [ ] Instagram Graph API _(OAuth/Backend offen — siehe docs/open-questions.md)_
- [ ] LinkedIn Analytics API _(OAuth/Backend offen)_
- [x] Performance-Daten / API-Mocks direkt am Content-Piece

---

## Phase 5 — Sales CRM ✓ DONE (App-seitig)

- [x] Kontakt-Verwaltung
- [x] Pipeline-View (Kanban-Spalten, Glass)
- [x] Follow-up Tracking (Datumsfelder)
- [x] Verknüpfung Content → Kontakt (Quelle) + Kampagne optional
- [x] Kontakt-Vollseite `/brand/:slug/sales/:contactId` (Aktivitäts-Log, Profilfelder)
- [x] Deal → Deliver-Projekt Shortcut

---

## Phase 5b — Deliver & Kundenportal (App, localStorage-first)

- [x] Deliver-Projekte mit Notion-ähnlichen Stages + `useDeliverProjects`
- [x] Projekt-Detailseite (Intern / Kundenbereich, Tiptap, Kanban)
- [x] Kundenportal-Placeholder `/portal/:projectId` (Owner-Session zum Testen)

---

## Phase 6 — Intelligence + Focus KI ✓ DONE (Mock)

- [x] Focus Tasks (aus localStorage-Daten berechnet, Dismiss-Persistenz)
- [x] Pattern Recognition (Mock-Kopie aus Promo/Sales-Daten)
- [x] ICP-Drift Erkennung (Mock)
- [x] Foundation-Anpassungsvorschläge (Mock)
- [x] Morning Brief (Mock)
- [ ] Discovery-Feed automatisiert (Cron via Supabase Edge Functions)

---

## Phase 7 — Desktop App
**Ziel:** Tauri-Wrapper.

- [ ] Tauri Setup
- [ ] Native Notifications
- [ ] Offline-Fähigkeit
- [ ] Auto-Update

---

## Später / Optional
- Collaboration (Kommentare, Zuweisung, Review-Status)
- Light Mode
- Mobile View
- Google Analytics, Meta Ads API
- KI-Assistent mit "/" Command im Editor
