'use strict';

/**
 * VAKT: DEN GROENE MARKERINGA I «ÉN KRONE BRUKT PÅ» SKAL FOELGJE TALA.
 *
 *     node tester/bilAltMarkering.test.js
 *
 * Ingen avhengigheiter, ingen package.json. Exit 0 = groen, 1 = raud.
 *
 * ### Kvifor ho finst
 *
 * `class="best"` stod HARDKODA paa fellesgjeld-rada til 31.08.2026. I
 * normaltilfellet gjorde det at verktoeyet peikte ut 5,50 % som betre enn
 * 8,40 % paa nabolinja — taparen som vinnar.
 *
 * Ei markering som berre er testa i éi retning er den same feilen om igjen:
 * ein hardkoda «best» ville bestaatt ein test som berre sjekkar at fellesgjeld
 * er groen. Difor snur denne fila tala og krev at markeringa FLYTTAR SEG.
 *
 * ### Korleis ho les produksjonskoden
 *
 * `radar.html` er éi fil med ein `<script>` paa 1100 linjer som festar
 * hendingar paa titals element ved lasting. Aa koeyre heile den i node ville
 * kravd ein DOM-stubb som er stoerre enn det ho testar, og som sjoelv kan ta
 * feil.
 *
 * I staden blir blokka mellom to ANKERKOMMENTARAR henta ut og koeyrd som ho
 * staar. Ankera er eintydige strengar, ikkje eit soek etter «funksjonen som
 * byrjar med bilAlt» — eit uttrekk utan anker som stille les feil blokk er
 * husregel 19 sin fail-open (jf. `substringAfter` i entityTypesVokter).
 * Forsvinn eit anker, STOPPAR fila med ei melding; ho blir ikkje groen paa
 * tom kjeldekode.
 *
 * `pst` og `pstN` blir henta ut paa same maate, frae dei ekte definisjonane, saa
 * testen formaterer tal med produksjonen sin kode og ikkje sin eigen kopi.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FIL = path.join(__dirname, '..', 'radar.html');
const kilde = fs.readFileSync(FIL, 'utf8');

let feil = 0;
const sjekk = (namn, fekk, venta) => {
  const ok = String(fekk) === String(venta);
  if (!ok) feil += 1;
  console.log(`  ${ok ? 'ok  ' : 'RAUD'}  ${namn}`);
  if (!ok) console.log(`          venta: ${venta}\n          fekk:  ${fekk}`);
};

/** Hent ut ein blokk mellom to eintydige anker. Fail closed. */
function mellom(start, slutt) {
  const a = kilde.indexOf(start);
  const b = kilde.indexOf(slutt);
  if (a < 0 || b < 0 || b <= a) {
    console.error(`STOPP: fann ikkje ankeret «${a < 0 ? start : slutt}» i radar.html.`);
    console.error('Blokka er flytta eller ankera er fjerna. Testen kan ikkje maale noko,');
    console.error('og skal da seie frae — ikkje bestaa paa tom kjeldekode.');
    process.exit(1);
  }
  return kilde.slice(a, b);
}

/** Éi linje, henta paa namn. `const pst=…;` — ankeret er namnet og linjeslutten. */
function eiLinje(namn) {
  const m = kilde.match(new RegExp(`^const ${namn}=.*$`, 'm'));
  if (!m) { console.error(`STOPP: fann ikkje definisjonen av ${namn}.`); process.exit(1); }
  return m[0];
}

const boks = { console };
vm.createContext(boks);
vm.runInContext(
  eiLinje('pst') + '\n' + eiLinje('pstN') + '\n'
  + mellom('/* ═════ vakt-anker: bilAlt start', '/* ═════ vakt-anker: bilAlt slutt'),
  boks,
);

/** Kva rad (0-indeksert, utan hovudraden) ber class="best"? -1 = ingen. */
function merktRad(o) {
  const html = boks.bilAltTabellHtml(Object.assign(
    { fg: 5.5, eff: 8.4, fradrag: false, arv: '', geb: '', minilaan: '', bank: '' }, o));
  const rader = html.split('<tr').slice(2); // [0] er tomt, [1] er hovudraden
  const i = rader.findIndex((r) => r.startsWith(' class="best"'));
  return { rad: i, tal: rader.length, html };
}

const RENTEFRITT = 0, GJELD_FRAA_FOER = 1, BILLAAN = 2, BANK = 3;

console.log('\nBIL-ALT-TABELLEN: markeringa skal foelgje tala\n');

// ── Fail closed: fann vi i det heile tatt fire rader? ───────────────────────
sjekk('POSITIV KONTROLL: tabellen har fire rader', merktRad({}).tal, 4);
sjekk('POSITIV KONTROLL: funksjonane finst',
  typeof boks.bilAltVinnar + ',' + typeof boks.bilAltTabellHtml, 'function,function');

// ── Begge vegar. Dette er heile poenget. ───────────────────────────────────
sjekk('NORMALTILFELLET (fg 5,5 / eff 8,4): billaanet er best',
  merktRad({}).rad, BILLAAN);
sjekk('SNUDD (fg 12,0 / eff 8,4): markeringa flyttar seg til gjeld frae foer',
  merktRad({ fg: 12.0, eff: 8.4 }).rad, GJELD_FRAA_FOER);
sjekk('SNUDD TILBAKE (fg 5,5 / eff 20,0): og tilbake igjen',
  merktRad({ fg: 5.5, eff: 20.0 }).rad, BILLAAN);

// ── Den synlege kolonna er den som gjeld, ikkje den nominelle ──────────────
// Med fradrag blir begge tala 0,78x, saa rekkefoelgja held. Kontrollen er at
// markeringa ikkje hoppar naar haken blir sett — og at ho framleis er rekna.
sjekk('MED FRADRAG: same vinnar, fordi 0,78 gjeld begge',
  merktRad({ fradrag: true }).rad, BILLAAN);
sjekk('MED FRADRAG: og tala i kolonna ER dei etter skatt',
  /<td>4,29 %<\/td>/.test(merktRad({ fradrag: true }).html), true);

// ── Grensetilfelle 1: eff = null ───────────────────────────────────────────
sjekk('eff = null: rada kan ikkje vinne …',
  merktRad({ eff: null }).rad !== BILLAAN, true);
sjekk('… men ho hindrar ikkje at nokon andre gjer det',
  merktRad({ eff: null }).rad, GJELD_FRAA_FOER);

// ── Grensetilfelle 2: eff > 100 ────────────────────────────────────────────
sjekk('eff = 250 (absurd): INGEN rad blir merkt',
  merktRad({ eff: 250 }).rad, -1);
sjekk('eff = 100,0 er ikkje over grensa — han vinn framleis',
  merktRad({ eff: 100 }).rad, BILLAAN);
sjekk('eff = 100,1 er over — heile tabellen mistar markeringa',
  merktRad({ eff: 100.1 }).rad, -1);

// ── Rentefri rad kan aldri vinne ───────────────────────────────────────────
// Fyrste utkastet av denne testen kravde -1 for {fg:0, eff:null} og var raud.
// Testen tok feil, ikkje koden: har du inga gjeld til nokon rente, ER
// bankinnskudd den beste bruken av krona. Ho krev no det ho skulle ha kravd.
sjekk('fg 0 og eff null: bankinnskudd er det einaste som gir noko, og vinn',
  merktRad({ fg: 0, eff: null }).rad, BANK);
sjekk('den rentefrie rada vinn ALDRI — heller ikkje naar ho er den einaste med tal',
  boks.bilAltVinnar([
    { verdi: 0, tak: 0, utanfor: false },
    { verdi: null, tak: null, utanfor: false },
  ]), -1);
sjekk('… og heller ikkje ei negativ rad',
  boks.bilAltVinnar([{ verdi: -2, tak: -2, utanfor: false }]), -1);

// ── Spennet: bankinnskudd er 3,00–4,00, ikkje eit tal ──────────────────────
sjekk('fg 3,50 slaar ikkje eit spenn som gaar til 4,00 — ingen vinnar',
  merktRad({ fg: 3.5, eff: null }).rad, -1);
sjekk('fg 4,01 slaar taket i spennet — og vinn',
  merktRad({ fg: 4.01, eff: null }).rad, GJELD_FRAA_FOER);
sjekk('bankinnskudd kan vinne naar sjoelv den LAVE enden slaar alt',
  merktRad({ fg: 2.0, eff: null }).rad, BANK);

// ── Uavgjort skal ikkje bli ei gjetting ────────────────────────────────────
sjekk('fg = eff: ingen av dei slaar den andre, saa ingen blir merkt',
  merktRad({ fg: 8.4, eff: 8.4 }).rad, -1);

// ── Kjeldekontroll: er funksjonen faktisk kopla til? ───────────────────────
console.log('\nKJELDEKONTROLL — vakta over testar logikken; desse testar leidningane\n');
sjekk('bilTegnValg kallar bilAltTabellHtml',
  /\$\('bilAltTabell'\)\.innerHTML=bilAltTabellHtml\(/.test(kilde), true);
sjekk('ingen hardkoda class="best" er att i radar.html',
  (kilde.match(/<tr class="best">/g) || []).length, 0);
sjekk('den einaste «best» som blir skriven, er den rekna',
  (kilde.match(/class="best"/g) || []).length, 2); // CSS-regelen + det rekna uttrykket
sjekk('rentestigen si referanserad har sin eigen klasse',
  /<tr class="ref">/.test(kilde), true);
// Kravet er «ingen SYNLEG tekst skal seie fellesgjeld» — ikkje at ordet er
// utrydda. Éin doedoemekommentar i bilAlt-blokka fortel at markeringa ein gong
// stod hardkoda paa fellesgjeld-rada, og den setninga er historikken over
// nettopp denne feilen. Difor maaler desse to det brukaren ser: markupen i
// bil-delen, og tabellen slik han faktisk blir skriven.
sjekk('«fellesgjeld» finst ikkje i bil-markupen',
  /fellesgjeld/i.test(kilde.slice(kilde.indexOf('<h2 id="bil">'), kilde.indexOf('<script>'))), false);
sjekk('«fellesgjeld» finst ikkje i tabellen som blir teikna',
  /fellesgjeld/i.test(merktRad({}).html), false);
sjekk('bustaddelen har ordet i behald — der er han rett',
  /fellesgjeld/i.test(kilde.slice(kilde.indexOf('/* ═════════ 2 · maler'),
    kilde.indexOf('/* ═════════ 10 · oppstart'))), true);

console.log(`\n${feil === 0 ? 'ALT GROENT.' : `${feil} RAUDE.`}\n`);
process.exit(feil === 0 ? 0 : 1);
