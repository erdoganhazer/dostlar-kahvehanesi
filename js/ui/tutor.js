// Yönerge (eğitici): sıra insandayken önerilen hamleyi ve nedenini, hamleden sonra da kısa değerlendirmeyi üretir.
// Öneri, botların kullandığı sezgisel puandan (game.rateMove) gelir; açıklama metinleri oyuna özeldir (aşağıda).
// Yeni oyun eklerken: EXPLAIN ve LABEL tablolarına oyunun satırını ekle (yoksa genel metin kullanılır).
import { SUIT_SYMBOL, RANK_LABEL, SUIT_NAME_TR, RANK_NAME_TR } from '../core/cards.js';
import { defaultMoveKey } from '../core/game-api.js';
import { kingWinProb, kingCardPen, GAME_NAMES, SUIT_TR } from '../games/king.js';
import { estimateTricks, beats as batakBeats } from '../games/batak.js';
import { value as bjValue } from '../games/blackjack.js';
import { equity as pokerEquity } from '../games/poker.js';
import { lieProb } from '../games/blof.js';
import { captureOf } from '../games/fanti.js';
import { solve as gSolve, bestDiscard as gBest } from '../games/gin.js';
import { SOL_LABEL, SOL_EXPLAIN } from './sol-tutor.js';
import { solve as kSolve, finishWith as kFinish, bestDiscard, isJoker, cardPen as kPen } from '../games/konken.js';

const rk = (c) => parseInt(c.slice(1), 10);
// Kart adı yazıyla: "Sinek 2", "Kupa As" (yönerge konuşur gibi söyler)
export const cardText = (c) => (c[0] === 'J' && rk(c) === 0 ? 'Joker' : `${SUIT_NAME_TR[c[0]]} ${RANK_NAME_TR[rk(c)] ?? rk(c)}`);
const RN = { 14: 'as', 13: 'papaz', 12: 'kız', 11: 'vale' };
const rname = (r) => RN[r] || String(r);
/** "A, B ve C" */
const andList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} ve ${a[a.length - 1]}`);

// ---- Hamlenin kısa adı ----
const LABEL = {
  king: (v, m) => (m.t === 'ann' ? `${GAME_NAMES[m.g]}${m.g === 'koz' ? ` ${SUIT_NAME_TR[m.trump]}` : ''} söyle` : `${cardText(m.c)} oyna`),
  batak: (v, m) => (m.t === 'bid' ? (m.v ? `${m.v} de` : 'Pas de') : m.t === 'trump' ? `Koz ${SUIT_NAME_TR[m.s]} seç` : `${cardText(m.c)} oyna`),
  pisti: (v, m) => `${cardText(m.c)} at`,
  fanti: (v, m) => (m.take?.length ? `${cardText(m.c)} at, ${andList(m.take.map(cardText))} al` : `${cardText(m.c)} at`),
  papazkacti: (v, m) => `${m.i + 1}. kartı çek`,
  esek: (v, m) => (m.t === 'tap' ? 'Hemen DOKUN' : `${cardText(m.c)} ver`),
  blackjack: (v, m) => ({ bet: `Bahis ${m.v}`, hit: 'Kart çek', stand: 'Dur', double: 'Katla' }[m.t]),
  blof: (v, m) => (m.t === 'play' ? `${m.cards.length} kart at (${m.cards.map(cardText).join(' ')})` : m.t === 'call' ? '"Yalan!" de' : 'İnan'),
  poker: (v, m) => ({ fold: 'Pas', check: 'Kontrol', call: 'Gör', raise: m.to === v.bets[v.seat] + v.chips[v.seat] ? `All-in ${m.to}` : `Yükselt ${m.to}` }[m.t]),
  altmisalti: (v, m) => (m.t === 'close' ? 'Desteyi kapat' : m.t === 'swap9' ? 'Koz 9 ile açık kozu değiştir' : `${cardText(m.c)} oyna`),
  yanik: (v, m) => ({ rebuy: `Tekrar gir (${v.entry ? v.entry[v.seat] * 2 : ''})`, quit: 'Çekil', draw: m.from === 'deck' ? 'Desteden çek' : `Yandan ${v.pileTop ? cardText(v.pileTop) : 'kart'} al`, open: m.mode === 'cift' ? 'Çift aç' : 'Yere aç (per)', lay: 'Yeni per aç', add: `${m.c ? cardText(m.c) : ''} işle`, swap: `${m.c ? cardText(m.c) : ''} koyup jokeri al`, discard: `${m.c ? cardText(m.c) : ''} at` }[m.t]),
  gin: (v, m) => ({ take: `Açık kartı al (${v.pileTop ? cardText(v.pileTop) : ''})`, pass: 'Pas de', draw: m.from === 'deck' ? 'Desteden çek' : `Yerden al (${v.pileTop ? cardText(v.pileTop) : ''})`, discard: `${m.c ? cardText(m.c) : ''} at`, knock: `${m.c ? cardText(m.c) : ''} atıp kapı de` }[m.t]),
  konken: (v, m) => (m.t === 'draw' ? (m.from === 'deck' ? 'Desteden çek' : `Yerden ${cardText(v.pileTop)} al`) : `${cardText(m.c)} at`),
};

// ---- Neden? ----
const EXPLAIN = {
  king(v, m) {
    if (m.t === 'ann') return m.g === 'koz' ? `Elinde ${SUIT_TR[m.trump].toLowerCase()} uzun ve büyük; koz bu renk olursa çok el alırsın.` : 'Elinle bu ceza oyununda en az puan kaybedersin.';
    const p = kingWinProb(v, m.c);
    if (v.game.g === 'koz') return p > 0.6 ? 'Bu kartla eli büyük ihtimalle alırsın (+50).' : p === 0 ? 'Bu eli alamazsın; küçük kart ver, büyükleri sonraki ellere sakla.' : 'Eli alma şansın var ama garanti değil.';
    const pen = kingCardPen(v.game.g, m.c);
    if (p === 0) return pen ? 'Eli sen almayacaksın: ceza kartını şimdi başkasına ver.' : 'Bu kartla eli almazsın, güvenli.';
    if (p < 0.25) return 'Bu eli zor alırsın, büyük kartı şimdi harca da sonra başına bela olmasın.';
    return 'Öbürleri daha tehlikeli, en az ceza bununla gelir.';
  },
  batak(v, m) {
    if (m.t === 'bid') {
      const est = Math.round(estimateTricks(v.hand) + 0.6);
      return m.v ? `Elin yaklaşık ${est} el alır; ${m.v} sözünü tutabilirsin.` : `Elin yaklaşık ${est} el alır; ${Math.max(5, v.high + 1)} ve üstünü tutmak zor.`;
    }
    if (m.t === 'trump') return `En çok ${SUIT_NAME_TR[m.s].toLocaleLowerCase('tr')} var elinde, büyükleri de onda. Koz o olsun.`;
    if (!v.trick.length) return rk(m.c) === 14 ? 'As ile açmak eli garanti eder.' : 'Bu renkle açmak rakipleri zorlar, kozunu sakla.';
    const lead = v.trick[0].card[0];
    const win = v.trick.every((t) => batakBeats(t.card, m.c, v.trump, lead));
    return win ? (v.trick.length === 3 ? 'Son oynuyorsun: bu kartla eli kesin alırsın.' : 'Eli alırsın; en küçük kazandıran kart bu.') : 'Bu eli alamazsın; en küçük kartını ver, büyükleri sakla.';
  },
  pisti(v, m) {
    const top = v.pile[v.pile.length - 1];
    const r = rk(m.c);
    if (top && v.pileSize && (r === rk(top) || r === 11)) {
      if (v.pileSize === 1 && r === rk(top)) return `Pişti! ${r === 11 ? '20' : '10'} puan cebinde.`;
      return `Yerdekilerin hepsi senin, ${v.pileSize} kart.`;
    }
    return 'Alacak bir şey yok. Bunu at, rakibin işine en az bu yarar; değerlileri sakla.';
  },
  fanti(v, m) {
    const take = m.take ?? captureOf(v.table, m.c);
    const r = rk(m.c);
    const sp = take.filter((c) => c === 'C2' || c === 'D10');
    const extra = sp.length ? ` (${sp.map(cardText).join(', ')} da içinde!)` : '';
    if (r === 11 && take.length) return `Valeyle süpürürsün, kız ve papaz hariç ${take.length} kart senin${extra}.`;
    if ((r === 12 || r === 13) && take.length) return `Yerdeki ${rname(r)}ı kaparsın.`;
    if (take.length) return `${[m.c, ...take].map((c) => (rk(c) === 14 ? 1 : rk(c))).join(' artı ')} on bir eder, alırsın${extra}.`;
    return 'Alacak bir şey yok. Bunu at, rakibe pek yaramaz; valeyi ve değerlileri sakla.';
  },
  papazkacti: () => 'Şans oyunu: kartlar kapalı, hangisini çektiğin fark etmez.',
  esek(v, m) {
    if (m.t === 'tap') return 'Biri dördü tamamladı, çabuk dokun yoksa eşek sen olursun!';
    const cnt = v.hand.filter((c) => rk(c) === rk(m.c)).length;
    const best = Math.max(...v.hand.map((c) => v.hand.filter((x) => rk(x) === rk(c)).length));
    return cnt === 1 ? `Bu sayıdan elinde tek kart var; vermek dörtlü topladığın sayıyı (${best} kartın var) bozmaz.` : 'En az tekrar eden sayıdan ver, çok olanı biriktir.';
  },
  blackjack(v, m) {
    if (m.t === 'bet') return 'Sabit oyna, çipin uzun gider.';
    const hand = v.hands[v.seat];
    const { total, soft } = bjValue(hand);
    const up = rk(v.dealer[0]);
    const u = up === 14 ? 11 : Math.min(10, up);
    const weak = u >= 2 && u <= 6;
    if (m.t === 'double') return `Elin ${total}${soft ? ' (as 11 sayılıyor)' : ''}; bir kart daha gelse iyi olur. Bahsi ikiye katla.`;
    if (m.t === 'stand') return total >= 17 ? `Elin ${total}: kart çekersen batma ihtimalin yüksek, dur.` : `Krupiyenin açık kartı ${u} (zayıf): krupiyenin batma ihtimali yüksek, riske girme, dur.`;
    return total <= 11 ? `Elin ${total}: kart çekmek seni batıramaz.` : `Krupiyenin açık kartı ${u}${weak ? '' : ' (güçlü)'}: ${total} ile durursan büyük ihtimalle kaybedersin, kart çek.`;
  },
  blof(v, m) {
    if (m.t === 'call' || m.t === 'pass') {
      const p = lieProb(v);
      const pct = Math.round(p * 100);
      if (m.t === 'call') return p >= 0.999 ? 'Kesin yalan: elindeki kartlarla birlikte o sayıdan 4\'ten fazla olur!' : `Yalan gibi duruyor (yüzde ${pct}). Ortada ${v.pileSize} kart var, yakalarsan hepsi onun.`;
      return `Doğru da olabilir (yalan ihtimali yüzde ${pct}). Yanılırsan ortadaki ${v.pileSize} kart sana kalır.`;
    }
    const claim = v.next;
    const t = m.cards.filter((c) => rk(c) === claim).length;
    const lies = m.cards.length - t;
    if (!lies) return `Hepsi gerçekten ${rname(claim)}. "Yalan" diyen ortadakileri toplar.`;
    if (!t) return `Elinde ${rname(claim)} yok, blöf şart. Az at, belli olmasın.`;
    return `${t} tanesi gerçekten ${rname(claim)}, ${lies} tanesi blöf. Elin çabuk erir ama yakalanabilirsin.`;
  },
  poker(v, m) {
    const E = pokerEquity(v);
    const pct = Math.round(E * 100);
    const toCall = Math.min(v.cur - v.bets[v.seat], v.chips[v.seat]);
    const odds = toCall ? Math.round((toCall / (v.pot + toCall)) * 100) : 0;
    if (m.t === 'fold') return `Kazanma şansın yüzde ${pct} civarı, görmek için ortanın yüzde ${odds}'ini koyacaksın. Değmez, çekil.`;
    if (m.t === 'call') return `Kazanma şansın yüzde ${pct} civarı, görmek ucuz. Gör.`;
    if (m.t === 'check') return `Şansın yüzde ${pct} civarı. Para koymadan bir kart daha gör.`;
    return `Elin güçlü, şansın yüzde ${pct} civarı. Ortayı büyüt.`;
  },
  altmisalti(v, m) {
    if (m.t === 'swap9') return 'Koz dokuzunu ver, açıktaki kozu al. Bedava güç.';
    if (m.t === 'close') return `${v.myPts} puandasın, elin de güçlü. Kapat, rakip artık renk vermek zorunda.`;
    const c = m.c;
    const r = rk(c);
    const VAL = { 9: 0, 10: 10, 11: 2, 12: 3, 13: 4, 14: 11 };
    if (!v.trick.length) {
      if ((r === 12 || r === 13) && v.hand.includes(c[0] + (r === 12 ? 13 : 12))) return `Kız papaz sende, evlilik: ${c[0] === v.trump ? 40 : 20} puan${v.tricks[0] ? '' : ' (bir el alınca yazılır)'}.`;
      return c[0] === v.trump ? 'Koz çıkıp rakibin kozunu eritirsin.' : 'Değeri düşük kart çık; asları, 10\'ları ve kozları sonraya sakla.';
    }
    const lead = v.trick[0].card;
    const P = { 9: 0, 11: 1, 12: 2, 13: 3, 10: 4, 14: 5 };
    const win = lead[0] === c[0] ? P[r] > P[rk(lead)] : c[0] === v.trump;
    const pot = VAL[rk(lead)] + VAL[r];
    if (win) return `Bu el senin, ${pot} puan.`;
    return `Bu eli bırak, en az değerli kartını ver.`;
  },
  yanik(v, m) {
    if (m.t === 'rebuy' || m.t === 'quit') {
      const cost = v.entry[v.seat] * 2;
      const share = Math.round(v.pot / Math.max(1, v.out.filter((o) => !o).length));
      return m.t === 'rebuy' ? `Çanakta ${v.pot} var (kişi başı ~${share}); ${cost} paranın küçük bir kısmı, devam etmek değer.` : `Tekrar girmek ${cost}, paranın ${v.money[v.seat]} büyük kısmı; çekilip kalanı korumak daha akıllıca.`;
    }
    if (m.t === 'draw') return m.from === 'pile' ? 'Yandaki kart elindeki bir peri tamamlıyor ya da büyütüyor.' : 'Yandaki kart işine yaramıyor; desteden şansını dene.';
    if (m.t === 'open') return m.mode === 'cift' ? 'Dört çiftin var; açarsan elindeki cezayı düşürürsün ama el sonunda kalanlar 2 kat yazılır.' : 'İki perin hazır: açarsan elindeki ceza düşer ve yerdeki perlere işleyebilirsin.';
    if (m.t === 'lay') return 'Elinde per oldu, aç da cezan düşsün.';
    if (m.t === 'add') return `Bunu yerdeki pere işle, cezan ${rk(m.c) >= 10 ? 10 : rk(m.c)} azalır.`;
    if (m.t === 'swap') return 'Jokeri al, her işe yarar.';
    if (v.hand.length === 1) return 'Son kartı at, bitti!';
    return 'Bu kart hiçbir işine yaramıyor, at gitsin.';
  },
  gin(v, m) {
    if (m.t === 'pass' || (m.t === 'draw' && m.from === 'deck')) {
      return v.pileTop && !v.forceDeck ? `Yerdeki ${cardText(v.pileTop)} hiçbir pere girmiyor; almak rakibe elini de gösterir.` : 'Desteden çek.';
    }
    if (m.t === 'take' || m.t === 'draw') {
      const b = gBest([...v.hand, v.pileTop], v.pileTop, v);
      return `${cardText(v.pileTop)} perine oturuyor, al.`;
    }
    const after = gSolve(v.hand.filter((x) => x !== m.c)).dead;
    if (m.t === 'knock') return after === 0 ? 'Hiç dağınığın kalmıyor: GIN! Rakibin cezası + 25 senin.' : `Dağınığın ${after}; erken kapı rakibi hazırlıksız yakalar. Alt kesilme riski düşük.`;
    const opp = v.taken?.[1 - v.seat] || [];
    const safe = !opp.some((x) => x.slice(1) === m.c.slice(1) || (x[0] === m.c[0] && Math.abs(parseInt(x.slice(1), 10) - parseInt(m.c.slice(1), 10)) <= 2));
    return `Perlerini bozmuyor${safe ? '' : ', ama rakip buna yakın kartlar topluyor, dikkat'}.${after <= 10 && after > 0 ? ' Kapı da diyebilirsin.' : ''}`;
  },
  konken(v, m) {
    if (m.t === 'draw') {
      const now = kSolve(v.hand).dead;
      if (m.from === 'pile') {
        const b = bestDiscard([...v.hand, v.pileTop], v.opts, v.pileTop);
        if (b.finish) return `Yerdeki ${cardText(v.pileTop)} elini tamamlıyor! Al, ${cardText(b.c)} atıp bit.`;
        return isJoker(v.pileTop) ? 'Joker her kartın yerine geçer, mutlaka al.' : `Yerdeki ${cardText(v.pileTop)} açıkta kalan cezanı ${now}'den ${b.dead}'e düşürür.`;
      }
      return v.pileTop ? `Yerdeki ${cardText(v.pileTop)} elini iyileştirmiyor; desteden şansını dene.` : 'Yerde kart yok, desteden çek.';
    }
    const fin = kFinish(v.hand, m.c, v.opts);
    if (fin) return fin.mult > 1 ? `${cardText(m.c)} atıp bitersin — cezalar ${fin.mult} kat!` : `${cardText(m.c)} atınca elin tamam: bitersin!`;
    const after = kSolve(v.hand.filter((x) => x !== m.c));
    return `Perlerini bozmuyor${kPen(m.c) >= 10 ? ', hem de ağır kartı elden çıkarırsın' : ''}.`;
  },
};

/**
 * Öneri: { best, ratings: Map(key → puan), label, text }. Oyunun rateMove'u yoksa ya da tek hamle varsa null.
 */
export function advise(game, view, moves, seat = 0) {
  if (!moves.length || !game.rateMove) return null;
  const key = game.moveKey || defaultMoveKey;
  const ctx = { risk: 0.5, memory: { events: [] }, seat };
  const ratings = new Map();
  let best = moves[0];
  let bv = -Infinity;
  for (const m of moves) {
    const r = game.rateMove(view, m, ctx);
    ratings.set(key(m), r);
    if (r > bv) {
      bv = r;
      best = m;
    }
  }
  const spread = bv - Math.min(...ratings.values());
  const label = (LABEL[game.id] || (() => 'Öneri'))(view, best);
  const text = EXPLAIN[game.id]?.(view, best) ?? '';
  return { best, bestR: bv, spread, ratings, label, text, view, key, game, only: moves.length === 1 };
}

Object.assign(LABEL, SOL_LABEL);
Object.assign(EXPLAIN, SOL_EXPLAIN);

/** Hamleden sonra kısa değerlendirme */
export function review(adv, move) {
  if (!adv) return null;
  const k = adv.key(move);
  const r = adv.ratings.get(k);
  if (r == null) return null;
  const tol = Math.max(1e-6, adv.spread * 0.08);
  if (k === adv.key(adv.best) || r >= adv.bestR - tol) return { good: true, text: adv.only ? 'Tek seçeneğin buydu.' : `İyi hamle. ${EXPLAIN[adv.game.id]?.(adv.view, move) ?? ''}`.trim() };
  return { good: false, text: `Daha iyisi: ${adv.label}. ${adv.text}`.trim() };
}
