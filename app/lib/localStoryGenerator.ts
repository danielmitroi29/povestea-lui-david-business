// ── Generator local de povești pentru copii de 3 ani ────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} și ${names[1]}`;
  return names.slice(0, -1).join(", ") + " și " + names[names.length - 1];
}

// ── Template helpers ─────────────────────────────────────────────────────────

const ADJECTIVE_COPIL  = ["vesel", "curajos", "bun", "curios", "isteț"];
const ADJECTIVE_COPILA = ["veselă", "curajoasă", "bună", "curioasă", "isteață"];

const ANIMALE_PRIETENE = [
  { num: "un ursuleț", drag: "ursulețul", mic: "ursulețule" },
  { num: "un iepuraș", drag: "iepurașul", mic: "iepurașule" },
  { num: "o rățuscă", drag: "rățusca", mic: "rățuscă" },
  { num: "un pisoi", drag: "pisoiul", mic: "pisoiule" },
  { num: "un cățeluș", drag: "cățelușul", mic: "cățelușule" },
];

const PROBLEME_SIMPLE = [
  { text: "mingea lui a sărit în apă", fix: "mingea" },
  { text: "nu găsea jucăria preferată", fix: "jucăria" },
  { text: "s-a împiedicat și a căzut", fix: "el" },
  { text: "era singur și trist", fix: "prietenul" },
  { text: "florile lui se ofiliseră", fix: "florile" },
];

const SOLUTII_SINGULAR = [
  (hero: string, fix: string) => `${hero} a luat un băț lung și a scos ${fix} din apă.`,
  (hero: string, fix: string) => `${hero} a căutat peste tot și a găsit ${fix} după copac.`,
  (hero: string) => `${hero} l-a ajutat să se ridice și i-a suflat pe genunchi.`,
  (hero: string) => `${hero} s-a așezat lângă el și i-a spus: — Sunt aici cu tine!`,
  (hero: string, fix: string) => `${hero} a udat ${fix} cu grijă și ele au înflorit din nou.`,
];
const SOLUTII_PLURAL = [
  (allNames: string, fix: string) => `${allNames} au luat un băț lung și au scos ${fix} din apă.`,
  (allNames: string, fix: string) => `${allNames} au căutat peste tot și au găsit ${fix}.`,
  (allNames: string) => `${allNames} l-au ajutat să se ridice și i-au suflat pe genunchi.`,
  (allNames: string) => `${allNames} s-au așezat lângă el și au spus: — Suntem aici cu tine!`,
  (allNames: string, fix: string) => `${allNames} au udat ${fix} cu grijă și ele au înflorit din nou.`,
];

const LOCURI_SIMPLE = ["pădure", "parc", "grădină", "câmp cu flori", "deal verde"];
const MORALE = [
  "Când ajuți un prieten, inima ta devine mai mare!",
  "Un prieten bun ajută mereu!",
  "Împreună e mai ușor și mai frumos!",
  "Să ajuți este cel mai frumos lucru din lume!",
  "Un zâmbet mic poate face o zi mare!",
];

function isFeminine(name: string): boolean {
  const endings = ["a", "ea", "ia", "ița"];
  const lname = name.trim().toLowerCase();
  return endings.some((s) => lname.endsWith(s));
}

function genderAdjective(name: string): string {
  return isFeminine(name) ? pick(ADJECTIVE_COPILA) : pick(ADJECTIVE_COPIL);
}

// ── Poveste originală ─────────────────────────────────────────────────────────

function generateOriginal(names: string[], customPrompt: string): string {
  const hero     = names[0];
  const allNames = joinNames(names);
  const plural   = names.length > 1;
  const fem      = isFeminine(hero);
  const adj      = genderAdjective(hero);
  const loc      = pick(LOCURI_SIMPLE);
  const animal   = pick(ANIMALE_PRIETENE);
  const problema = pick(PROBLEME_SIMPLE);
  const morala   = pick(MORALE);
  const idx      = PROBLEME_SIMPLE.indexOf(problema);

  const solutieText = plural
    ? SOLUTII_PLURAL[idx]?.(allNames, problema.fix) ?? `${allNames} au ajutat împreună.`
    : SOLUTII_SINGULAR[idx]?.(hero, problema.fix) ?? `${hero} a ajutat.`;

  const temaLine = customPrompt.trim()
    ? `\n${hero} ${fem ? "știa" : "știa"} ceva special: ${customPrompt.trim()}${customPrompt.trim().endsWith(".") ? "" : "."}\n`
    : "";

  return `A fost odată ${fem ? "o fetiță" : "un băiețel"} pe nume ${hero}.
${hero} era ${adj} și bun${fem ? "ă" : ""} la suflet.
${fem ? "Îi" : "Îi"} plăcea să se joace în ${loc}.
${temaLine}
Într-o dimineață, soarele era mare și galben.
${plural
  ? `${hero} și prietenii ${fem ? "ei" : "lui"} — ${names.slice(1).join(" și ")} — au pornit la plimbare.`
  : `${hero} a luat tolbița ${fem ? "ei" : "lui"} mică și a pornit la drum.`}

Hop, hop, hop — ${plural ? "mergeau" : "mergea"} pe cărare.
Pas cu pas, printre flori și fluturi.

Deodată, ${plural ? "au văzut" : "a văzut"} ${animal.num} mic.
${animal.drag.charAt(0).toUpperCase() + animal.drag.slice(1)} stătea singur și plângea:
— Bau, bau, bau! ${problema.text.charAt(0).toUpperCase() + problema.text.slice(1)}! Bau!

${hero} s-a apropiat ușor.
— Ce s-a întâmplat, ${animal.mic}?
— ${problema.text.charAt(0).toUpperCase() + problema.text.slice(1)}! Nu știu ce să fac...

${plural ? `${allNames} s-au uitat` : `${hero} s-a uitat`} cu atenție.
— Noi te ajutăm! ${plural ? "au spus" : "a spus"} ${plural ? allNames : hero}.

${solutieText}

${animal.drag.charAt(0).toUpperCase() + animal.drag.slice(1)} a sărit de bucurie.
Bum! Bum! Bum!
${plural ? `I-a îmbrățișat pe toți.` : `${fem ? "A îmbrățișat-o" : "L-a îmbrățișat"} pe ${hero} strâns.`}

— Mulțumesc! Ești${plural ? "i" : ""} prietenul${plural ? "ii" : ""} mei${plural ? " cei mai buni" : " meu cel mai bun"}!
— Cu drag! ${plural ? "au zâmbit" : `a zâmbit ${hero}`}.

Au jucat împreună toată ziua.
Au mâncat frăguțe roșii și dulci.
A fost o zi minunată!

Seara, ${plural ? `${allNames} s-au întors acasă.` : `${hero} s-a întors acasă.`}
Mama ${plural ? "i-a strâns pe toți în brațe" : `${fem ? "a strâns-o" : "l-a strâns"} în brațe`}.
— Bine ${plural ? "ați venit" : "ai venit"}, puișor${plural ? "ilor" : ""}! Mi-a fost dor!

${plural ? `${allNames} au adormit fericiți.` : `${hero} a adormit ${fem ? "fericită" : "fericit"}.`}
Visa${plural ? "u" : ""} la ${animal.drag} și la ziua cea frumoasă.

Morala: ${morala} 🌙✨`;
}

// ── Cei Trei Purceluși ────────────────────────────────────────────────────────

function generateCei3Purcelusi(names: string[], customPrompt: string): string {
  const [n1, n2, n3] = [...names, "Ionel", "Măriuca", "Gigel"];
  const temaLine = customPrompt.trim()
    ? `Știau ceva special: ${customPrompt.trim()}${customPrompt.trim().endsWith(".") ? "" : "."}\n`
    : "";

  return `A fost odată trei frățiori: ${n1}, ${n2} și ${n3}.
${temaLine}Se iubeau foarte mult.
Se jucau împreună în fiecare zi.

Într-o zi, mama lor le-a spus:
— Dragii mei, e timpul să vă faceți câte o căsuță!

${n1} era grăbit.
A făcut o căsuță din paie.
Repede-repede, gata în o oră!
— Super! a spus ${n1}. Mă duc să mă joc!

${n2} a muncit puțin mai mult.
A făcut o căsuță din scânduri de lemn.
— Gata! a spus ${n2}. A mea e mai tare!

${n3} a muncit mult, mult de tot.
A pus cărămidă după cărămidă.
A bătut cuie. A ridicat pereți.
— A mea va fi cea mai tare! a spus ${n3}.

Deodată a venit Lupul cel Mare.
A suflat spre casa de paie:
— Huf! Puf! Suflu casa în praf!

Buf! Casa de paie a căzut.
${n1} a fugit la ${n2}.

Lupul a suflat din nou:
— Huf! Puf! Suflu casa în praf!

Buf! Casa de lemn a căzut.
${n1} și ${n2} au fugit la ${n3}.

Lupul a suflat cu toată puterea:
— HUF! PUF! Suflu casa în praf!

Dar casa de cărămidă... stătea dreaptă!
Nu s-a clintit deloc!

Lupul a suflat iar. Și iar. Și iar.
Tot nimic!
A plecat supărat.

— Ura! Ura! Ura! au strigat cei trei.
S-au îmbrățișat strâns.
Au mâncat tort cu vișine.
A fost tare bine!

Morala: Când muncești cu drag, faci lucruri trainice! 🐷🏠✨`;
}

// ── Alba ca Zăpada ────────────────────────────────────────────────────────────

function generateAlbaZapada(names: string[], customPrompt: string): string {
  const hero = names[0];
  const fem  = isFeminine(hero);
  const temaLine = customPrompt.trim()
    ? `${hero} ${fem ? "știa" : "știa"} ceva special: ${customPrompt.trim()}${customPrompt.trim().endsWith(".") ? "" : "."}\n`
    : "";

  return `A fost odată ${fem ? "o fetiță" : "un băiețel"} pe nume ${hero}.
${hero} avea pielea albă ca zăpada și obrajii roz ca trandafirul.
${hero} era bun${fem ? "ă" : ""} și vesel${fem ? "ă" : ""} mereu.
${temaLine}
Dar o vrăjitoare rea era supărată pe ${hero}.
De ce? Pentru că ${hero} era prea vesel${fem ? "ă" : ""} și bun${fem ? "ă" : ""}.

Într-o zi, ${hero} a plecat în pădure.
A mers adânc, adânc printre copaci.

Deodată! O căsuță mică!
Cu flori la fereastră și fum din coș.

${hero} a bătut la ușă:
Toc! Toc! Toc!

Ușa s-a deschis.
Șapte pitici mici priveau uimiți:
— Bună ziua! a spus ${hero} timid${fem ? "" : "."}.
— Bine ai venit! au strigat piticii. Intră! Intră!

Piticii erau: Vesel, Harnic, Curios, Blând, Isteț, Viteaz și Zâmbitor.
S-au împrietenit imediat.

Dar vrăjitoarea cea rea a adus un măr roșu.
— Mănâncă, ${hero}! E dulce!

${hero} a mușcat din măr și... a adormit.
Bâzz... bâzz... adânc adormit${fem ? "ă" : ""}.

Piticii erau triști.
Țineau de mână.

Dar a venit un prinț bun și curajos.
${fem ? "A sărutat-o ușor pe frunte." : "L-a atins ușor pe umăr."}

${hero} a deschis ochii.
— Unde sunt? a întrebat ${hero}.
— Acasă, la noi! au strigat piticii veseli.

Toți au dansat de bucurie.
Au mâncat mere bune — nu fermecate!
Au râs toată ziua.

Morala: Prietenii buni ne protejează mereu! 🍎✨`;
}

// ── Scufița Roșie ─────────────────────────────────────────────────────────────

function generateScufitaRosie(names: string[], customPrompt: string): string {
  const hero  = names[0];
  const fem   = isFeminine(hero);
  const temaLine = customPrompt.trim()
    ? `${hero} ${fem ? "știa" : "știa"} ceva special: ${customPrompt.trim()}${customPrompt.trim().endsWith(".") ? "" : "."}\n`
    : "";

  return `A fost odată ${fem ? "o fetiță" : "un băiețel"} pe nume ${hero}.
${hero} purta mereu o scufiță roșie, frumoasă.
Cadou de la bunica sa dragă.
${temaLine}
Într-o zi, mama i-a pregătit un coș.
Înăuntru: pâine caldă, gem de căpșuni și prăjitură.
— Du-le la bunicuța, te rog! a spus mama.
— Da, mamă! a spus ${hero} vesel${fem ? "ă" : ""}.

Hop, hop, hop — mergea ${hero} prin pădure.
Pădure verde, soare printre frunze.

Deodată, a apărut un Lup Mare.
— Bună ziua! a spus lupul cu voce groasă.
— Bună ziua! a spus ${hero} politicos${fem ? "" : "."}.
— Unde mergi cu coșul acela?
— La bunicuța mea! a răspuns ${hero}.

Lupul a alergat pe drumul cel scurt.
${hero} a mers pe cărarea cea lungă.

Pe cărare, ${hero} a văzut flori frumoase.
— Una pentru bunicuța! a spus ${hero}.
A cules una roșie, una galbenă, una albastră.

Când a ajuns la căsuța bunicuții — toc, toc, toc!
— Cine-i? a întrebat o voce ciudată.
— Eu, ${hero}!

${hero} s-a uitat pe fereastră.
Acolo era lupul, deghizat!

— Fugi de acolo, lup! a strigat ${hero} tare.

Lupul s-a speriat și a fugit în pădure.
Buf! Buf! Buf! — picioare mari pe pământ.

Bunicuța a ieșit din dulap.
— Bravo, ${hero}! Ești curajos${fem ? "oasă" : ""}!

Au mâncat prăjitura împreună.
Au pus florile în vază.
A fost o zi minunată!

Morala: Când ești atent${fem ? "ă" : ""} și curajos${fem ? "oasă" : ""}, nu te temi de nimic! 🧣🌸✨`;
}

// ── Cenușăreasa ───────────────────────────────────────────────────────────────

function generateCenusareasa(names: string[], customPrompt: string): string {
  const hero = names[0];
  const fem  = isFeminine(hero);
  const temaLine = customPrompt.trim()
    ? `${hero} ${fem ? "știa" : "știa"} ceva special: ${customPrompt.trim()}${customPrompt.trim().endsWith(".") ? "" : "."}\n`
    : "";

  return `A fost odată ${fem ? "o fetiță" : "un băiețel"} pe nume ${hero}.
${hero} era bun${fem ? "ă" : ""} și harnic${fem ? "ă" : ""}.
Muncea cu drag în fiecare zi.
${temaLine}
Dar alții nu erau buni cu ${fem ? "ea" : "el"}.
Îl/${fem ? "O" : ""} puneau să facă treabă multă.

Într-o seară, ${hero} plângea lângă sobă.
— Mi-aș dori să merg și eu la bal...

Poc! A apărut o zână mică și strălucitoare.
— Nu plânge, ${hero}! a spus zâna.
— De ce ești trist${fem ? "ă" : ""}?
— Vreau să merg la bal, dar nu pot...

Zâna a zâmbit și a fluierat din bagheta ei:
— Bibbidi-bobbidi-boo!

O rochie frumoasă a apărut!
Roșie cu stele argintii!
Și niște pantofiori de cristal — clim-clim!

— Ura! a strigat ${hero} fericit${fem ? "ă" : ""}.

La bal, ${hero} a dansat cu prințul.
Pas-doi, pas-doi, pas-doi.
Era tare frumos!

Dar la miezul nopții — bum, bum, bum, bum!
— Trebuie să plec! a spus ${hero}.
Și a fugit pe scări.
Un pantofiorul a rămas jos.

Clim! — a sunat pe trepte.

Prințul a luat pantofiorul.
A căutat în tot regatul.

Când a ajuns la ${hero}:
— Este al tău?
— Da! a spus ${hero}.

Pantofiorul s-a potrivit perfect!

— Vrei să fii prietenul${fem ? "a" : ""} meu? a întrebat prințul.
— Da! a spus ${hero} fericiti${fem ? "ă" : ""}.

Au trăit fericiți pentru totdeauna.

Morala: Cine e bun și harnic, va fi răsplătit mereu! 👠✨`;
}

// ── Frumoasa Adormită ─────────────────────────────────────────────────────────

function generateFrumoasaAdormita(names: string[], customPrompt: string): string {
  const hero = names[0];
  const fem  = isFeminine(hero);
  const temaLine = customPrompt.trim()
    ? `${hero} ${fem ? "știa" : "știa"} ceva special: ${customPrompt.trim()}${customPrompt.trim().endsWith(".") ? "" : "."}\n`
    : "";

  return `A fost odată ${fem ? "o prințesă" : "un prinț"} pe nume ${hero}.
${hero} era vesel${fem ? "ă" : ""} și bun${fem ? "ă" : ""}.
Umplea palatul cu râsete și cântece.
${temaLine}
Dar o vrăjitoare rea a aruncat o vrajă:
— ${hero} va adormi adânc!

Într-o zi, ${hero} a găsit o furcă de tors.
S-a atins de ea și... zzzz!
A adormit.

Puf! — pe un pat moale de nori.

Tot castelul a adormit odată cu ${fem ? "ea" : "el"}.
Soldații — zzzz!
Bucătarul — zzzz!
Pisicuța — zzzz!

Ani mulți au trecut.
Un crâng de spini a crescut în jurul castelului.

Dar a venit un prinț curajos.
Taf! Taf! Taf! — a tăiat spinii cu sabia.
A intrat în castel.
A urcat scările.
A găsit sala mare.

Acolo dormea ${hero}, frumos${fem ? "oasă" : ""} ca o imagine.

Prințul s-a apropiat ușor.
${fem ? "A sărutat-o ușor pe frunte." : "L-a atins ușor pe umăr."}

${hero} a deschis ochii mari.
— Bună ziua! a spus ${hero} surprins${fem ? "ă" : ""}.
— Bună ziua! a zâmbit prințul.

Tot castelul s-a trezit:
Soldații — bun ziua!
Bucătarul — ați venit!
Pisicuța — miau, miau!

Toți au sărbătorit.
Tort, muzică, dans!

Morala: Iubirea și curajul înving orice! 👸🌹✨`;
}

// ── Hansel și Gretel ──────────────────────────────────────────────────────────

function generateHanselGretel(names: string[], customPrompt: string): string {
  const [n1, n2]  = [...names, "Hansel", "Gretel"];
  const temaLine  = customPrompt.trim()
    ? `Știau ceva special: ${customPrompt.trim()}${customPrompt.trim().endsWith(".") ? "" : "."}\n`
    : "";

  return `A fost odată doi frați: ${n1} și ${n2}.
${temaLine}Se iubeau foarte mult.
Mergeau mereu ținuți de mână.

Într-o zi, s-au rătăcit în pădure.
Stânga — copaci.
Dreapta — copaci.
Față — copaci.

— Ne-am rătăcit! a spus ${n1} trist.
— Nu plânge! a spus ${n2}. Mergem împreună!

Deodată — ce minune!
O căsuță din turtă dulce!

Pereți din ciocolată.
Acoperiș din acadele.
Ferestre din zahăr roz.

— Uau! au spus amândoi.

Au gustat din gard:
Hap! — ciocolată!
Hap! — acadea!
Hap! — zahăr!

Dar ușa s-a deschis:
Scârț!

O bătrânică a apărut.
— Intrați, intrați, copilași!

Dar bătrânica era o vrăjitoare rea.
Voia să îi sperie și să le ia dulciurile.

${n2} era isteată.
A văzut o oală de apă caldă pe sobă.
A aruncat apă peste vrăjitoare!

— Ah! Sunt udă! a strigat vrăjitoarea.
A fugit afară.
Buf! Buf! Buf! — picioare pe pământ.
A dispărut în pădure.

${n1} și ${n2} au luat un coș de turte dulci.
Au ieșit din căsuță.

O rățuscă albă trecea pe acolo:
— Cuac! Cuac! Vă duc eu acasă!

Hop! pe spatele rățuștii.
Pleosc! Pleosc! — prin apă.

Tata îi aștepta la marginea pădurii.
I-a strâns în brațe strâns.
— Copiii mei! Mi-a fost dor!

Au mâncat turtele dulci împreună.
Toți trei. Fericiți.

Morala: Împreună, frații se ajută mereu! 🏠🍬✨`;
}

// ── Motanul Încălțat ──────────────────────────────────────────────────────────

function generateMotanulIncaltat(names: string[], customPrompt: string): string {
  const hero  = names[0];
  const fem   = isFeminine(hero);
  const temaLine = customPrompt.trim()
    ? `${hero} ${fem ? "știa" : "știa"} ceva special: ${customPrompt.trim()}${customPrompt.trim().endsWith(".") ? "" : "."}\n`
    : "";

  return `A fost odată ${fem ? "o fetiță" : "un băiețel"} pe nume ${hero}.
${temaLine}
Bunicul ${fem ? "ei" : "lui"} i-a lăsat un dar special:
Un motan cu cizme de piele!

— Miau! a spus motanul.
${hero} s-a uitat la motan uimit${fem ? "ă" : ""}.

— Bună ziua! a spus motanul.
— Vorbești?! a spus ${hero}.
— Da! Și te ajut să fii fericit${fem ? "ă" : ""}!

Motanul era isteț și harnic.
Mergea la piață.
Aducea mâncare bună.
Îngrijea grădina.

Toți îl iubeau pe motan.
— Ce motan minunat! spuneau vecinii.

Într-o zi, a trecut regele cu trăsura.
Bum-bum-bum! Cai mari, roți mari.

Motanul a strigat:
— Majestate! ${hero} vă trimite salutări!

Regele s-a oprit.
— Cine e ${hero}?
— Cel mai bun prieten al meu! a zis motanul.

Regele a coborât.
L-a/${fem ? "a" : ""} cunoscut pe ${hero}.
— Ce copil bun ești! a spus regele.

Prințesa/${fem ? "Prințul" : "Prințesa"} a zâmbit timid${fem ? "" : "."}.
— Vrei să fii prietenul${fem ? "a" : ""} meu? a întrebat.

— Da! a spus ${hero} fericit${fem ? "ă" : ""}.

Motanul a primit cizme noi.
Roșii, cu fundițe!
Miau! Miau! — sărea de bucurie.

Morala: Un prieten loial valorează mai mult decât orice! 🐈👢✨`;
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

export function generateLocalStory(
  names: string[],
  storyType: string,
  customPrompt: string,
  aiTemplates?: Record<string, string>
): string {
  if (aiTemplates?.[storyType]) {
    return applyTemplate(aiTemplates[storyType], names);
  }

  switch (storyType) {
    case "cei-3-purcelusi":   return generateCei3Purcelusi(names, customPrompt);
    case "alba-ca-zapada":    return generateAlbaZapada(names, customPrompt);
    case "scufita-rosie":     return generateScufitaRosie(names, customPrompt);
    case "cenusareasa":       return generateCenusareasa(names, customPrompt);
    case "frumoasa-adormita": return generateFrumoasaAdormita(names, customPrompt);
    case "hansel-si-gretel":  return generateHanselGretel(names, customPrompt);
    case "motanul-incaltat":  return generateMotanulIncaltat(names, customPrompt);
    default:                  return generateOriginal(names, customPrompt);
  }
}

// ── Funcții pure pentru template-uri AI ──────────────────────────────────────

export function createTemplateFromStory(story: string, names: string[]): string {
  let template = story;
  const sorted = names
    .map((n, i) => ({ n, i }))
    .sort((a, b) => b.n.length - a.n.length);
  for (const { n, i } of sorted) {
    if (!n.trim()) continue;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re  = new RegExp(`(?<![\\p{L}\\d])${esc}(?![\\p{L}\\d])`, "gu");
    template  = template.replace(re, `{{P${i + 1}}}`);
  }
  return template;
}

export function applyTemplate(template: string, names: string[]): string {
  let result = template;
  for (let i = 0; i < 6; i++) {
    const replacement = names[i] ?? names[names.length - 1] ?? "prietenul";
    result = result.replaceAll(`{{P${i + 1}}}`, replacement);
  }
  return result;
}
