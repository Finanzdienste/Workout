/*
 * Was Sport außerhalb des Plans mit welchem Muskel macht.
 *
 *     „Beschäftige dich echt tiefgehend mit allen sportlichen
 *      Freizeitaktivitäten und schau was genau was macht und so. Ich will nur
 *      sagen was ich an welchem tag gemacht hab. Der Rest soll automatisch
 *      passieren"
 *
 * Vorher gab es drei grobe Körbe – Beine, Oberkörper, alles – und man musste
 * selbst entscheiden, in welchen Padel gehört. Das war eine Frage an den
 * Nutzer, die die App beantworten kann. Hier steht die Antwort.
 *
 * ------------------------------------------------------------------
 * DIE ZWEI ZAHLEN, UM DIE ES GEHT
 * ------------------------------------------------------------------
 *
 * **`last`** – wie stark eine Gruppe arbeitet, als Anteil an einer harten
 * gezielten Trainingseinheit für genau diese Gruppe. 1,0 hieße: Diese Stunde
 * hat den Quadrizeps so belastet wie ein schwerer Kniebeugen-Tag. Das ist selten;
 * die meisten Werte liegen zwischen 0,3 und 0,8. Gerechnet wird pro Stunde,
 * die tatsächliche Dauer skaliert (siehe `dauerFaktor`).
 *
 * **`exzentrik`** – wie viel von dieser Last *bremsende* Arbeit ist, also
 * Muskel unter Spannung verlängert. Das ist der Unterschied, der in dieser
 * Datei am meisten entscheidet, und er ist gut belegt: Muskelschädigung und
 * Muskelkater entstehen an exzentrischen Kontraktionen, nicht an der
 * Stoffwechsel-Anstrengung. Zwei Stunden Rennrad sind erschöpfend und richten
 * fast keinen Schaden an – getreten wird fast nur konzentrisch. Eine Stunde
 * bergab laufen ist der Laborstandard für Muskelschädigung.
 *
 * Aus beidem folgt:
 *
 *     wirkung = last × dauerFaktor(minuten)      – wie sehr die Gruppe gefordert war
 *     schaden = wirkung × exzentrik              – wie lange sie das nachträgt
 *
 * `wirkung` entscheidet, ob **vor** der Aktivität geschont wird: Wer morgen
 * Padel spielt, soll heute keine schweren Beine haben. `schaden` entscheidet,
 * ob **danach** geschont wird, und wie lange.
 *
 * ------------------------------------------------------------------
 * WIE ZUVERLÄSSIG DAS IST, UND DAS GEHÖRT HIERHIN
 * ------------------------------------------------------------------
 *
 * Belegt ist das Gerüst, nicht die zweite Nachkommastelle:
 *
 *   – Muskelkater beginnt nach ungefähr einem Tag, hat sein Maximum nach 24
 *     bis 72 Stunden und klingt danach ab. Deshalb ein Tag Schonung im
 *     Normalfall, zwei bei den wirklich schädigenden Sachen.
 *   – Exzentrische Belastung schädigt, konzentrische kaum. Deshalb `exzentrik`.
 *   – Bei Tennis (und damit Padel) sind an der unteren Extremität vor allem
 *     Kniestrecker und Wadenmuskulatur gefordert – Vastus lateralis, Rectus
 *     femoris, Gastrocnemius, Soleus. Deshalb dort die höchsten Werte.
 *   – Beim Sprinten ist der Beinbeuger die verletzungsanfälligste Gruppe, und
 *     zwar in der Schwungphase, also bremsend. Deshalb steht er bei Fußball
 *     und Sprintspielen oben.
 *
 * Die einzelnen Zahlen sind daraus abgeleitete Schätzungen und keine Messung
 * an Tobi. Sie sind *begründet* – jede Zeile hat ein `warum`, das die App auch
 * anzeigt –, aber wer merkt, dass eine Gruppe nach einer Aktivität regelmäßig
 * frischer ist als hier angenommen, soll den Eintrag löschen. Er ist eine
 * Eintragung und keine Vorschrift.
 *
 * **Was hier fehlt und nicht ergänzt werden kann:** Unterarme und Griffkraft.
 * Nach zwei Stunden Bouldern ist der Unterarm das, was am nächsten Tag
 * limitiert – aber der Plan führt keine Unterarmgruppe, weil er keine
 * Unterarmübung hat. Die Klimmzüge trifft es trotzdem; dort steht es im
 * `warum`, damit es wenigstens dasteht.
 *
 * **Und was hier bewusst nicht passiert:** Nichts wird umverteilt oder
 * ersetzt. Die betroffenen Übungen fallen aus, die Woche verfehlt ihr Ziel für
 * diese Gruppen, und das zeigt die App an. Siehe js/termine.js.
 */

/**
 * Dauer skaliert die Last – aber nicht linear.
 *
 * Zwei Stunden sind nicht doppelt so schädigend wie eine: Der größte Teil der
 * Schädigung entsteht früh, danach ist die Muskulatur für diese Einheit schon
 * angeschlagen und produziert weniger Neues (der „repeated bout"-Effekt gilt
 * sogar über Wochen hinweg). Die Wurzel bildet das ordentlich ab, und bei 2:45
 * ist Schluss – ein Skitag von sechs Stunden ist nicht dreimal so schlimm wie
 * einer von zwei.
 *
 *   30 min → 0,71   60 min → 1,00   90 min → 1,22   120 min → 1,41 (Deckel)
 */
export function dauerFaktor(minuten) {
  const m = Number(minuten);
  if (!Number.isFinite(m) || m <= 0) return 1;
  return Math.min(1.41, Math.sqrt(m / 60));
}

/** Ab hier gilt eine Gruppe als gefordert und wird geschont. */
export const SCHWELLE = 0.45;

/** Ab hier reicht ein Tag nicht – dann sind es zwei. */
export const SCHWELLE_LANG = 0.85;

/*
 * Der Katalog. Sortiert nach Familie, innerhalb der Familie nach Verbreitung.
 *
 *   id         stabil, wird gespeichert – nie ändern
 *   name       wie es in der Liste steht
 *   familie    nur für die Gruppierung in der Auswahl
 *   typisch    Voreinstellung der Dauer in Minuten, damit ein Tipp reicht
 *   exzentrik  0 = rein konzentrisch, 1 = bergab laufen
 *   last       Gruppe → Anteil an einer harten Einheit für diese Gruppe
 *   warum      ein Satz, der die Zahlen erklärt. Steht in der App.
 */
export const AKTIVITAETEN = [
  /* --- Rückschlagspiele ------------------------------------------------ */
  {
    id: 'padel', name: 'Padel', familie: 'Rückschlag', typisch: 90, exzentrik: 0.8,
    last: { quads: 0.55, calves: 0.55, hamstringsKnee: 0.45, glutes: 0.4,
            hamstringsHip: 0.3, abs: 0.35, rearDelts: 0.3, sideDelts: 0.25,
            frontDelts: 0.2, triceps: 0.2, lats: 0.2 },
    warum: 'Kurze Antritte, ständiges Abbremsen und tiefe Position an der Wand. '
      + 'Die Hauptarbeit machen Kniestrecker und Waden, das Abstoppen trifft '
      + 'zusätzlich den Beinbeuger am Knie. Der Schlag ist vergleichsweise kurz '
      + 'übersetzt – die Schulter kommt vor, aber nicht wie beim Tennisaufschlag.',
  },
  {
    id: 'tennis', name: 'Tennis', familie: 'Rückschlag', typisch: 90, exzentrik: 0.85,
    last: { quads: 0.6, calves: 0.6, hamstringsKnee: 0.5, glutes: 0.45,
            hamstringsHip: 0.35, abs: 0.4, frontDelts: 0.3, rearDelts: 0.3,
            sideDelts: 0.3, triceps: 0.3, lats: 0.3 },
    warum: 'Wie Padel, aber größeres Feld und längere Wege, also mehr Sprint und '
      + 'härteres Abbremsen. Der Aufschlag holt Schulter und Trizeps deutlicher '
      + 'dazu; EMG-Messungen am Aufschlag zeigen Kniestrecker und Wadenmuskulatur '
      + 'als die stärkst beanspruchten Muskeln der unteren Extremität.',
  },
  {
    id: 'squash', name: 'Squash', familie: 'Rückschlag', typisch: 60, exzentrik: 0.85,
    last: { quads: 0.7, calves: 0.6, hamstringsKnee: 0.5, glutes: 0.45,
            hamstringsHip: 0.35, abs: 0.35, rearDelts: 0.25, frontDelts: 0.2 },
    warum: 'Der härteste Fall unter den Rückschlagspielen: Auf kleiner Fläche fast '
      + 'nur Ausfallschritte und Richtungswechsel, dazwischen kaum Pause. Der '
      + 'Ausfallschritt ins Vorderfeld ist exzentrische Arbeit für den Quadrizeps.',
  },
  {
    id: 'badminton', name: 'Badminton', familie: 'Rückschlag', typisch: 75, exzentrik: 0.8,
    last: { calves: 0.65, quads: 0.55, hamstringsKnee: 0.45, glutes: 0.4, abs: 0.35,
            sideDelts: 0.3, rearDelts: 0.3, frontDelts: 0.25, triceps: 0.25 },
    warum: 'Viel Absprung und Landung, dazu Overhead-Schläge. Die Waden stehen hier '
      + 'vor dem Quadrizeps – gesprungen und gelandet wird aus dem Sprunggelenk.',
  },
  {
    id: 'pickleball', name: 'Pickleball', familie: 'Rückschlag', typisch: 60, exzentrik: 0.6,
    last: { quads: 0.4, calves: 0.4, hamstringsKnee: 0.3, glutes: 0.3, abs: 0.25 },
    warum: 'Kleineres Feld, langsamerer Ball, kaum Sprint. Fordert die Beine spürbar, '
      + 'aber selten so, dass am nächsten Tag etwas fehlt.',
  },
  {
    id: 'tischtennis', name: 'Tischtennis', familie: 'Rückschlag', typisch: 60, exzentrik: 0.4,
    last: { calves: 0.3, quads: 0.25, abs: 0.25, rearDelts: 0.2, frontDelts: 0.15 },
    warum: 'Schnelle Füße, aber kurze Wege und kaum Abbremslast. Ändert am '
      + 'Trainingsplan in aller Regel nichts – und das ist die richtige Antwort.',
  },

  /* --- Mannschaftssport ------------------------------------------------ */
  {
    id: 'fussball', name: 'Fußball', familie: 'Mannschaft', typisch: 90, exzentrik: 0.95,
    last: { hamstringsKnee: 0.75, quads: 0.7, hamstringsHip: 0.6, glutes: 0.6,
            calves: 0.6, abs: 0.35 },
    warum: 'Der Beinbeuger steht bewusst an erster Stelle: Beim Sprinten arbeitet er '
      + 'in der Schwungphase bremsend, und genau dort passieren die meisten '
      + 'Muskelverletzungen. Nach 90 Minuten Sprint, Abstoppen und Zweikampf ist '
      + 'er der Grund, warum am nächsten Tag kein Kreuzheben ansteht.',
  },
  {
    id: 'basketball', name: 'Basketball', familie: 'Mannschaft', typisch: 75, exzentrik: 0.9,
    last: { quads: 0.7, calves: 0.7, glutes: 0.6, hamstringsKnee: 0.55,
            hamstringsHip: 0.45, abs: 0.35, frontDelts: 0.2 },
    warum: 'Sprung und Landung in Serie, dazu Stopps und Richtungswechsel. Die '
      + 'Landung ist reine Bremsarbeit für Quadrizeps und Waden.',
  },
  {
    id: 'volleyball', name: 'Volleyball (Halle)', familie: 'Mannschaft', typisch: 90, exzentrik: 0.9,
    last: { calves: 0.7, quads: 0.65, glutes: 0.55, hamstringsKnee: 0.5, abs: 0.4,
            frontDelts: 0.4, sideDelts: 0.35, triceps: 0.3, lats: 0.25 },
    warum: 'Sprünge auf hartem Boden und Angriffsschläge über Kopf. Die Landung geht '
      + 'in Waden und Quadrizeps, der Schlag in die vordere Schulter.',
  },
  {
    id: 'beachvolleyball', name: 'Beachvolleyball', familie: 'Mannschaft', typisch: 90, exzentrik: 0.6,
    last: { calves: 0.75, quads: 0.7, glutes: 0.6, hamstringsKnee: 0.5, abs: 0.4,
            frontDelts: 0.4, sideDelts: 0.3, triceps: 0.3 },
    warum: 'Sand kehrt die Rechnung um: mehr Arbeit als in der Halle, weil jeder '
      + 'Schritt wegrutscht, aber deutlich weniger Bremslast, weil er die Landung '
      + 'schluckt. Erschöpfend, aber wenig schädigend.',
  },
  {
    id: 'handball', name: 'Handball', familie: 'Mannschaft', typisch: 75, exzentrik: 0.95,
    last: { quads: 0.65, hamstringsKnee: 0.65, calves: 0.6, glutes: 0.55,
            frontDelts: 0.45, abs: 0.45, lats: 0.3, triceps: 0.3 },
    warum: 'Sprint, Sprungwurf und Körperkontakt. Der Wurf über Kopf belastet die '
      + 'vordere Schulter stärker als bei jedem anderen Ballsport hier.',
  },
  {
    id: 'hockey', name: 'Hockey', familie: 'Mannschaft', typisch: 75, exzentrik: 0.85,
    last: { quads: 0.65, hamstringsHip: 0.55, glutes: 0.5, hamstringsKnee: 0.5,
            calves: 0.5, abs: 0.4, lats: 0.35, traps: 0.25 },
    warum: 'Gespielt wird in tiefer, vorgebeugter Haltung – das hält Hüftstrecker und '
      + 'Beinbeuger an der Hüfte über die ganze Zeit unter Spannung, zusätzlich zum '
      + 'Sprint.',
  },

  /* --- Laufen und Gehen ------------------------------------------------ */
  {
    id: 'laufen', name: 'Laufen (flach)', familie: 'Laufen', typisch: 45, exzentrik: 0.6,
    last: { calves: 0.6, quads: 0.45, hamstringsKnee: 0.4, hamstringsHip: 0.4, glutes: 0.4 },
    warum: 'Im flachen Dauerlauf hält sich die Bremsarbeit in Grenzen – der Fuß setzt '
      + 'auf und federt, aber der Schwerpunkt fällt nicht. Die Waden tragen die '
      + 'Hauptlast.',
  },
  {
    id: 'intervalle', name: 'Intervalle / Sprints', familie: 'Laufen', typisch: 45, exzentrik: 1,
    last: { hamstringsKnee: 0.8, hamstringsHip: 0.7, quads: 0.65, glutes: 0.65, calves: 0.6 },
    warum: 'Sprinten ist für den Beinbeuger die härteste Belastung, die es ohne Gewicht '
      + 'gibt: In der Schwungphase bremst er das Unterschenkel-Schwingen bei hoher '
      + 'Geschwindigkeit ab. Danach schweres Beintraining ist eine schlechte Idee.',
  },
  {
    id: 'trail', name: 'Trailrunning / bergab', familie: 'Laufen', typisch: 75, exzentrik: 1,
    last: { quads: 0.85, calves: 0.7, glutes: 0.5, hamstringsKnee: 0.45 },
    warum: 'Bergablaufen ist der Laborstandard für Muskelschädigung – der Quadrizeps '
      + 'fängt bei jedem Schritt das Körpergewicht im Fallen ab. Die Schädigung ist '
      + 'nach zwei Tagen am deutlichsten, nicht am Abend danach.',
  },
  {
    id: 'wandern', name: 'Wandern (flach)', familie: 'Laufen', typisch: 180, exzentrik: 0.5,
    last: { calves: 0.5, quads: 0.4, glutes: 0.35, hamstringsHip: 0.3 },
    warum: 'Lang, aber leicht. Über viele Stunden summiert sich das trotzdem zu einer '
      + 'ordentlichen Wadenbelastung.',
  },
  {
    id: 'bergwandern', name: 'Bergwandern', familie: 'Laufen', typisch: 240, exzentrik: 0.95,
    last: { quads: 0.8, calves: 0.7, glutes: 0.6, hamstringsKnee: 0.4 },
    warum: 'Nicht der Aufstieg ist das Problem, sondern der Abstieg: Stunden bremsender '
      + 'Quadrizeps-Arbeit, oft mit Rucksack. Der Muskelkater danach hält zwei Tage '
      + 'und ist der Grund, warum der Plan hier am längsten aussetzt.',
  },
  {
    id: 'spazieren', name: 'Spazieren', familie: 'Laufen', typisch: 60, exzentrik: 0.2,
    last: { calves: 0.2, quads: 0.15 },
    warum: 'Ändert am Trainingsplan nichts, und soll es auch nicht.',
  },

  /* --- Rad -------------------------------------------------------------- */
  {
    id: 'rennrad', name: 'Rennrad', familie: 'Rad', typisch: 120, exzentrik: 0.15,
    last: { quads: 0.65, glutes: 0.45, calves: 0.4, hamstringsHip: 0.35 },
    warum: 'Der klarste Fall des Unterschieds, um den es hier geht: Radfahren ist fast '
      + 'reine konzentrische Arbeit – getreten, nie gebremst. Die Beine sind danach '
      + 'müde, aber kaum geschädigt. Vor einer langen Ausfahrt lohnt es, sie zu '
      + 'schonen; danach steht dem Training wenig im Weg.',
  },
  {
    id: 'mtb', name: 'Mountainbike', familie: 'Rad', typisch: 120, exzentrik: 0.35,
    last: { quads: 0.7, glutes: 0.5, calves: 0.4, hamstringsHip: 0.35, abs: 0.35,
            lats: 0.3, traps: 0.3, biceps: 0.25 },
    warum: 'Wie Rennrad, plus Haltearbeit: Im Gelände steht man, fängt Stöße ab und '
      + 'hält das Rad – das holt Rumpf, Rücken und Arme dazu und macht die Sache '
      + 'etwas schädigender als die Straße.',
  },
  {
    id: 'spinning', name: 'Spinning / Indoor', familie: 'Rad', typisch: 60, exzentrik: 0.15,
    last: { quads: 0.7, glutes: 0.45, calves: 0.35, hamstringsHip: 0.3 },
    warum: 'Hohe Trittlast ohne Rollpausen, aber ebenfalls kaum Bremsarbeit. Müde '
      + 'Beine, wenig Muskelkater.',
  },
  {
    id: 'alltagsrad', name: 'Alltagsrad', familie: 'Rad', typisch: 30, exzentrik: 0.1,
    last: { quads: 0.3, glutes: 0.2, calves: 0.2 },
    warum: 'Zur Arbeit und zurück. Ändert am Plan nichts.',
  },

  /* --- Wasser ----------------------------------------------------------- */
  {
    id: 'schwimmen', name: 'Schwimmen', familie: 'Wasser', typisch: 45, exzentrik: 0.25,
    last: { lats: 0.65, frontDelts: 0.5, rearDelts: 0.4, triceps: 0.4, chest: 0.35,
            abs: 0.35, traps: 0.3, calves: 0.2 },
    warum: 'Der Zug im Wasser ist Rücken und Schulter, und er ist fast durchgehend '
      + 'konzentrisch – Wasser hat keinen Aufprall. Deshalb hohe Last, aber wenig '
      + 'Nachwirkung. Die Schulter ist die Gruppe, die es am ehesten merkt.',
  },
  {
    id: 'kajak', name: 'Kajak / Kanu', familie: 'Wasser', typisch: 90, exzentrik: 0.4,
    last: { lats: 0.6, abs: 0.5, biceps: 0.45, rearDelts: 0.45, traps: 0.4, frontDelts: 0.3 },
    warum: 'Zug aus dem Rücken, Rotation aus dem Rumpf. Die Beine kommen kaum vor – '
      + 'nach einem Paddeltag ist ein Beintag völlig in Ordnung.',
  },
  {
    id: 'sup', name: 'SUP / Stand-up-Paddling', familie: 'Wasser', typisch: 75, exzentrik: 0.3,
    last: { abs: 0.55, lats: 0.45, rearDelts: 0.35, traps: 0.3, quads: 0.25, calves: 0.25 },
    warum: 'Die eigentliche Arbeit ist das Balancehalten – Rumpf über die ganze Zeit, '
      + 'Zug aus dem Rücken. Wenig schädigend.',
  },
  {
    id: 'rudern', name: 'Rudern (Boot / Ergo)', familie: 'Wasser', typisch: 45, exzentrik: 0.5,
    last: { lats: 0.65, quads: 0.6, hamstringsHip: 0.55, glutes: 0.5, traps: 0.45,
            abs: 0.4, biceps: 0.4, rearDelts: 0.4 },
    warum: 'Der Ganzkörperfall: Beinstoß, Hüftstreckung, Zug. Von allen Ausdauersachen '
      + 'die, die dem Krafttraining am nächsten kommt – und die am ehesten mit dem '
      + 'Plan kollidiert.',
  },
  {
    id: 'surfen', name: 'Surfen', familie: 'Wasser', typisch: 120, exzentrik: 0.5,
    last: { lats: 0.6, frontDelts: 0.5, abs: 0.5, quads: 0.45, triceps: 0.35, chest: 0.3 },
    warum: 'Die meiste Zeit wird gepaddelt, nicht gesurft – deshalb steht der Rücken '
      + 'oben. Der Aufstand und das Halten in der Welle holen Beine und Rumpf dazu.',
  },
  {
    id: 'wakeboard', name: 'Wakeboard / Wasserski', familie: 'Wasser', typisch: 45, exzentrik: 0.7,
    last: { quads: 0.65, lats: 0.55, abs: 0.5, biceps: 0.5, hamstringsHip: 0.4, traps: 0.35 },
    warum: 'Gegen den Zug der Leine zu halten ist Haltearbeit für Rücken und Arme, die '
      + 'Beine federn jede Welle ab. Kurz, aber intensiv.',
  },

  /* --- Winter ----------------------------------------------------------- */
  {
    id: 'ski', name: 'Skifahren (alpin)', familie: 'Winter', typisch: 240, exzentrik: 0.95,
    last: { quads: 0.85, glutes: 0.55, abs: 0.45, calves: 0.4, hamstringsKnee: 0.4 },
    warum: 'Ein Skitag ist stundenlange bremsende Haltearbeit des Quadrizeps – der '
      + 'Muskel hält gegen, während das Knie gebeugt wird, und das fast ohne Pause. '
      + 'Kaum eine Freizeitaktivität schädigt den Oberschenkel so zuverlässig; zwei '
      + 'Tage Schonung sind hier keine Vorsicht, sondern die Regel.',
  },
  {
    id: 'snowboard', name: 'Snowboard', familie: 'Winter', typisch: 240, exzentrik: 0.9,
    last: { quads: 0.75, glutes: 0.55, abs: 0.5, calves: 0.45, hamstringsKnee: 0.4 },
    warum: 'Wie Ski, etwas gleichmäßiger verteilt und mit mehr Rumpfarbeit – das Brett '
      + 'wird aus der Hüfte gesteuert. Dazu das Aufstehen, immer wieder.',
  },
  {
    id: 'skitour', name: 'Skitour', familie: 'Winter', typisch: 240, exzentrik: 0.8,
    last: { quads: 0.8, glutes: 0.6, calves: 0.55, hamstringsHip: 0.45, abs: 0.35 },
    warum: 'Der Aufstieg ist lange konzentrische Arbeit, die Abfahrt die bremsende. '
      + 'Beides zusammen ist der längste Beintag, den man ohne Hantel haben kann.',
  },
  {
    id: 'langlauf', name: 'Langlauf', familie: 'Winter', typisch: 90, exzentrik: 0.35,
    last: { quads: 0.6, glutes: 0.5, lats: 0.5, triceps: 0.45, abs: 0.45,
            hamstringsHip: 0.4, rearDelts: 0.3 },
    warum: 'Der eine Wintersport ohne Bremsarbeit: geschoben und gestockt, nicht '
      + 'abgefangen. Fordert Beine und Oberkörper gleichermaßen, wirkt aber kaum nach.',
  },
  {
    id: 'eislaufen', name: 'Schlittschuh / Eishockey', familie: 'Winter', typisch: 75, exzentrik: 0.8,
    last: { quads: 0.75, glutes: 0.65, hamstringsHip: 0.5, hamstringsKnee: 0.45,
            calves: 0.4, abs: 0.35 },
    warum: 'Die tiefe Position und der seitliche Abstoß gehen fast vollständig in '
      + 'Quadrizeps und Gesäß. Bremsen und Richtungswechsel machen daraus exzentrische '
      + 'Arbeit.',
  },

  /* --- Klettern --------------------------------------------------------- */
  {
    id: 'bouldern', name: 'Bouldern', familie: 'Klettern', typisch: 90, exzentrik: 0.8,
    last: { lats: 0.65, biceps: 0.6, abs: 0.55, rearDelts: 0.45, traps: 0.4,
            frontDelts: 0.35, quads: 0.35, calves: 0.3 },
    warum: 'Zug aus Rücken und Bizeps, Körperspannung aus dem Rumpf, oft in gehaltenen '
      + 'und damit exzentrischen Positionen. Was hier nicht steht, aber nach einem '
      + 'Boulderabend das eigentliche Limit ist: die Unterarme. Der Plan führt keine '
      + 'Unterarmgruppe – dass Klimmzüge am nächsten Tag schlechter gehen, liegt '
      + 'trotzdem meistens am Griff.',
  },
  {
    id: 'klettern', name: 'Klettern (Seil)', familie: 'Klettern', typisch: 120, exzentrik: 0.7,
    last: { lats: 0.65, biceps: 0.55, abs: 0.5, rearDelts: 0.4, traps: 0.4,
            quads: 0.35, calves: 0.35, frontDelts: 0.3 },
    warum: 'Wie Bouldern, aber länger und weniger maximal – mehr Ausdauer im Zug, mehr '
      + 'Standzeit auf den Füßen. Auch hier: der Unterarm merkt es am längsten.',
  },
  {
    id: 'klettersteig', name: 'Klettersteig', familie: 'Klettern', typisch: 240, exzentrik: 0.7,
    last: { quads: 0.7, calves: 0.55, lats: 0.5, biceps: 0.45, glutes: 0.45,
            abs: 0.4, traps: 0.35 },
    warum: 'Mehr Bergtour als Klettern: Die Beine tragen, die Arme sichern und ziehen '
      + 'nach. Der Abstieg kommt fast immer dazu.',
  },

  /* --- Kampfsport ------------------------------------------------------- */
  {
    id: 'boxen', name: 'Boxen / Kickboxen', familie: 'Kampfsport', typisch: 60, exzentrik: 0.8,
    last: { abs: 0.6, frontDelts: 0.55, sideDelts: 0.5, calves: 0.5, quads: 0.45,
            rearDelts: 0.4, triceps: 0.4, chest: 0.35, traps: 0.35 },
    warum: 'Die Schulter hält die Deckung über Runden hinweg oben – das ist die Gruppe, '
      + 'die als erste aufgibt. Dazu Rumpfrotation bei jedem Schlag und ständige '
      + 'Beinarbeit auf dem Ballen.',
  },
  {
    id: 'grappling', name: 'BJJ / Ringen / Judo', familie: 'Kampfsport', typisch: 90, exzentrik: 0.85,
    last: { abs: 0.65, lats: 0.6, biceps: 0.55, traps: 0.5, hamstringsHip: 0.5,
            glutes: 0.5, quads: 0.5, rearDelts: 0.45, hamstringsKnee: 0.4, chest: 0.4 },
    warum: 'Alles zieht und hält gegen einen Widerstand, der zurückdrückt – fast jede '
      + 'Position ist gehaltene, also exzentrische Arbeit. Der Sport mit der '
      + 'breitesten Belastung im ganzen Katalog; nach einer harten Einheit steht fast '
      + 'überall etwas an.',
  },
  {
    id: 'karate', name: 'Karate / Taekwondo', familie: 'Kampfsport', typisch: 75, exzentrik: 0.7,
    last: { abs: 0.55, quads: 0.55, hamstringsHip: 0.45, calves: 0.45, glutes: 0.4,
            frontDelts: 0.35, sideDelts: 0.3 },
    warum: 'Tritte über Hüfthöhe holen Hüftbeuger, Rumpf und Standbein zugleich. Die '
      + 'Stände fordern den Quadrizeps statisch.',
  },

  /* --- Kurse und Studio ------------------------------------------------- */
  {
    id: 'crossfit', name: 'CrossFit / Functional', familie: 'Kurs', typisch: 60, exzentrik: 0.9,
    last: { quads: 0.7, glutes: 0.65, lats: 0.6, abs: 0.6, hamstringsHip: 0.55,
            frontDelts: 0.5, traps: 0.45, hamstringsKnee: 0.45, triceps: 0.45,
            calves: 0.4, chest: 0.4, biceps: 0.35 },
    warum: 'Das ist kein Ausgleich zum Plan, sondern ein zweiter Trainingstag – '
      + 'dieselben Gruppen, dieselbe Art Last. Danach ist eine Planeinheit am selben '
      + 'oder nächsten Tag doppelt gerechnet.',
  },
  {
    id: 'hiit', name: 'HIIT-Kurs', familie: 'Kurs', typisch: 45, exzentrik: 0.8,
    last: { quads: 0.65, glutes: 0.55, abs: 0.55, calves: 0.55, hamstringsKnee: 0.45,
            chest: 0.35, frontDelts: 0.35, triceps: 0.35 },
    warum: 'Sprünge, Burpees, Ausfallschritte – viel Landung und damit viel Bremslast '
      + 'auf den Beinen, dazu Körpergewichtsdrücken für die Brust.',
  },
  {
    id: 'crosstrainer', name: 'Crosstrainer', familie: 'Kurs', typisch: 45, exzentrik: 0.2,
    last: { quads: 0.45, glutes: 0.4, calves: 0.3, lats: 0.25, frontDelts: 0.2 },
    warum: 'Geführte Bewegung ohne Aufprall. Fordert die Beine, hinterlässt fast nichts.',
  },
  {
    id: 'tanzen', name: 'Tanzen', familie: 'Kurs', typisch: 90, exzentrik: 0.5,
    last: { calves: 0.55, quads: 0.5, glutes: 0.45, abs: 0.4, hamstringsKnee: 0.35 },
    warum: 'Viel auf dem Ballen, viele kleine Sprünge und Drehungen. Wie stark, hängt '
      + 'stark vom Stil ab – die Werte hier sind ein Mittelwert.',
  },
  {
    id: 'yoga', name: 'Yoga', familie: 'Kurs', typisch: 60, exzentrik: 0.3,
    last: { abs: 0.45, frontDelts: 0.35, quads: 0.35, glutes: 0.3, triceps: 0.3,
            hamstringsHip: 0.3, chest: 0.25 },
    warum: 'Gehaltene Positionen statt Wiederholungen. Fordert Rumpf und Schulter '
      + 'spürbar, schädigt aber kaum – und die Dehnung ist eher Erholung als Last.',
  },
  {
    id: 'pilates', name: 'Pilates', familie: 'Kurs', typisch: 60, exzentrik: 0.35,
    last: { abs: 0.6, glutes: 0.45, quads: 0.35, hamstringsHip: 0.35, rearDelts: 0.25 },
    warum: 'Fast alles läuft über den Rumpf, und zwar kontrolliert und langsam. Der '
      + 'Bauch ist die einzige Gruppe, die regelmäßig über die Schwelle kommt.',
  },
  {
    id: 'dehnen', name: 'Stretching / Mobility', familie: 'Kurs', typisch: 30, exzentrik: 0.1,
    last: { abs: 0.15 },
    warum: 'Dehnen ist keine Belastung, sondern eher das Gegenteil – es steht hier, '
      + 'damit man es eintragen kann, ohne dass etwas passiert. Am Plan ändert es nichts.',
  },

  /* --- Sonstiges -------------------------------------------------------- */
  {
    id: 'umzug', name: 'Umzug / Tragen', familie: 'Sonstiges', typisch: 180, exzentrik: 0.7,
    last: { hamstringsHip: 0.6, lats: 0.55, traps: 0.55, glutes: 0.5, quads: 0.5,
            abs: 0.5, biceps: 0.45, frontDelts: 0.4, rearDelts: 0.35 },
    warum: 'Stundenlanges Heben aus der Hüfte und Tragen vor dem Körper. Das ist '
      + 'Kreuzheben mit schlechter Technik und ohne Pause – die Hüftstrecker und der '
      + 'Nacken merken es am deutlichsten.',
  },
  {
    id: 'garten', name: 'Gartenarbeit', familie: 'Sonstiges', typisch: 120, exzentrik: 0.45,
    last: { hamstringsHip: 0.5, lats: 0.4, glutes: 0.4, quads: 0.35, traps: 0.35,
            abs: 0.35, biceps: 0.3 },
    warum: 'Graben, Bücken, Schleppen. Nicht intensiv, aber lang und fast immer '
      + 'vorgebeugt – das geht in den unteren Rücken und die Hüftstrecker.',
  },
  {
    id: 'golf', name: 'Golf', familie: 'Sonstiges', typisch: 240, exzentrik: 0.35,
    last: { abs: 0.4, quads: 0.3, calves: 0.3, lats: 0.3, rearDelts: 0.3, traps: 0.25 },
    warum: 'Der Schwung ist explosive Rotation, aber es sind wenige pro Runde. Die '
      + 'eigentliche Belastung ist das stundenlange Gehen.',
  },
  {
    id: 'reiten', name: 'Reiten', familie: 'Sonstiges', typisch: 75, exzentrik: 0.5,
    last: { quads: 0.5, abs: 0.45, glutes: 0.45, hamstringsHip: 0.4, hamstringsKnee: 0.35 },
    warum: 'Leichttraben und Sitz sind gehaltene Beinarbeit – der Adduktoren- und '
      + 'Quadrizepsbereich arbeitet dauerhaft gegen die Bewegung des Pferdes.',
  },
  {
    id: 'inline', name: 'Inline / Skaten', familie: 'Sonstiges', typisch: 75, exzentrik: 0.6,
    last: { quads: 0.7, glutes: 0.6, hamstringsHip: 0.45, calves: 0.4, abs: 0.35 },
    warum: 'Der seitliche Abstoß aus tiefer Position geht fast vollständig in '
      + 'Quadrizeps und Gesäß. Bremsen und Kurven machen daraus Haltearbeit.',
  },
  {
    id: 'trampolin', name: 'Trampolin', familie: 'Sonstiges', typisch: 45, exzentrik: 0.8,
    last: { calves: 0.7, quads: 0.55, abs: 0.45, glutes: 0.4 },
    warum: 'Jede Landung wird aus dem Sprunggelenk abgefangen, hunderte Male. Kurz, '
      + 'aber die Waden wissen am nächsten Tag Bescheid.',
  },
  {
    id: 'segeln', name: 'Segeln', familie: 'Sonstiges', typisch: 240, exzentrik: 0.4,
    last: { abs: 0.45, lats: 0.4, quads: 0.4, traps: 0.35, hamstringsHip: 0.35, biceps: 0.35 },
    warum: 'Ausreiten ist Rumpf- und Beinhaltearbeit über lange Zeit, Winschen und '
      + 'Schoten holen Rücken und Arme dazu.',
  },
];

export const AKT_BY_ID = new Map(AKTIVITAETEN.map((a) => [a.id, a]));

/** Die Familien in der Reihenfolge, in der sie im Katalog stehen. */
export function familien() {
  const out = [];
  AKTIVITAETEN.forEach((a) => { if (!out.includes(a.familie)) out.push(a.familie); });
  return out;
}

/**
 * Was eine Aktivität an einem Tag anrichtet.
 *
 * Gibt für jede Gruppe zwei Zahlen: `wirkung` (wie gefordert sie war) und
 * `schaden` (wie lange sie das nachträgt). Beide sind bereits mit der Dauer
 * verrechnet.
 */
export function wirkungVon(aktId, minuten) {
  const a = AKT_BY_ID.get(aktId);
  if (!a) return { wirkung: {}, schaden: {} };
  const f = dauerFaktor(minuten === undefined || minuten === null ? a.typisch : minuten);
  const wirkung = {};
  const schaden = {};
  Object.entries(a.last).forEach(([m, v]) => {
    wirkung[m] = v * f;
    schaden[m] = v * f * a.exzentrik;
  });
  return { wirkung, schaden };
}

/**
 * Welche Gruppen eine Aktivität an einem Versatz von `tage` Tagen schont.
 *
 * `tage` ist der Abstand des betrachteten Tages zum Termin: −1 ist der Tag
 * davor, 0 der Termintag, +1 der Tag danach, +2 zwei Tage danach.
 *
 *   davor und am Tag selbst   nach `wirkung` – was die Aktivität braucht,
 *                             soll vorher nicht schwer trainiert sein
 *   ein Tag danach            nach `schaden` – was sie angegriffen hat
 *   zwei Tage danach          nach `schaden`, aber nur über SCHWELLE_LANG:
 *                             Skitag, Bergabstieg, 90 Minuten Fußball
 */
export function gruppenAm(aktId, minuten, tage) {
  const { wirkung, schaden } = wirkungVon(aktId, minuten);
  if (tage === -1 || tage === 0) {
    return Object.keys(wirkung).filter((m) => wirkung[m] >= SCHWELLE);
  }
  if (tage === 1) return Object.keys(schaden).filter((m) => schaden[m] >= SCHWELLE);
  if (tage === 2) return Object.keys(schaden).filter((m) => schaden[m] >= SCHWELLE_LANG);
  return [];
}

/** Über wie viele Tage nach der Aktivität überhaupt etwas geschont wird. */
export function nachwirkung(aktId, minuten) {
  if (gruppenAm(aktId, minuten, 2).length) return 2;
  if (gruppenAm(aktId, minuten, 1).length) return 1;
  return 0;
}
