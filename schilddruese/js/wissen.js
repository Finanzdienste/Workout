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
import { BETREIBER } from './rueckkanal.js';

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
  /*
   * Begrüßung (Nov. 2026): „Warum die Tablette wichtig ist" – dasselbe wie das
   * Begrüßungsfenster (js/ansicht-begruessung.js), etwas ausführlicher. Die
   * Nutzerin hatte die Tabletten weggelassen, weil sie „nur den einen Wert"
   * beeinflussten. Der Text ist medizinisch und sprachlich geprüft (Quellen
   * beim Auftrag zu PR #4: DEGAM-Leitlinie „Erhöhter TSH-Wert in der
   * Hausarztpraxis", ETA 2013, ATA 2014, Fachinformation L-Thyroxin, TRUST
   * 2017, Rodondi 2010, ATA 2015) und steht hier wörtlich. Er erklärt, ohne
   * Druck: Zweifel sind berechtigt, die Praxis wägt ab, und wer die Tablette
   * schon weggelassen hat, sagt es ihr in den nächsten Tagen – dieselbe Frist
   * wie „mehrfach vergessene Tabletten" im Kapitel „Wann anrufen". Die Zeichen
   * eines sehr starken Mangels und die 112 wie dort; Herzklopfen seit Tagen
   * „heute noch … 116 117 … 112" wie in „Anzeichen" und „Wann anrufen".
   * Verweise innerhalb des Kapitels stehen als Text: Ein Sprung über die
   * Adresse (#…) legte einen Eintrag in den Verlauf des Browsers, und die
   * Zurück-Taste führte dann nicht mehr aus der Seite heraus.
   */
  {
    id: 'tablette',
    titel: 'Warum die Tablette wichtig ist',
    kurz: 'Was das Hormon tut – und was die Tablette kann und was nicht',
    html: `
      <h2>Eine berechtigte Frage</h2>
      <p>Viele Menschen fragen sich irgendwann: Brauche ich diese Tablette wirklich? Sie verändert doch nur einen Wert, und das eigentliche Problem bleibt. Diese Frage ist berechtigt, und sie verdient eine ehrliche Antwort. Hier steht, was das Hormon im Körper tut und was die Tablette kann – und was nicht. Und was Sie tun können, wenn Sie zweifeln oder die Tablette schon eine Weile weggelassen haben.</p>
      <h2>Was das Schilddrüsenhormon tut</h2>
      <p>Die Schilddrüse bildet vor allem das Hormon Thyroxin, kurz T4. Der Körper macht daraus in vielen Organen die aktive Form T3. Dieses Hormon wirkt in fast jeder Zelle. Es steuert mit, wie viel Energie der Körper umsetzt – sozusagen, wie schnell der Motor läuft.</p>
      <p>Es hat Einfluss auf vieles: Kraft und Ausdauer, Körperwärme, Herzschlag, Verdauung, Denken und Gedächtnis, Stimmung, Haut und Haare. Auch wie der Körper Cholesterin abbaut, hängt davon ab. Bei einer Unterfunktion bildet die Schilddrüse zu wenig Hormon. Dann läuft vieles langsamer.</p>
      <p>Das Hormon ist dabei ein Einfluss unter vielen. Nicht jede Müdigkeit kommt von der Schilddrüse, und nicht alles wird durch die Tablette besser.</p>
      <h2>Die Tablette ist das Hormon selbst</h2>
      <p>Der Wirkstoff der Tablette heißt L-Thyroxin oder Levothyroxin. Das ist genau dieses Hormon T4. Es wird künstlich hergestellt, ist aber gleich gebaut wie das körpereigene. Der Körper macht daraus selbst T3, so wie aus dem eigenen Hormon. Die Tablette ersetzt also, was fehlt. Sie wirkt nicht auf einen Wert, sondern im ganzen Körper. Der TSH-Wert ist dafür nur die Anzeige.</p>
      <p>In der richtigen Menge ist sie für den Körper nichts Fremdes. Kommen trotzdem Beschwerden, passt manchmal die Menge nicht, und manchmal steckt etwas anderes dahinter. Das klärt die Praxis mit Ihnen. Mehr dazu unten unter „Wenn es Ihnen mit der Tablette nicht gut geht".</p>
      <h2>TSH: eine Anzeige, nicht das Ziel</h2>
      <p>TSH ist ein Botenstoff aus der Hirnanhangdrüse, einer kleinen Drüse im Kopf. Mit ihm treibt sie die Schilddrüse an. Hat der Körper zu wenig Hormon, schickt sie mehr TSH, und der Wert steigt. Ist genug da, sinkt er wieder.</p>
      <p>Man kann sich TSH wie einen Ruf nach Hormon vorstellen. Ist zu wenig da, ruft die Hirnanhangdrüse lauter. Ist genug da, wird sie leiser. Das Ziel ist nicht ein bestimmter Ruf, sondern genug Hormon in den Zellen. Ob das stimmt, zeigt der TSH-Wert meist am genauesten.</p>
      <p>Deshalb spricht die Praxis von einem TSH-Zielbereich: Liegt der Wert darin, kommt meist genug Hormon an. Und deshalb richtet sich auch die Dosis-Karte der App nach TSH. Liegt die Ursache ausnahmsweise in der Hirnanhangdrüse selbst, schaut die Ärztin statt auf TSH auf das fT4.</p>
      <p>Ein guter Wert mit der Tablette heißt meist: Die Menge passt. Wie der Wert ohne Tablette wäre, zeigt er nicht.</p>
      <h2>Was die Tablette kann – und was nicht</h2>
      <p>Die Tablette macht die Schilddrüse nicht wieder gesund. Am häufigsten steckt Hashimoto hinter einer Unterfunktion: Das Abwehrsystem greift die Schilddrüse langsam an, und sie bildet nach und nach weniger Hormon. Bei anderen wurde die Schilddrüse ganz oder zum Teil entfernt oder mit Radiojod behandelt, also mit radioaktivem Jod. Dann bildet sie oft zu wenig oder gar kein eigenes Hormon mehr.</p>
      <p>Die Tablette ersetzt aber, was fehlt. Ähnlich wie eine Brille: Sie heilt die Augen nicht, aber man sieht damit gut. Deshalb wird das Hormon meist ein Leben lang ersetzt. Ob es in Ihrem Fall anders sein kann, besprechen Sie mit der Ärztin. Mehr dazu unter „Braucht jeder die Tablette?".</p>
      <h2>Was ohne das Hormon passiert</h2>
      <p>Das Hormon baut sich im Körper nur langsam ab: Nach etwa einer Woche ist noch ungefähr die Hälfte da. Deshalb merkt man nicht gleich etwas, wenn die Tablette fehlt. Über Wochen bis Monate kommen aber meist Beschwerden: Müdigkeit, Frieren, Gewichtszunahme, Verstopfung, Vergesslichkeit, gedrückte Stimmung, ein langsamer Puls. Wie stark, hängt davon ab, wie viel Hormon die eigene Schilddrüse noch bildet.</p>
      <p>Im Alter kommen diese Beschwerden oft schleichend. Man hält sie dann leicht für Alterszeichen. Dass man anfangs nichts merkt, heißt also nicht, dass man das Hormon nicht braucht.</p>
      <p>Über Jahre kann ein deutlicher Mangel das Cholesterin erhöhen und Herz und Gefäße belasten.</p>
      <p>Sehr selten wird ein starker Mangel gefährlich. Meist fehlen dann die Tabletten schon lange, und eine Infektion, Kälte oder Beruhigungs- oder Schlafmittel kommen dazu. Zeichen sind extreme Schläfrigkeit, Verwirrtheit, eine sehr niedrige Körpertemperatur oder ein sehr langsamer Atem. Dann gilt: 112.</p>
      <p><a class="knopf knopf-gefahr" href="tel:112">112 anrufen</a></p>
      <h2>Braucht jeder die Tablette?</h2>
      <p>Nein, nicht jeder mit einem erhöhten TSH-Wert. Ist TSH nur leicht erhöht und gibt es keine Beschwerden, rät die Leitlinie für Hausarztpraxen, zunächst keine Tablette zu beginnen. Das gilt in jedem Alter. Der Wert wird dann regelmäßig kontrolliert. Im Alter kommt dazu, dass TSH oft von Natur aus etwas höher liegt.</p>
      <p>Eine große Studie hat ältere Menschen mit nur leicht erhöhtem Wert untersucht. Bei ihnen hat die Tablette die Beschwerden nach einem Jahr im Durchschnitt nicht spürbar gebessert. Die meisten hatten aber auch nur wenige Beschwerden. Für eine deutliche Unterfunktion gilt das Ergebnis nicht.</p>
      <p>Eine deutliche Unterfunktion heißt: TSH ist stark erhöht, oder das fT4 ist zu niedrig. Das fT4 ist das freie Hormon im Blut. Dann braucht der Körper das Hormon meist von außen. Das gilt auch, wenn die Schilddrüse nach einer Operation oder Radiojod fehlt oder kaum noch arbeitet.</p>
      <p>Was davon in Ihrem Fall zutrifft, lässt sich an einem Wert mit Tablette nicht ablesen. Denn die Tablette verändert ihn. Auch ein Wert wenige Wochen nach dem Weglassen zeigt es noch nicht sicher, denn das Hormon wirkt lange nach. Das weiß Ihre Praxis: aus den Werten vor der Behandlung und aus Ihrer Vorgeschichte.</p>
      <p>Und ob man eine Tablette, die man schon lange nimmt, weglassen kann, ist noch einmal eine eigene Frage. Sie lässt sich nur mit der Praxis und mit Blutkontrollen klären.</p>
      <h2>Wenn es Ihnen mit der Tablette nicht gut geht</h2>
      <p>Vielleicht fühlen Sie sich trotz Tablette nicht besser, oder es geht Ihnen mit ihr sogar schlechter. Sagen Sie es der Praxis. Oft passt dann die Menge nicht, oder etwas stört die Wirkung. Manchmal steckt auch etwas ganz anderes dahinter.</p>
      <p>Zu viel Hormon kann zum Beispiel unruhig machen, schwitzen lassen oder den Schlaf stören. Zu wenig Hormon macht eher müde und verfroren. Die Wirkung verändern können Kaffee, Milch oder Kalzium kurz nach der Tablette, ein anderes Präparat oder ein neues Medikament.</p>
      <p>Bleiben Beschwerden trotz guter Werte, sucht die Ärztin nach anderen Ursachen, zum Beispiel einem Mangel an Eisen oder Vitamin B12. Selten verträgt jemand einen Hilfsstoff der Tablette nicht. Dann kann ein anderes Präparat helfen.</p>
      <p>Sagen Sie es also ruhig, wenn Sie sich nicht gut fühlen. In der App können Sie auf „Heute" eintragen, wie es Ihnen geht. Das steht dann auch im Bericht. Die Menge legt die Praxis mit Ihnen fest.</p>
      <p>Bei Herzklopfen seit Tagen oder einem neu unregelmäßigen Puls rufen Sie bitte heute noch die Praxis an. Ist sie geschlossen, rufen Sie den Bereitschaftsdienst 116 117 an. Bei plötzlichem starkem Herzrasen mit Schwindel, bei Brustschmerz oder Atemnot: sofort 112. Was wann wichtig ist, steht im Kapitel „<button type="button" class="knopf-link" data-act="seite" data-seite="wissen-kapitel" data-param="notfall">Wann anrufen, wann 112</button>".</p>
      <div class="knopf-reihe"><a class="knopf" href="tel:116117">116 117 anrufen</a><a class="knopf knopf-gefahr" href="tel:112">112 anrufen</a></div>
      <h2>So wirkt die Tablette am besten</h2>
      <p>Morgens nüchtern mit einem halben Glas Leitungswasser, mindestens 30 Minuten, besser 60 Minuten vor dem Frühstück und vor dem Kaffee. Jeden Tag ungefähr gleich. Mehr dazu, auch zur Einnahme am Abend, im Kapitel „<button type="button" class="knopf-link" data-act="seite" data-seite="wissen-kapitel" data-param="einnahme">Die Tablette richtig nehmen</button>".</p>
      <h2>Wenn Sie zweifeln</h2>
      <p>Sprechen Sie Ihre Zweifel in der Praxis an. Das ist Ihr gutes Recht, und Ärztinnen hören diese Frage nicht zum ersten Mal. Dort können Sie besprechen, was in Ihrem Fall für die Tablette spricht und was dagegen.</p>
      <p>Fragen, die dabei helfen: Warum nehme ich die Tablette? Wie hoch waren meine Werte, bevor ich damit angefangen habe? Brauche ich sie weiter, und in welcher Menge? Ich habe die Tablette eine Zeit lang weggelassen – was heißt das für mich? Notieren Sie sich die Fragen unter „<button type="button" class="knopf-link" data-act="seite" data-seite="fragen">Mehr → Meine Fragen</button>". Dann stehen sie auch im Bericht für den Arzttermin.</p>
      <p>Haben Sie die Tablette schon eine Weile nicht genommen? Sagen Sie es der Praxis in den nächsten Tagen, offen und ohne schlechtes Gewissen. Auch das hört man dort nicht zum ersten Mal. Am besten, bevor Sie wieder anfangen und vor der nächsten Blutabnahme. Sonst sieht ein hoher Wert so aus, als bräuchten Sie eine höhere Dosis. Nach einer langen Pause oder bei einer Herzkrankheit beginnt die Ärztin manchmal mit weniger. Fehlende Tabletten werden nicht nachgeholt.</p>
      <p>In der App haken Sie nur die Tage ab, an denen Sie die Tablette genommen haben. Dann stimmt auch der Bericht.</p>
      <div class="merke">Jede Änderung, auch eine Pause oder eine kleinere Menge, besprechen Sie bitte mit der Praxis. Sie legt die Dosis mit Ihnen fest, meist mit einer Blutkontrolle nach 6 bis 8 Wochen.</div>`,
  },
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
  /*
   * „Tablette vergessen?" – zwei Korrekturen aus der dritten Durchsicht:
   * Nachholen „mindestens 3 Stunden nach dem Essen" wie E15, der Plan (M3)
   * und die Kalender-Erinnerung; vorher stand hier „2 bis 3 Stunden", eine
   * Zahl unter der Leitlinie (D5). Und der Fall „mehr als eine Tablette zu
   * viel auf einmal" fehlte: Wer drei auf einmal genommen hatte, fand nur
   * „einmal doppelt: schadet nicht" – der Check sagt dazu „jetzt der
   * Giftnotruf" (W4a; D10). Die Nummer fürs Bundesland kommt wie im Kapitel
   * „Wann anrufen" aus <!--giftnotruf-->, die 112 steht als Knopf darunter.
   *
   * Runde 6: G22 – „einmal doppelt" wie im Warnzeichen-Check (W4b): Hier
   * stand „– oder haben Sie eine Herzkrankheit –, die Praxis anrufen", der
   * Check sagte zum selben Ereignis „beim nächsten Kontakt erwähnen" und
   * beobachtete nur „heute". Jetzt beide gleich: anrufen, wenn in den
   * nächsten Tagen Beschwerden kommen (die Wirkung setzt verzögert ein); bei
   * Herzkrankheit oder T3 beim nächsten Kontakt sagen (RW1 W4b: keine
   * Anruf-Aufforderung ohne Beschwerden).
   */
  {
    id: 'vergessen',
    titel: 'Tablette vergessen?',
    kurz: 'Nachholen oder auslassen – nie doppelt',
    html: `
      <div class="merke"><strong>Nie die doppelte Menge nehmen.</strong></div>
      <p><strong>Fällt es noch am selben Tag auf:</strong> nachholen, wenn ein nüchterner Zeitpunkt möglich ist – mindestens 3 Stunden nach dem Essen und danach eine halbe Stunde nichts essen. Das geht auch abends vor dem Schlafen.</p>
      <p><strong>Geht das nicht, oder fällt es erst am nächsten Tag auf:</strong> auslassen und ganz normal weitermachen. Auch das ist richtig, so steht es in der Packungsbeilage.</p>
      <p>Eine einzelne vergessene Tablette ist nicht gefährlich: Das Hormon wirkt etwa eine Woche im Körper nach. Häufiges Vergessen zeigt sich aber in den Blutwerten – der TSH-Wert steigt. Deshalb die Einnahme hier abhaken; vergessene Tage stehen dann im Bericht für den Arzttermin.</p>
      <h2>Aus Versehen doppelt genommen?</h2>
      <p>Eine einmal doppelt genommene Tablette schadet in der Regel nicht. Beschwerden können aber verzögert kommen: Treten in den nächsten Tagen Herzklopfen, Unruhe oder Zittern auf, die Praxis anrufen. Bei einer Herzkrankheit oder einem Präparat mit T3-Anteil (z. B. Novothyral) sagen Sie es der Praxis beim nächsten Kontakt, auch ohne Beschwerden.</p>
      <p><strong>Mehr als eine Tablette zu viel auf einmal</strong> (zum Beispiel drei statt einer): jetzt den Giftnotruf anrufen, auch ohne Beschwerden – sie kommen oft erst nach Tagen. Halten Sie die Packung bereit.</p>
      <p>Mehrere Tabletten zu viel über mehrere Tage, oder ein Kind hat Tabletten genommen: Arzt oder Giftnotruf anrufen, auch wenn noch keine Beschwerden da sind.</p>
      <!--giftnotruf-->
      <p><strong>Bei Herzrasen, Brustschmerz, Atemnot oder Verwirrtheit: sofort 112.</strong></p>
      <p><a class="knopf knopf-gefahr knopf-breit" href="tel:112">112 anrufen</a></p>`,
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
  /*
   * Runde 6: G23 – Ein neu unregelmäßiger Puls und eine neue Verwirrtheit
   * waren hier nur „ein Grund für ein Gespräch mit der Ärztin"; gelesen wird
   * das als Anlass für den nächsten Termin. Dieselben Zeichen heißen im
   * Check, auf der Befinden-Karte und im Kapitel „Wann anrufen" heute
   * anrufen (W2h, S4) bzw. sofort 112 (W1). Kein Text darf eine niedrigere
   * Stufe nennen (RW1 Grundsatz 5, L3f); die D2-Korrektur (Runde 3) hatte nur
   * das Kapitel „Wann anrufen" angepasst. Die Nummern als Knöpfe; 116 117,
   * falls die Praxis geschlossen ist.
   */
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
        <li>Herzklopfen, schneller oder unregelmäßiger Puls – ist der Puls neu unregelmäßig: heute noch die Praxis anrufen</li>
        <li>innere Unruhe, Nervosität, Zittern</li>
        <li>Schwitzen, Hitzeempfindlichkeit</li>
        <li>Gewichtsverlust trotz Appetit</li>
        <li>Schlafstörungen, Durchfall, Muskelschwäche</li>
      </ul>
      <p>Bei älteren Menschen fehlen die typischen Zeichen oft. Dann können ungewollter Gewichtsverlust, ein unregelmäßiger Puls, Schwäche oder neue Verwirrtheit die einzigen Hinweise sein.</p>
      <p><strong>Ist der Puls neu unregelmäßig, rufen Sie heute noch die Praxis an – ist sie geschlossen, den Bereitschaftsdienst 116 117. Bei plötzlicher, neuer Verwirrtheit: sofort 112.</strong> Mehr dazu: <button type="button" class="knopf-link" data-act="seite" data-seite="wissen-kapitel" data-param="notfall">Wann anrufen, wann 112</button></p>
      <div class="knopf-reihe"><a class="knopf" href="tel:116117">116 117 anrufen</a><a class="knopf knopf-gefahr" href="tel:112">112 anrufen</a></div>
      <div class="merke"><strong>Beides ist ein Grund für ein Gespräch mit der Ärztin – nie ein Grund, die Dosis selbst zu ändern.</strong></div>
      <p>${BE1_TEXT}</p>
      <p>Dauerhaft zu viel Hormon erhöht – besonders im Alter und bei Frauen nach den Wechseljahren – das Risiko für Vorhofflimmern und Knochenschwund, auch wenn man sich dabei gut fühlt. „Lieber etwas mehr" ist deshalb keine gute Idee. L-Thyroxin ist auch kein Mittel zum Abnehmen.</p>
      <p>Nach einer Dosisänderung bessern sich Beschwerden erst nach einigen Wochen bis wenigen Monaten. Bleiben Beschwerden trotz guter Werte, sucht die Ärztin nach anderen Ursachen.</p>`,
  },
  /*
   * „Heute noch die Praxis anrufen" (D2): Herzklopfen seit Tagen, ein neu
   * unregelmäßiger Puls, Erbrechen über mehr als einen Tag … standen unter
   * „In den nächsten Tagen" – der Check (W2h), die Befinden-Karte (S4) und
   * die Dosis-Karte sagen dazu „heute noch". Dieses Kapitel liest die
   * Nutzerin allein als Leitfaden; es darf keine längere Frist nennen als die
   * App an anderer Stelle (RW1 Grundsatz 5, L3f). Die Liste ist die aus W2h.
   *
   * Runde 6: G19 – Die 112-Liste nannte keine Blutung; „Nasenbluten, das
   * nicht aufhört" stand nur unter „Heute noch". Unter Blutverdünnern ist
   * ein Nasenbluten, das sich trotz Zudrücken nicht stillen lässt, ein
   * Notfall. Jetzt wie im Warnzeichen-Check: W1 „starke Blutung, die nicht
   * aufhört" mit Nasenbluten nach 15 Minuten Zudrücken, Bluterbrechen und
   * schwarzem Stuhl → 112; W2h die Blutungszeichen, die nicht warten sollen,
   * aber kein Notfall sind → heute. Dazu W1 „plötzliche, neue Verwirrtheit",
   * die hier nur als seltene Folge schwerer Unterversorgung stand (G23).
   */
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
          <li>plötzlicher, neuer Verwirrtheit</li>
          <li>einer starken Blutung, die nicht aufhört – auch Nasenbluten, das nach 15 Minuten Zudrücken nicht steht (besonders mit Blutverdünnern wie Marcumar), Bluterbrechen oder schwarzem, teerartigem Stuhl</li>
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
      <h2>Heute noch die Praxis anrufen</h2>
      <ul>
        <li>Herzklopfen seit Tagen oder Puls neu unregelmäßig</li>
        <li>Ruhepuls mehrmals über 100 oder unter 50 Schläge pro Minute</li>
        <li>Erbrechen länger als einen Tag oder Durchfall über mehrere Tage</li>
        <li>über mehrere Tage versehentlich zu viele Tabletten genommen</li>
        <li>keine Schilddrüsen-Tabletten mehr im Haus</li>
        <li>mit Marcumar: Nasen- oder Zahnfleischbluten, das öfter kommt, Blut im Urin oder Stuhl, große blaue Flecken ohne Grund</li>
      </ul>
      <p>Ist die Praxis geschlossen: Bereitschaftsdienst 116 117. Wenn es schlimmer wird oder ein Notfallzeichen dazukommt: 112.</p>
      <div class="knopf-reihe"><a class="knopf" href="tel:116117">116 117 anrufen</a><a class="knopf knopf-gefahr" href="tel:112">112 anrufen</a></div>
      <h2>In den nächsten Tagen die Praxis anrufen</h2>
      <ul>
        <li>neue, anhaltende Beschwerden aus „Anzeichen: zu wenig oder zu viel" – außer Herzklopfen oder unregelmäßigem Puls, siehe oben</li>
        <li>mehrfach vergessene Tabletten</li>
        <li>ein neues oder abgesetztes Medikament oder Nahrungsergänzungsmittel</li>
        <li>ein anderes Präparat aus der Apotheke</li>
        <li>ungewollter Gewichtsverlust</li>
        <li>geplante Operation oder Untersuchung mit Kontrastmittel</li>
        <li>Schwangerschaft</li>
      </ul>`,
  },
  /*
   * Begrüßung (Nov. 2026): „Dauerhaft nehmen" so ruhig wie das neue Kapitel
   * „Warum die Tablette wichtig ist". Vorher „nie eigenmächtig absetzen … die
   * Beschwerden kommen nach Wochen zurück … entscheidet die Ärztin" – strenger
   * als dort, wo Zweifel ausdrücklich ihr gutes Recht sind und die Beschwerden
   * meist erst nach Wochen bis Monaten kommen.
   */
  {
    id: 'gut-zu-wissen',
    titel: 'Gut zu wissen',
    kurz: 'Hashimoto, Jod, Präparatwechsel, Operation',
    html: `
      <h2>Hashimoto</h2>
      <p>Die häufigste Ursache einer Unterfunktion: Das Abwehrsystem greift die Schilddrüse langsam an, sie bildet nach und nach weniger Hormon. Behandelt wird die Unterfunktion ganz normal mit L-Thyroxin. Die nötige Dosis kann sich über die Jahre ändern – deshalb die regelmäßigen Kontrollen. Die Antikörper (TPO-AK, Tg-AK) bestätigen die Ursache; ihre Höhe sagt nichts über die richtige Dosis und muss nicht laufend gemessen werden.</p>
      <h2>Dauerhaft nehmen</h2>
      <p>Nach einer Operation an der Schilddrüse, nach Radiojod und auch bei Hashimoto wird das Hormon in der Regel dauerhaft ersetzt. Bitte nicht ohne Absprache absetzen, auch wenn es einem gut geht – Beschwerden kommen meist erst nach Wochen bis Monaten. Ob es in Ihrem Fall anders sein kann, besprechen Sie mit der Ärztin. Mehr dazu: <button type="button" class="knopf-link" data-act="seite" data-seite="wissen-kapitel" data-param="tablette">Warum die Tablette wichtig ist</button></p>
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
      <p>Alles, was Sie eintragen, bleibt <strong>nur auf diesem Handy</strong>, im Speicher des Browsers. Es gibt kein Konto, und keiner Ihrer Einträge wird verschickt – außer Sie teilen selbst den Bericht oder eine Sicherung.</p>
      <p>Nur eine kurze Meldung geht einmal am Tag an ${BETREIBER}, damit er sieht, ob die App bei Ihnen läuft und aktuell ist – ohne Werte und ohne Einträge. Was darin steht und wie Sie sie ausschalten, steht unter „Mehr → Über diese App" bei „Meldung an ${BETREIBER}".</p>
      <p>Das heißt auch: Bei einem neuen Handy, beim Löschen der Browserdaten oder wenn der Browser aufräumt, sind die Daten weg. Deshalb ab und zu unter „Mehr → Sicherung" eine Sicherungsdatei speichern.</p>
      <h2>Erinnern</h2>
      <p>Die App kann sich nicht von selbst melden, wenn sie geschlossen ist. Zuverlässig erinnert der Kalender oder Wecker des Handys – die Kalenderdatei dafür gibt es unter „Mehr → Erinnerung".</p>`,
  },
];

export function kapitel(id) {
  return KAPITEL.find((k) => k.id === id) || null;
}

/*
 * Der Giftnotruf in den Kapiteln „Wann anrufen, wann 112" und „Tablette
 * vergessen?": die Nummer fürs eingetragene Bundesland als Knopf. Vorher
 * stand dort nur „zum Beispiel Berlin 030 19240" – wer in Bayern wohnt, las
 * die falsche Nummer (B67). Ohne Bundesland: 112 (RW1 P5) – der Knopf steht
 * im Kapitel selbst. „Bundesland eintragen" trägt data-param="bundesland",
 * damit js/app.js zur Auswahl scrollt statt an den Anfang der langen Seite
 * „Über mich" (Runde 4: E8).
 */
function giftnotrufAbsatz(stand) {
  const land = stand ? sp.BUNDESLAENDER.find(([k]) => k === stand.profil.bundesland) : null;
  if (!land) {
    return '<p>Ohne eingetragenes Bundesland kennt die App Ihre Giftnotruf-Nummer nicht – dann rufen Sie 112 an. Tragen Sie unter „Über mich" Ihr Bundesland ein, dann steht die Nummer hier und oben auf „Heute". <button type="button" class="knopf-link" data-act="seite" data-seite="profil" data-param="bundesland">Bundesland eintragen</button></p>';
  }
  const nummer = land[2];
  return `<p>Für ${esc(land[1])}: <strong>${esc(nummer)}</strong>.</p>
      <p><a class="knopf knopf-breit knopf-anruf" href="tel:${esc(nummer.replace(/[^\d+]/g, ''))}">Giftnotruf ${esc(nummer)} anrufen</a></p>`;
}

/** Das HTML eines Kapitels – mit dem, was vom eingetragenen Stand abhängt. */
export function kapitelHtml(k, stand) {
  return k.html.replace('<!--giftnotruf-->', giftnotrufAbsatz(stand));
}
