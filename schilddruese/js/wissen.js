/*
 * Wissen – kurze Kapitel in Alltagssprache.
 *
 * Jede Aussage hier stammt aus einem Faktenblatt, das vor dem Bau von drei
 * unabhängigen Prüfern (Pharmazie, Labor/Endokrinologie, Patientensicherheit)
 * Satz für Satz gegengelesen wurde; deren Präzisierungen sind eingearbeitet.
 * Quellen: Fachinformation L-Thyroxin, Leitlinie der American Thyroid
 * Association 2014 (Jonklaas et al.), ATA-Leitlinie Schwangerschaft 2017,
 * Lehrbücher der Inneren Medizin und Labormedizin. Siehe schilddruese/README.md.
 *
 * Grundregel für jeden Satz: erklären, nicht anweisen. Wo es um die Dosis
 * geht, steht immer dasselbe – das entscheidet die Ärztin. Kein Satz hier
 * darf dazu taugen, eine Tablette mehr oder weniger zu nehmen.
 *
 * Das Kapitel „Ernährung und Alltag" übernimmt die Texte E1–E16 aus dem
 * Regelwerk 2 (Dosisrichtung und Ernährung) mit den Korrekturen des roten
 * Teams; den Absatz vor der Blutabnahme liefert js/dosis.js (VOR_ABNAHME),
 * damit er überall gleich lautet.
 *
 * Die Texte sind HTML, von Hand geschrieben und ohne Eingaben von außen –
 * deshalb ohne esc(); nur was aus einem anderen Modul kommt, wird entschärft.
 */
import { esc } from './text.js';
import * as sp from './speicher.js';
import { VOR_ABNAHME } from './dosis.js';

/** E14: auch im Formular „Über mich & weitere Mittel". */
export const E14_TEXT = 'Vorsicht bei Mitteln „für die Schilddrüse" aus Internet, Drogerie oder Reformhaus: Manche enthalten viel Jod, Biotin oder sogar echtes Schilddrüsenhormon (z. B. „Thyroid", „Schilddrüsenextrakt"). Das kann zu einer Überdosis führen oder die Laborwerte verfälschen. Auch Mittel für Haare, Haut und Nägel und Vitamin-B-Komplexe enthalten oft Biotin. Zeigen Sie neue Mittel vor dem ersten Einnehmen in der Apotheke oder Praxis und tragen Sie sie in der App ein.';

/*
 * E16, mit dem Zusatz des roten Teams: „geteilt" nur, wenn die Praxis es so
 * verordnet hat – wer auf Anordnung eine halbe Tablette nimmt, soll aus
 * „nicht teilen" nicht lesen, jetzt die ganze zu nehmen. Auch im
 * Dosis-Formular.
 */
export const E16_TEXT = 'Die Tabletten gibt es in vielen Stärken, auch in Schritten von 12,5 µg. Nehmen Sie Ihre Tablette genau wie verordnet, auch geteilt, wenn die Praxis es so verordnet hat. Teilen Sie nicht zusätzlich und nehmen Sie nicht abwechselnd verschiedene Stärken, wenn die Praxis es nicht so gesagt hat. Schauen Sie bei jeder neuen Packung auf die Stärke (µg) und den Hersteller. Ist etwas anders als bisher, fragen Sie in der Apotheke nach und tragen Sie es in der App ein. Auch ein Wechsel ist ein Grund für eine Kontrolle nach 6 bis 8 Wochen.';

/** BE1 (Regelwerk 2): Beschwerden und die Dosis. */
const BE1_TEXT = 'Ihre Beschwerden helfen der Praxis beim Einordnen. Für die Dosis richtet sich die App nur nach Ihrem TSH-Wert. Beschwerden allein sind kein Grund, mehr oder weniger zu nehmen.';

export const KAPITEL = [
  {
    id: 'einnahme',
    titel: 'Die Tablette richtig nehmen',
    kurz: 'Nüchtern, mit Wasser, jeden Tag gleich',
    html: `
      <p>L-Thyroxin (Levothyroxin) ist das Schilddrüsenhormon T4 als Tablette – künstlich hergestellt, aber gleich gebaut wie das körpereigene. Es ersetzt, was die Schilddrüse nicht mehr ausreichend bildet. Der Körper macht daraus selbst die aktive Form T3. Die Tabletten werden in der Regel dauerhaft genommen.</p>
      <div class="merke"><strong>Morgens nüchtern</strong>, mindestens 30 Minuten, besser 60 Minuten vor dem Frühstück. Unzerkaut mit einem halben Glas <strong>Leitungswasser</strong> – nicht mit Kaffee, Tee, Milch, Saft oder kalziumreichem Mineralwasser.</div>
      <p><strong>Jeden Tag gleich:</strong> ungefähr dieselbe Uhrzeit, dieselben Bedingungen. Gleichmäßigkeit ist wichtiger als die genaue Minute – dann bleibt der Hormonspiegel stabil.</p>
      <h2>Oder abends</h2>
      <p>Statt morgens geht auch abends vor dem Schlafengehen, mindestens 3, besser 4 Stunden nach der letzten Mahlzeit. Danach nichts mehr essen und außer Wasser nichts trinken. Das wirkt mindestens genauso gut.</p>
      <p>Ein Wechsel zwischen morgens und abends aber nur nach Absprache mit der Ärztin – und etwa 6 bis 8 Wochen danach die Blutwerte kontrollieren lassen.</p>
      <h2>Die Dosis</h2>
      <p>Nach einem Laborwert sagt die App auf der Dosis-Karte (unter „Mehr"), ob der TSH-Wert eher für mehr, für weniger oder für die gleiche Dosis spricht – als Richtung mit der Schrittgröße, die Ärztinnen üblicherweise wählen, nie als neue Tagesdosis. Die neue Menge legt die Ärztin fest: Vor jeder Änderung bitte die Praxis anrufen und bis dahin genau wie bisher weiternehmen. Auch das Weglassen oder Hinzunehmen einzelner Tabletten ist eine Dosisänderung.</p>
      <h2>Aufbewahren</h2>
      <p>Trocken, vor Licht geschützt, nicht über 25 °C – also nicht im Badezimmer und nicht im Auto. Am besten in der Originalpackung.</p>`,
  },
  {
    id: 'vergessen',
    titel: 'Tablette vergessen?',
    kurz: 'Nachholen oder auslassen – nie doppelt',
    html: `
      <div class="merke"><strong>Nie die doppelte Menge nehmen.</strong></div>
      <p><strong>Fällt es noch am selben Tag auf:</strong> nachholen, wenn ein nüchterner Zeitpunkt möglich ist – etwa 2 bis 3 Stunden nach dem Essen und danach eine halbe Stunde nichts essen. Das geht auch abends vor dem Schlafen.</p>
      <p><strong>Geht das nicht, oder fällt es erst am nächsten Tag auf:</strong> auslassen und ganz normal weitermachen. Auch das ist richtig, so steht es in der Packungsbeilage.</p>
      <p>Eine einzelne vergessene Tablette ist nicht gefährlich: Das Hormon wirkt etwa eine Woche im Körper nach. Häufiges Vergessen zeigt sich aber in den Blutwerten – der TSH-Wert steigt. Deshalb die Einnahme hier abhaken; vergessene Tage stehen dann im Bericht für den Arzttermin.</p>
      <h2>Aus Versehen doppelt genommen?</h2>
      <p>Eine einmal doppelt genommene Tablette schadet in der Regel nicht. Beschwerden können aber verzögert kommen: Treten in den nächsten Tagen Herzklopfen, Unruhe oder Zittern auf – oder haben Sie eine Herzkrankheit –, die Praxis anrufen.</p>
      <p>Mehrere Tabletten zu viel über mehrere Tage, oder ein Kind hat Tabletten genommen: Arzt oder Giftnotruf anrufen, auch wenn noch keine Beschwerden da sind.</p>`,
  },
  {
    id: 'abstand',
    titel: 'Was Abstand braucht',
    kurz: 'Kalzium, Eisen, Kaffee, Milch, andere Medikamente',
    html: `
      <p>Manches bindet das Hormon im Darm oder verringert die Aufnahme. Die einfachste Regel: <strong>die Tablette morgens nüchtern, alles andere später.</strong></p>
      <h2>Mindestens 4 Stunden Abstand</h2>
      <ul>
        <li>Kalzium-Tabletten (auch Kalzium mit Vitamin D) und Eisen-Tabletten</li>
        <li>Magnesium, Multivitamin-Mineral-Präparate</li>
        <li>Magenmittel gegen Sodbrennen (Antazida), Sucralfat</li>
        <li>Soja-Produkte (Sojamilch, Tofu, Sojaeiweiß)</li>
        <li>Ballaststoff-Präparate wie Flohsamen, Kleie, Leinsamen</li>
        <li>Colestyramin und ähnliche Mittel gegen Cholesterin oder Gallensäure – hier 4 bis 5 Stunden; ebenso Phosphatbinder wie Sevelamer</li>
      </ul>
      <p>Reines Vitamin D ohne Kalzium stört nicht. Kleine Mengen Soja im Alltag, mit Abstand zur Tablette, sind unproblematisch. Wer viel Soja isst, damit anfängt oder aufhört, sagt es der Ärztin.</p>
      <h2>Mindestens 30, besser 60 Minuten Abstand</h2>
      <ul>
        <li>Kaffee – vermutlich auch koffeinfreier –, schwarzer und grüner Tee</li>
        <li>Milch, Joghurt, Käse, Milchkaffee, Müsli mit Milch</li>
      </ul>
      <h2>Magensäureblocker</h2>
      <p>Mittel wie Pantoprazol oder Omeprazol können bei manchen Menschen die Aufnahme verringern – hier hilft kein zeitlicher Abstand. Wichtig ist, dass die Ärztin davon weiß; beim Beginn oder Absetzen werden die Werte kontrolliert. Den Magenschutz nie wegen der Schilddrüse selbst absetzen.</p>
      <h2>Biotin vor der Blutabnahme</h2>
      <p>Biotin (Vitamin B7 oder H, oft hoch dosiert in Mitteln für Haare, Haut und Nägel) verfälscht die Laborwerte: Sie sehen dann fälschlich nach zu viel Hormon aus. Vor der Blutabnahme pausieren – bei Haar-Haut-Nägel-Präparaten mindestens 3 Tage – und die Praxis informieren. Übliche Multivitamine mit wenigen Mikrogramm stören nicht.</p>
      <h2>Andere Medikamente</h2>
      <p>Manche Medikamente verändern den Bedarf oder die Wirkung, zum Beispiel Östrogen als Tablette (Hormonersatz) – als Pflaster, Gel oder Spray kaum –, einige Epilepsiemittel oder das Herzmittel Amiodaron. Umgekehrt verstärkt L-Thyroxin Blutverdünner wie Marcumar; nach einer Dosisänderung sollte dann der INR-Wert früher kontrolliert werden. Bei Diabetes kann sich der Blutzucker ändern.</p>
      <div class="merke">Jedes neue Medikament und jedes Nahrungsergänzungsmittel der Ärztin oder in der Apotheke nennen.</div>`,
  },
  {
    id: 'ernaehrung',
    titel: 'Ernährung und Alltag',
    kurz: 'Ist die Tablette das Einzige, was zählt? Jod, Selen, Gewicht, Bewegung',
    html: `
      <h2>Ist die Tablette das Einzige, was zählt?</h2>
      <p>Die Tablette ersetzt das Hormon, das Ihre Schilddrüse nicht mehr genug bildet. Keine Ernährung und kein Nahrungsergänzungsmittel kann das ersetzen. Lassen Sie die Tablette deshalb nie weg, auch nicht bei gesunder Ernährung oder mit Naturmitteln. Für die Dosis zählen nur die Tablette und Ihr TSH-Wert. Die Ernährung spielt trotzdem eine Rolle: Sie beeinflusst, wie gut die Tablette aufgenommen wird. Deshalb zählen Abstand und Gleichmäßigkeit. Und Themen wie Cholesterin, Blutzucker, Vitamin B12, Eisen und Knochen hängen mit der Schilddrüse zusammen – dazu mehr in den folgenden Abschnitten.</p>
      <h2>Jod und Seefisch</h2>
      <p>Jodsalz im Haushalt und Seefisch ein- bis zweimal pro Woche sind auch bei Hashimoto in Ordnung. Meiden Sie hochdosierte Jodtabletten, Algen, Kelp und Algentabletten, denn sie können sehr viel Jod enthalten. Achten Sie bei Multivitamin-Präparaten auf den Jodgehalt und fragen Sie in der Apotheke. Vor einer Untersuchung mit Kontrastmittel (z. B. CT oder Herzkatheter) sagen Sie, dass Sie eine Schilddrüsenerkrankung haben.</p>
      <h2>Selen</h2>
      <p>Ein Nutzen von Selen für Ihre Dosis oder den Verlauf ist nicht belegt. Selen kann Antikörperwerte etwas senken, an der nötigen Tablettendosis ändert das nichts. Nehmen Sie Selenpräparate nur nach Rücksprache und nie mehr als empfohlen. Zu viel Selen schadet, zum Beispiel mit Haarausfall, brüchigen Nägeln oder Nervenbeschwerden. Paranüsse: höchstens 1 bis 2 Stück am Tag.</p>
      <h2>Abstand und Gleichmäßigkeit</h2>
      <p>Kaffee, Tee, Milch und Frühstück: erst 30 bis 60 Minuten nach der Tablette. Kalzium-, Eisen- und Magnesiumpräparate, Mittel gegen Sodbrennen, Soja- und Ballaststoffpräparate: 4 Stunden Abstand. Ihr persönlicher Plan steht unter „Was braucht Abstand?". Genauso wichtig: Machen Sie es jeden Tag gleich, denn Ihre Dosis ist auf Ihre Gewohnheiten eingestellt. Wenn Sie Ihre Ernährung stark umstellen, zum Beispiel neu täglich Soja, viel Kleie, Leinsamen oder Flohsamen, oder ein neues Kalziumpräparat beginnen: Sagen Sie es der Praxis und lassen Sie nach 6 bis 8 Wochen TSH kontrollieren.</p>
      <h2>Glutenfrei?</h2>
      <p>Glutenfreie Ernährung hilft nur bei nachgewiesener Zöliakie. Bei Hashimoto kommt Zöliakie etwas häufiger vor. Sprechen Sie es an bei anhaltendem Durchfall oder Blähungen, ungewolltem Abnehmen, Blutarmut oder Eisenmangel, oder wenn Ihr TSH trotz regelmäßiger, richtiger Einnahme immer wieder zu hoch ist. Wichtig: Essen Sie vor einem Bluttest auf Zöliakie <strong>nicht</strong> glutenfrei, sonst fällt der Test fälschlich unauffällig aus.</p>
      <h2>Zucker und Diabetes</h2>
      <p>Zucker hat keinen besonderen Einfluss auf die Schilddrüse. Wie für alle gilt: in Maßen. Wenn Sie Diabetes haben und Insulin oder Tabletten gegen Zucker nehmen: Messen Sie in den Wochen nach jeder Änderung der Schilddrüsendosis öfter. Mehr Schilddrüsenhormon kann den Zucker erhöhen, weniger kann ihn senken. Achten Sie besonders nach einer Verringerung auf Unterzucker: Zittern, Schwitzen, Heißhunger, Verwirrtheit. Bei starkem Durst, häufigem Wasserlassen oder ungewolltem Abnehmen lassen Sie den Blutzucker prüfen.</p>
      <h2>Gewicht</h2>
      <p>Eine unbehandelte Unterfunktion kann ein paar Kilo ausmachen, vieles davon Wasser. Ist sie gut eingestellt, gelten die normalen Regeln fürs Gewicht. L-Thyroxin ist kein Mittel zum Abnehmen: Nehmen Sie nie mehr Tabletten, um abzunehmen – das belastet Herz und Knochen. Wenn sich Ihr Gewicht um mehr als etwa 5 kg ändert, sagen Sie es bei der nächsten Kontrolle, denn dann kann sich der Bedarf ändern. Bei ungewolltem Abnehmen oder schneller Zunahme mit geschwollenen Beinen rufen Sie in den nächsten Tagen die Praxis an. Bei plötzlicher Atemnot: 112.</p>
      <h2>Cholesterin</h2>
      <p>Eine Unterfunktion erhöht das LDL-Cholesterin; mit guter Einstellung sinkt es oft wieder. Ein hohes LDL ist aber kein Grund, selbst mehr Tablette zu nehmen. Welcher LDL-Wert für Sie richtig ist, hängt von Herz, Gefäßen, Blutdruck, Diabetes und Alter ab – das legt die Ärztin fest. Einen Cholesterinsenker (Statin) bitte nicht selbst absetzen, nur weil die Schilddrüse jetzt eingestellt ist. Muskelschmerzen unter einem Statin sagen Sie der Praxis.</p>
      <h2>Müde trotz guter Werte: B12 und Eisen</h2>
      <p>Bei Hashimoto kommt eine chronische Entzündung der Magenschleimhaut häufiger vor. Sie kann zu Vitamin-B12- und Eisenmangel führen und die Aufnahme der Tablette verschlechtern. Magenschutzmittel und Metformin können den B12-Mangel verstärken. Wenn Sie trotz guter Schilddrüsenwerte müde sind oder Kribbeln, Taubheit in Händen oder Füßen, Gangunsicherheit oder Vergesslichkeit bemerken, lassen Sie Blutbild, B12 und Ferritin prüfen – bei Kribbeln, Taubheit oder Gangunsicherheit innerhalb von ein bis zwei Wochen. Eisentabletten brauchen 4 Stunden Abstand zur Schilddrüsentablette.</p>
      <h2>Vitamin D</h2>
      <p>Ein Einfluss von Vitamin D auf die Schilddrüse ist nicht belegt. Im Alter ist es für die Knochen oft sinnvoll; häufig werden 800 bis 1000 Einheiten am Tag empfohlen – klären Sie die Menge mit der Ärztin. Nehmen Sie keine hochdosierten Präparate (z. B. 20.000 Einheiten) auf eigene Faust. Achtung: Viele Vitamin-D-Präparate enthalten auch Kalzium. Dann brauchen sie 4 Stunden Abstand zur Schilddrüsentablette.</p>
      <h2>Kohl, Brokkoli und Co.</h2>
      <p>Kohl, Brokkoli, Rettich und ähnliches Gemüse sind in normalen Mengen unbedenklich, gekocht ohnehin. Da die Tablette das Hormon liefert, spielen sie praktisch keine Rolle.</p>
      <h2>Bewegung</h2>
      <p>Bewegung hilft gegen Müdigkeit und tut Gewicht, Knochen, Gleichgewicht und Stimmung gut. Steigern Sie langsam. Bei Herzklopfen oder innerer Unruhe lassen Sie das erst ärztlich klären. <strong>Bei Schmerzen oder Engegefühl in der Brust, Herzrasen mit Schwindel oder Atemnot während der Bewegung: sofort aufhören und 112 anrufen.</strong></p>
      <h2>Mittel „für die Schilddrüse"</h2>
      <p>${E14_TEXT}</p>
      <h2>Die Tablette abends?</h2>
      <p>Manche Menschen nehmen die Tablette abends vor dem Schlafen, mindestens 3 Stunden nach der letzten Mahlzeit. Das ist möglich, aber nur nach Rücksprache mit der Praxis und dann jeden Tag gleich. Ein Wechsel der Uhrzeit kann den Wert verändern. Lassen Sie danach nach 6 bis 8 Wochen kontrollieren.</p>
      <h2>Stärken und Packungen</h2>
      <p>${E16_TEXT}</p>
      <h2>Vor der Blutabnahme</h2>
      <div class="merke">${esc(VOR_ABNAHME)}</div>`,
  },
  {
    id: 'labor',
    titel: 'Laborwerte verstehen',
    kurz: 'TSH, fT4, fT3 – und wie die App sie einordnet',
    html: `
      <h2>TSH</h2>
      <p>TSH ist der Botenstoff, mit dem die Hirnanhangdrüse die Schilddrüse antreibt, und der wichtigste Wert für die Einstellung. Bekommt der Körper zu wenig Schilddrüsenhormon, <strong>steigt</strong> TSH; bekommt er zu viel, <strong>sinkt</strong> TSH. TSH reagiert sehr empfindlich – schon kleine Änderungen lassen ihn deutlich schwanken.</p>
      <p>Einheit: mU/l. Die Schreibweisen mIE/l, mIU/l, µU/ml und µIU/ml bedeuten dasselbe und haben denselben Zahlenwert.</p>
      <p class="klein gedaempft">Liegt die Ursache der Unterfunktion ausnahmsweise in der Hirnanhangdrüse selbst (selten), richtet sich die Ärztin nach fT4 statt nach TSH.</p>
      <h2>fT4</h2>
      <p>fT4 ist das freie Thyroxin – das Hormon, das in der Tablette steckt. Einheiten: pmol/l oder ng/dl (1 ng/dl entspricht 12,87 pmol/l).</p>
      <h2>fT3</h2>
      <p>fT3 ist die aktive Form, die der Körper aus T4 bildet. Einheiten: pmol/l oder pg/ml. Unter L-Thyroxin wird es zur Kontrolle meist nicht gebraucht; ein fT3 im unteren Bereich kommt dabei häufig vor.</p>
      <h2>Der Bereich des Labors</h2>
      <p>Jedes Labor hat eigene Grenzen, je nach Messverfahren. Deshalb übernimmt die App den <strong>Bereich von Ihrem Befund</strong>. Fehlt er, nimmt sie übliche Orientierungswerte und sagt das ausdrücklich dazu. Im höheren Alter liegt die obere TSH-Grenze oft etwas höher, und bei älteren Menschen wird häufig bewusst ein etwas höherer TSH-Wert angestrebt, weil zu viel Hormon Herz und Knochen belastet. Den persönlichen Zielbereich legt die Ärztin fest.</p>
      <div class="merke">Unter jedem Befund und unter „Mehr → Einschätzung" ordnet die App die Werte ein: über, im oder unter dem Bereich, welches Muster TSH und fT4 zusammen ergeben, wie dringend das ist und was in Ihren eigenen Einträgen eine Erklärung sein könnte. Ein Wert außerhalb des Bereichs ist trotzdem keine Aufforderung, sofort selbst etwas zu ändern – erst mit der Praxis sprechen.</div>
      <h2>Warum Werte schwanken</h2>
      <p>TSH ist nachts und früh morgens am höchsten, nachmittags am niedrigsten, und nach dem Essen etwas niedriger als nüchtern. Kleine Unterschiede zwischen zwei Messungen sind normal. Am besten immer unter gleichen Bedingungen abnehmen lassen: morgens, nüchtern.</p>
      <p>Wenig Aussagekraft hat ein einzelner Wert kurz nach einer Dosisänderung, während einer schweren Erkrankung oder unter Biotin.</p>`,
  },
  {
    id: 'kontrolle',
    titel: 'Blutkontrollen',
    kurz: 'Wie oft, und was am Tag der Blutabnahme gilt',
    html: `
      <h2>Wie oft</h2>
      <p><strong>Nach Beginn und nach jeder Dosisänderung:</strong> Blutkontrolle nach etwa 6 bis 8 Wochen, frühestens nach 4 Wochen. Vorher hat sich TSH noch nicht auf die neue Dosis eingependelt. Bei neuen Beschwerden – vor allem am Herzen – nicht so lange warten, sondern die Praxis anrufen.</p>
      <p><strong>Bei stabiler Einstellung:</strong> etwa alle 6 bis 12 Monate.</p>
      <p><strong>Früher kontrollieren</strong> bei neuen Beschwerden, einem neuen oder abgesetzten Medikament (etwa Magensäureblocker, Östrogene, Eisen oder Kalzium), einem Präparatwechsel, deutlicher Gewichtsänderung, mehreren Tagen Durchfall oder Erbrechen, nach schwerer Krankheit oder Krankenhausaufenthalt und in der Schwangerschaft.</p>
      <h2>Am Tag der Blutabnahme</h2>
      <p>Üblicherweise wird die Tablette erst <strong>nach</strong> der Abnahme genommen: fT4 steigt in den Stunden nach der Einnahme vorübergehend an, TSH dagegen kaum. Am besten einmal mit der Praxis absprechen, wie sie es haben möchte.</p>
      <p>Nach der Abnahme die Tablette wie gewohnt mit Wasser nehmen und danach 30 bis 60 Minuten mit dem Frühstück warten – an diesem Tag nicht weglassen. Wurde sie doch schon vorher genommen, ist das kein Beinbruch: Uhrzeit notieren und der Praxis sagen.</p>
      <h2>Zum Termin mitnehmen</h2>
      <ul>
        <li>die Packung mit Präparatname und Stärke</li>
        <li>den Bericht aus dieser App (unter „Mehr")</li>
        <li>alle anderen Medikamente und Nahrungsergänzungsmittel, am besten den Medikationsplan</li>
        <li>Ihre Fragen – auch die lassen sich hier notieren</li>
      </ul>`,
  },
  {
    id: 'zeichen',
    titel: 'Anzeichen: zu wenig oder zu viel',
    kurz: 'Beschwerden, die man ansprechen sollte',
    html: `
      <p>Viele dieser Beschwerden sind im Alter häufig und haben oft ganz andere Ursachen – etwa Eisen- oder Vitamin-B12-Mangel, Wechseljahre, Stimmungstief, Herz- oder Schlafprobleme. Sie beweisen nichts. Sie sind aber ein guter Grund, mit der Ärztin zu sprechen.</p>
      <h2>Zu wenig Hormon</h2>
      <ul>
        <li>Müdigkeit, Antriebslosigkeit</li>
        <li>Frieren</li>
        <li>Gewichtszunahme</li>
        <li>trockene Haut, brüchige Haare, Haarausfall</li>
        <li>Verstopfung</li>
        <li>gedrückte Stimmung, Konzentrations- und Gedächtnisprobleme</li>
        <li>langsamer Puls, heisere Stimme, geschwollenes Gesicht, Muskelkrämpfe</li>
      </ul>
      <h2>Zu viel Hormon</h2>
      <ul>
        <li>Herzklopfen, schneller oder unregelmäßiger Puls</li>
        <li>innere Unruhe, Nervosität, Zittern</li>
        <li>Schwitzen, Hitzeempfindlichkeit</li>
        <li>Gewichtsverlust trotz Appetit</li>
        <li>Schlafstörungen, Durchfall, Muskelschwäche</li>
      </ul>
      <p>Bei älteren Menschen fehlen die typischen Zeichen oft. Dann können ungewollter Gewichtsverlust, ein unregelmäßiger Puls, Schwäche oder neue Verwirrtheit die einzigen Hinweise sein.</p>
      <div class="merke"><strong>Beides ist ein Grund für ein Gespräch mit der Ärztin – nie ein Grund, die Dosis selbst zu ändern.</strong></div>
      <p>${BE1_TEXT}</p>
      <p>Dauerhaft zu viel Hormon erhöht – besonders im Alter und bei Frauen nach den Wechseljahren – das Risiko für Vorhofflimmern und Knochenschwund, auch wenn man sich dabei gut fühlt. „Lieber etwas mehr" ist deshalb keine gute Idee. L-Thyroxin ist auch kein Mittel zum Abnehmen.</p>
      <p>Nach einer Dosisänderung bessern sich Beschwerden erst nach einigen Wochen bis wenigen Monaten. Bleiben Beschwerden trotz guter Werte, sucht die Ärztin nach anderen Ursachen.</p>`,
  },
  {
    id: 'notfall',
    titel: 'Wann anrufen, wann 112',
    kurz: 'Notruf, Bereitschaftsdienst, Praxis',
    html: `
      <div class="hinweis-karte gefahr" style="margin-bottom:1rem"><span class="ri" aria-hidden="true">🚑</span><div>
        <strong>Notruf 112</strong> bei
        <ul style="margin:.4rem 0 0">
          <li>plötzlichem starkem Herzrasen oder Herzstolpern mit Schwindel</li>
          <li>Brustschmerz oder Engegefühl in der Brust</li>
          <li>Atemnot, Ohnmacht</li>
          <li>plötzlicher einseitiger Lähmung oder Sprachstörung</li>
          <li>extremer Schläfrigkeit, Verwirrtheit, sehr niedriger Körpertemperatur oder sehr langsamem Atem – selten, bei schwerer Unterversorgung, etwa nach längerem Weglassen der Tabletten</li>
        </ul>
      </div></div>
      <p><a class="knopf knopf-gefahr knopf-breit" href="tel:112">112 anrufen</a></p>
      <h2>Außerhalb der Sprechzeiten, nicht lebensbedrohlich</h2>
      <p>Ärztlicher Bereitschaftsdienst: <strong>116 117</strong>.</p>
      <p><a class="knopf knopf-breit" href="tel:116117">116 117 anrufen</a></p>
      <h2>Zu viele Tabletten genommen</h2>
      <p>Arzt oder Giftnotruf. Der Giftnotruf ist in Deutschland regional organisiert.</p>
      <!--giftnotruf-->
      <h2>In den nächsten Tagen die Praxis anrufen</h2>
      <ul>
        <li>neue, anhaltende Beschwerden aus „Anzeichen: zu wenig oder zu viel"</li>
        <li>mehrfach vergessene Tabletten</li>
        <li>ein neues oder abgesetztes Medikament oder Nahrungsergänzungsmittel</li>
        <li>ein anderes Präparat aus der Apotheke</li>
        <li>mehrere Tage Durchfall oder Erbrechen, ungewollter Gewichtsverlust, unregelmäßiger Puls</li>
        <li>geplante Operation oder Untersuchung mit Kontrastmittel</li>
        <li>Schwangerschaft</li>
      </ul>`,
  },
  {
    id: 'gut-zu-wissen',
    titel: 'Gut zu wissen',
    kurz: 'Hashimoto, Jod, Präparatwechsel, Operation',
    html: `
      <h2>Hashimoto</h2>
      <p>Die häufigste Ursache einer Unterfunktion: Das Abwehrsystem greift die Schilddrüse langsam an, sie bildet nach und nach weniger Hormon. Behandelt wird die Unterfunktion ganz normal mit L-Thyroxin. Die nötige Dosis kann sich über die Jahre ändern – deshalb die regelmäßigen Kontrollen. Die Antikörper (TPO-AK, Tg-AK) bestätigen die Ursache; ihre Höhe sagt nichts über die richtige Dosis und muss nicht laufend gemessen werden.</p>
      <h2>Dauerhaft nehmen</h2>
      <p>Nach einer Operation an der Schilddrüse, nach Radiojod und auch bei Hashimoto wird das Hormon in der Regel dauerhaft ersetzt. Die Tabletten nie eigenmächtig absetzen, auch wenn es einem gut geht – die Beschwerden kommen nach Wochen zurück. Ob eine Behandlung ausnahmsweise enden kann, entscheidet die Ärztin.</p>
      <h2>Jod</h2>
      <p>Normale Ernährung mit Jodsalz und Seefisch ist auch bei Hashimoto in Ordnung. Hoch dosierte Jodpräparate, Algen oder Kelp und jodhaltige Nahrungsergänzungsmittel „für die Schilddrüse" nur nach Rücksprache. Kombinationspräparate aus L-Thyroxin und Jod sind bei Hashimoto meist nicht sinnvoll – das mit der Ärztin besprechen. Jodhaltiges Kontrastmittel (etwa beim CT) und das Herzmittel Amiodaron der Schilddrüsenpraxis melden.</p>
      <h2>Anderes Präparat</h2>
      <p>Präparate verschiedener Hersteller können sich in der Aufnahme leicht unterscheiden. L-Thyroxin darf die Apotheke deshalb in Deutschland nicht einfach austauschen. Ein Wechsel kommt trotzdem vor, etwa bei Lieferengpässen. Bei jeder Abholung Name und Stärke auf der Packung prüfen. Sieht etwas anders aus: nachfragen, hier als neue Dosis eintragen und mit der Ärztin eine Kontrolle nach 6 bis 8 Wochen besprechen.</p>
      <h2>Herz und Alter</h2>
      <p>Bei älteren Menschen und bei Herzkrankheit wird mit einer niedrigen Dosis begonnen und nur langsam gesteigert, damit das Herz nicht überlastet wird. Wie schnell, entscheidet die Ärztin. Im Alter sinkt der Bedarf oft wieder – auch eine Dosissenkung ist dann normal. Neue Herzbeschwerden sofort melden.</p>
      <h2>Operation</h2>
      <p>Vor einer Operation die Tabletten nicht absetzen. In der Regel werden sie auch am Tag der Operation mit einem Schluck Wasser genommen – außer das Operationsteam sagt etwas anderes.</p>
      <h2>Schwangerschaft</h2>
      <p>Nur als Hinweis: In der Schwangerschaft steigt der Bedarf schon in den ersten Wochen deutlich. Bei Kinderwunsch oder Schwangerschaft sofort die Ärztin informieren.</p>`,
  },
  {
    id: 'app',
    titel: 'Was diese App kann – und was nicht',
    kurz: 'Grenzen, Datenschutz, Sicherung',
    html: `
      <p>Die App ist eine Alltagshilfe: Sie hilft beim Abhaken der Tablette, speichert Dosis, Laborwerte, Gewicht und Beschwerden, ordnet sie ein und schreibt daraus einen Bericht für den Arzttermin.</p>
      <div class="merke">Sie <strong>ordnet Werte und Beschwerden nach festen Regeln ein</strong>: wo ein Wert zum Bereich liegt, welches Muster TSH und fT4 zusammen ergeben, wie dringend das ist und was in Ihren Einträgen eine Erklärung sein könnte. Die <strong>Dosis-Karte</strong> sagt, ob der letzte TSH-Wert eher für mehr, weniger oder gleich viel spricht, und nennt die Schrittgröße, die Ärztinnen üblicherweise wählen. Sie <strong>rechnet keine neue Dosis</strong> aus und <strong>ersetzt keinen Arztbesuch</strong>: Vor jeder Änderung bitte die Praxis anrufen – die neue Menge legt die Ärztin fest.</div>
      <p>Die Einschätzung gilt nur für Erwachsene mit einer bekannten, behandelten Unterfunktion. Hat die Praxis Ihnen einen Wert schon erklärt, gilt deren Einschätzung.</p>
      <h2>Woher die Regeln stammen</h2>
      <p>Die Regeln stehen in zwei Regelwerken: eines für Laborwerte, Beschwerden, Warnzeichen und Wechselwirkungen, eines für die Dosis-Karte und die Ernährung. Jedes haben drei unabhängige Prüfer mit verschiedenem Blick (Hormone, Labor, Arzneimittel und Patientensicherheit) gegengelesen, danach hat ein „rotes Team" sie an Fallbeispielen angegriffen. <strong>Offen gesagt: Alle Prüfer waren KI-Agenten, keine Ärztinnen.</strong> Bitte lassen Sie die App deshalb vor dem Gebrauch einmal von Ihrer Ärztin oder Apothekerin ansehen und tragen Sie den TSH-Zielbereich ein, den sie Ihnen nennt.</p>
      <p>Sie ist kein Medizinprodukt, sondern nur für den eigenen, privaten Gebrauch gedacht – bitte geben Sie sie nicht an andere weiter.</p>
      <h2>Beschwerden</h2>
      <p>${BE1_TEXT}</p>
      <h2>Ihre Daten</h2>
      <p>Alles, was Sie eintragen, bleibt <strong>nur auf diesem Handy</strong>, im Speicher des Browsers. Es gibt kein Konto und keinen Server, und nichts wird verschickt – außer Sie teilen selbst den Bericht oder eine Sicherung.</p>
      <p>Das heißt auch: Bei einem neuen Handy, beim Löschen der Browserdaten oder wenn der Browser aufräumt, sind die Daten weg. Deshalb ab und zu unter „Mehr → Sicherung" eine Sicherungsdatei speichern.</p>
      <h2>Erinnern</h2>
      <p>Die App kann sich nicht von selbst melden, wenn sie geschlossen ist. Zuverlässig erinnert der Kalender oder Wecker des Handys – die Kalenderdatei dafür gibt es unter „Mehr → Erinnerung".</p>`,
  },
];

export function kapitel(id) {
  return KAPITEL.find((k) => k.id === id) || null;
}

/*
 * Der Giftnotruf im Kapitel „Wann anrufen, wann 112": die Nummer fürs
 * eingetragene Bundesland als Knopf. Vorher stand dort nur „zum Beispiel
 * Berlin 030 19240" – wer in Bayern wohnt, las die falsche Nummer (B67).
 * Ohne Bundesland: 112 (RW1 P5) – der Knopf steht oben im Kapitel.
 */
function giftnotrufAbsatz(stand) {
  const land = stand ? sp.BUNDESLAENDER.find(([k]) => k === stand.profil.bundesland) : null;
  if (!land) {
    return '<p>Ohne eingetragenes Bundesland kennt die App Ihre Giftnotruf-Nummer nicht – dann rufen Sie 112 an. Tragen Sie unter „Über mich" Ihr Bundesland ein, dann steht die Nummer hier und oben auf „Heute". <button type="button" class="knopf-link" data-act="seite" data-seite="profil">Bundesland eintragen</button></p>';
  }
  const nummer = land[2];
  return `<p>Für ${esc(land[1])}: <strong>${esc(nummer)}</strong>.</p>
      <p><a class="knopf knopf-breit knopf-anruf" href="tel:${esc(nummer.replace(/[^\d+]/g, ''))}">Giftnotruf ${esc(nummer)} anrufen</a></p>`;
}

/** Das HTML eines Kapitels – mit dem, was vom eingetragenen Stand abhängt. */
export function kapitelHtml(k, stand) {
  return k.html.replace('<!--giftnotruf-->', giftnotrufAbsatz(stand));
}
