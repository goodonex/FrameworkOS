-- 0082 — Rechnungsadresse am Kontakt (02.09.2026)
--
-- Warum: Der Abschluss passiert im Call. Wenn der Makler zusagt, soll die
-- Rechnung mit GiroCode sofort rausgehen — dafuer braucht es eine
-- Rechnungsanschrift, und die hat ein LinkedIn-Lead nie. Die Felder gehoeren
-- deshalb dorthin, wo waehrend des Calls ohnehin getippt wird: an den Kontakt.
--
-- Bewusst getrennt von `name`/`email`: Der Ansprechpartner heisst oft anders
-- als der Rechnungsempfaenger (GmbH statt Person), und die Rechnungsmail geht
-- haeufig an die Buchhaltung.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS rechnung_firma text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rechnung_strasse text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rechnung_plz text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rechnung_ort text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rechnung_email text NOT NULL DEFAULT '';

COMMENT ON COLUMN contacts.rechnung_firma IS 'Rechnungsempfaenger, falls abweichend vom Kontaktnamen';
COMMENT ON COLUMN contacts.rechnung_email IS 'Adresse fuer den Rechnungsversand, oft die Buchhaltung';
