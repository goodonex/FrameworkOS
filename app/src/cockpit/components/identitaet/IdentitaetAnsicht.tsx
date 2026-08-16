import {
  AFFORMATIONEN_LANG,
  ANTI_VISION,
  ANTI_VISION_GRUNDSATZ,
  BUSINESS_WIRKUNG,
  HERO_BILD,
  JEDEN_TAG,
  KAPITEL,
  MENSCHEN_ERLEBEN,
  MORGENLESE,
  NICHT_MEHR,
  PORTRAET_BILD,
  STUFEN,
  STUFEN_FUSS,
  VERHALTEN,
  VISIONMAP_QUELLE,
  VISIONSTEXT,
  WARUM,
} from '../../lib/identityInhalte'
import type { StreakTag } from '../../lib/identityStreak'
import { boardPfad } from '../../lib/visionboard'
import type { CheckinRow } from '../../lib/useIdentityCheckin'
import { IdentHero, KapitelBanner, Liste, Spalte } from './Bausteine'
import { CheckinKarte } from './CheckinKarte'
import { Aufklapper, RegelnUndLehren } from './Sektionen'
import { StreakBand } from './StreakBand'
import { Visionboard } from './Visionboard'

/**
 * Die Darstellung des Identity-OS — **ohne einen einzigen Datenpfad**.
 *
 * Getrennt vom Container (`pages/IdentitaetArea.tsx`) nach demselben Muster
 * wie der Homescreen: „Dieser Container ruft die Hooks, die Widgets bekommen
 * Props." Der zweite Grund ist die Abnahme — `/identitaet` liegt hinter dem
 * Supabase-Login und wäre sonst nur mit echter Sitzung anzusehen. So zeigt die
 * Dev-Vorschau dieselbe Ansicht, statt das Markup zu verdoppeln.
 *
 * **Aufbau nach Kevins Design-Vorlage** (`visionmap-2.0.html`, 16.08. 21:04 —
 * Fußzeile: „Diese Seite ist die Design-Vorlage für das Identity OS in
 * Uriel"): Bild-Hero, dann Kapitel mit Bannerbild, zweispaltige Listen,
 * Stufen-Kacheln, durchnummerierte Regeln. Übernommen sind Aufbau und
 * Bildsprache, nicht die Palette — Gold auf Schwarz und Monospace-Versalien
 * gehören der Vorlage, im Cockpit tragen `--ck-accent` und die
 * Serifen-Display-Schrift dieselbe Rolle (DESIGN-TOKENS bleiben eingefroren).
 *
 * **Die Reihenfolge ist die Botschaft** und folgt der „Sein → Tun → Haben"-
 * Ordnung der Map: Morgenlese (sein) → Check-in (tun) → Visionstext und Board
 * (haben) → Anti-Vision und Regeln (Nachschlagewerk). Der Visionstext steht
 * bewusst zwischen Check-in und Board: er ist die Brücke von „was tue ich
 * heute" zu „wer wird davon".
 */

export interface IdentitaetAnsichtProps {
  heute: CheckinRow
  streakZeilen: StreakTag[]
  heuteIso: string
  laedt: boolean
  tabelleFehlt: boolean
  fehler: string | null
  umschalten: (feld: 'vertriebsblock' | 'clean' | 'sport') => void
  setzen: (patch: Partial<Omit<CheckinRow, 'datum'>>) => void
}

function datumLang(d: Date): string {
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })
}

export function IdentitaetAnsicht({
  heute,
  streakZeilen,
  heuteIso,
  laedt,
  tabelleFehlt,
  fehler,
  umschalten,
  setzen,
}: IdentitaetAnsichtProps) {
  return (
    <div className="ck-ident">
      <IdentHero
        bild={HERO_BILD}
        label={`Morgenlese · 2 Minuten · ${datumLang(new Date(`${heuteIso}T12:00:00`))}`}
        titel={MORGENLESE.leitsatz}
        unterzeile={MORGENLESE.leitsatzFolge}
      />

      {/* --- Die Morgenlese ------------------------------------------------ */}
      <section className="ck-ident-abschnitt ck-ident-schmal" aria-label="Morgenlese">
        <div className="ck-ident-saetze">
          {MORGENLESE.saetze.map((s) => (
            <p key={s} className="ck-ident-gross">
              {s}
            </p>
          ))}
        </div>

        <div className="ck-ident-routine">
          <span className="ck-label">{MORGENLESE.routine.titel}</span>
          <p className="ck-ident-routine-kern">{MORGENLESE.routine.kern}</p>
          <p className="ck-ident-routine-zusatz">{MORGENLESE.routine.zusatz}</p>
        </div>

        <div className="ck-ident-pillen">
          {MORGENLESE.standards.map((s) => (
            <span key={s} className="ck-ident-pille">
              {s}
            </span>
          ))}
        </div>

        <p className="ck-ident-absatz">
          <b>Warum:</b> {MORGENLESE.warum}
        </p>

        <p className="ck-ident-afform">{MORGENLESE.afformationen.join(' · ')}</p>
      </section>

      {/* --- Serien + Check-in --------------------------------------------- */}
      <section className="ck-ident-abschnitt">
        <StreakBand zeilen={streakZeilen} heute={heuteIso} laedt={laedt} />

        {tabelleFehlt ? (
          <p className="ck-ident-hinweis">
            Der Check-in kann noch nicht speichern — die Tabelle fehlt in der Datenbank. Migration 0072
            (<code>identity_checkins</code>) muss noch per <code>supabase db push</code> eingespielt werden.
            Lesen funktioniert, Haken bleiben nur nicht erhalten.
          </p>
        ) : null}
        {fehler ? <p className="ck-ident-hinweis">{fehler}</p> : null}

        <CheckinKarte heute={heute} laedt={laedt} umschalten={umschalten} setzen={setzen} />
      </section>

      {/* --- Kapitel: Identität --------------------------------------------- */}
      <KapitelBanner kapitel={KAPITEL.identitaet} />
      <section className="ck-ident-abschnitt">
        {/* Der Visionstext steht zwischen Check-in und Board: die Brücke von
            „was tue ich heute" zu „wer wird davon". */}
        {/* Erst das Verhalten, dann der Visionstext — dieselbe Folge wie in
            der Vorlage. Sie hat auch den praktischen Grund: stünde der
            Visionstext direkt unter dem Kapitel-Banner, kämen zwei Statuen
            unmittelbar hintereinander. */}
        <div className="ck-ident-zwei">
          <Spalte titel="Die Soll-Version von mir" art="akzent">
            <ul className="ck-ident-liste">
              {VERHALTEN.map((v) => (
                <li key={v.auftakt}>
                  <b>{v.auftakt}:</b> {v.text}
                </li>
              ))}
            </ul>
          </Spalte>
          <Spalte titel="Nie mehr" art="abgrenzung">
            <Liste punkte={NICHT_MEHR} />
            <h4 className="ck-ident-spalte-titel ck-ident-spalte-titel--zweit">Jeden Tag</h4>
            <Liste punkte={JEDEN_TAG} />
          </Spalte>
        </div>

        <div className="ck-ident-bildtext">
          <img src={boardPfad(PORTRAET_BILD)} alt="" loading="lazy" decoding="async" />
          <div>
            <span className="ck-label">Visionstext</span>
            {/* Die ersten beiden Absätze stehen offen — sie tragen den Kern.
                Die übrigen sieben würden am Handy drei Bildschirme Textwand
                ergeben und liegen deshalb einen Tipp entfernt. Der Wortlaut
                ist vollständig da, nur nicht auf einmal. */}
            {VISIONSTEXT.slice(0, 2).map((absatz, i) => (
              <p key={absatz} className={i === 1 ? 'ck-ident-absatz ck-ident-absatz--stark' : 'ck-ident-absatz'}>
                {absatz}
              </p>
            ))}
            <Aufklapper titel="Den ganzen Visionstext lesen">
              {VISIONSTEXT.slice(2).map((absatz) => (
                <p key={absatz} className="ck-ident-absatz">
                  {absatz}
                </p>
              ))}
            </Aufklapper>
          </div>
        </div>
      </section>

      {/* --- Kapitel: Traumleben -------------------------------------------- */}
      <KapitelBanner kapitel={KAPITEL.traumleben} />
      <section className="ck-ident-abschnitt">
        <div className="ck-ident-stufen">
          {STUFEN.map((s) => (
            <div key={s.name} className="ck-ident-stufe">
              <span className="ck-serif ck-zahl ck-ident-stufe-zahl">{s.zahl}</span>
              <span className="ck-ident-stufe-name">{s.name}</span>
              <span className="ck-ident-stufe-text">{s.text}</span>
            </div>
          ))}
        </div>
        <p className="ck-ident-afform">{STUFEN_FUSS}</p>

        <Visionboard />

        <div className="ck-ident-zwei">
          <Spalte titel="Menschen & Erleben" art="akzent">
            <Liste punkte={MENSCHEN_ERLEBEN} />
          </Spalte>
          <Spalte titel="Business & Wirkung" art="akzent">
            <Liste punkte={BUSINESS_WIRKUNG} />
          </Spalte>
        </div>
      </section>

      {/* --- Kapitel: Anti-Vision ------------------------------------------- */}
      <KapitelBanner kapitel={KAPITEL.antivision} />
      <section className="ck-ident-abschnitt ck-ident-schmal">
        <p className="ck-ident-afform">„{ANTI_VISION_GRUNDSATZ}"</p>
        <ul className="ck-ident-anti">
          {ANTI_VISION.map((a) => (
            <li key={a.titel}>
              <b>{a.titel}.</b> {a.text}
            </li>
          ))}
        </ul>

        {/* Das Warum — in der Vorlage ein zentrierter Block mit Trennlinie. */}
        <div className="ck-ident-warum">
          <span className="ck-ident-warum-linie" aria-hidden />
          <p className="ck-ident-warum-kern">{WARUM.kern}</p>
          <p className="ck-ident-warum-schluss">{WARUM.schluss}</p>
        </div>
      </section>

      {/* --- Kapitel: Regeln & Lehren --------------------------------------- */}
      <KapitelBanner kapitel={KAPITEL.regeln} />
      <section className="ck-ident-abschnitt ck-ident-schmal">
        <RegelnUndLehren />
      </section>

      {/* --- Schluss --------------------------------------------------------- */}
      <section className="ck-ident-abschnitt ck-ident-schmal ck-ident-schluss">
        <p className="ck-ident-gross">{AFFORMATIONEN_LANG.stark.join(' · ')}</p>
        <p className="ck-ident-afform">{AFFORMATIONEN_LANG.weitere.join(' · ')}</p>
        <p className="ck-ident-afform">{AFFORMATIONEN_LANG.abends}</p>
        <p className="ck-ident-quelle">Quelle: {VISIONMAP_QUELLE}</p>
      </section>
    </div>
  )
}
