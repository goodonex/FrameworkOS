import { IdentitaetAnsicht } from '../components/identitaet/IdentitaetAnsicht'
import { useIdentityCheckin } from '../lib/useIdentityCheckin'

/**
 * `/identitaet` — das Identity-OS im Cockpit (Backlog §4, gebaut am 16.08.2026).
 *
 * Der Container: er ruft den einen Hook und reicht ihn an die Ansicht durch.
 * Alles Sichtbare steht in `components/identitaet/IdentitaetAnsicht.tsx`.
 *
 * **Klick-Ökonomie:** Kachel antippen → Haken setzen. Die Morgenlese darüber
 * ist kurz genug, dass der Check-in im ersten Wisch steht; einen Sprung-Knopf
 * dorthin gibt es bewusst nicht — er wäre ein Weg-Klick, der genau die
 * Lese-Minute überspringt, um die es hier geht.
 *
 * **Kein Vollbild.** Die Seite lebt in der normalen Shell, am Handy wie am
 * Rechner. Vollbild ist im Cockpit dem Zähl-Modus und dem Morgen-Push
 * vorbehalten — beides Ein-Handgriff-Flächen, diese hier ist eine Lesefläche.
 */
export function IdentitaetArea() {
  const checkin = useIdentityCheckin()

  return (
    <IdentitaetAnsicht
      heute={checkin.heute}
      streakZeilen={checkin.streakZeilen}
      heuteIso={checkin.heuteIso}
      laedt={checkin.laedt}
      tabelleFehlt={checkin.tabelleFehlt}
      fehler={checkin.fehler}
      umschalten={checkin.umschalten}
      setzen={checkin.setzen}
    />
  )
}
