-- 0073 — identity_checkins: die Morgenlese als vierte Einheit
--
-- Kevins Wunsch (17.08., nachts): eine Serie für „Morgenlese komplett
-- gelesen". Der Haken sitzt am Ende der Lese-Sektion — dort, wo das Lesen
-- endet — und schreibt in dieselbe Tageszeile wie die drei anderen Einheiten.
--
-- Die Serie zählt JEDEN Kalendertag (wie Clean, anders als der
-- Vertriebsblock): Visionmap-Regel 1 sagt „Jeden Morgen die Morgenlese",
-- nicht „jeden Werktag".
--
-- Additiv und idempotent — bestehende Zeilen bekommen false, was stimmt:
-- an diesen Tagen wurde nicht per Haken bestätigt.

alter table identity_checkins
  add column if not exists morgenlese boolean not null default false;
