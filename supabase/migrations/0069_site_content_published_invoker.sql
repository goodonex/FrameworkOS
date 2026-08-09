-- 0069: `site_content_published` läuft als Aufrufer statt als Definer (L3 / D7).
--
-- 0052 hat die View bewusst mit `security_invoker = off` angelegt: öffentlicher
-- Lesezugriff auf die veröffentlichten Werte, ohne die Basistabelle (Drafts,
-- Labels, Sections) für `anon` zu öffnen. Der Preis dafür ist, dass die View
-- NICHT nach Projekt gezogen ist — wer den anon-Key aus dem ausgelieferten
-- Bundle hat, liest die veröffentlichten Werte ALLER Projekte, inklusive der
-- Projekt-UUIDs.
--
-- D7: Die Lücke wird geschlossen, nicht umgebaut. Mit `security_invoker = on`
-- gelten wieder die Policies von `site_content` — und die kennen `anon` nicht,
-- also liefert die View für Website-Besucher nichts mehr.
--
-- Das ist heute folgenlos und wurde vor dem Push geprüft:
--   * `site_content` hat 0 Zeilen,
--   * keine Kundenseite liest die View (nur `lib/siteContentService.ts`, und
--     das läuft eingeloggt).
-- Ob das CMS je belebt wird — dann mit einer Security-Definer-FUNKTION mit
-- `project_id`-Parameter statt einer offenen View — ist Kevins Entscheidung und
-- keine Voraussetzung dafür, die Lücke jetzt zuzumachen.
--
-- Additiv: nur ein View-Attribut, kein drop, kein Datenverlust.

alter view public.site_content_published set (security_invoker = on);

comment on view public.site_content_published is
  'Veröffentlichte site_content-Werte. Seit 0069 security_invoker=on: es gelten die Policies der Basistabelle, anon liest hier nichts mehr (L3/D7). Öffentlicher Zugriff braucht eine scoped Security-Definer-Funktion, keine offene View.';
