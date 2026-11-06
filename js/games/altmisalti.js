// 66 (Altmışaltı): 2 kişi, 24 kart (9, 10, J, Q, K, A). Kurallar: docs/66-KURALLARI.md
// Değerler: A 11, 10 10, K 4, Q 3, J 2, 9 0. Herkese 6 kart; sıradaki kart açılıp destenin altına konur: koz.
// Deste açıkken renk vermek zorunlu değil; deste bitince ya da kapatılınca renk vermek, yoksa kozlamak zorunlu.
// Evlilik (aynı renkten papaz+kız, elde): çıkan oyuncu birini oynayınca ilan edilir: 20, kozda 40 (ilk el alınınca yazılır).
// Koz 9'u, çıkan oyuncu en az bir el almışsa açık kozla değiştirilebilir. Çıkan oyuncu desteyi kapatabilir.
// 66'ya ulaşan eli kazanır: rakip 33+ ise 1, rakip el almış ama <33 ise 2, hiç el almamışsa 3 oyun puanı.
// Kapatıp 66'ya ulaşamayan: rakibe 2 (kapatan hiç el almamışsa 3). Deste açıkken son eli alan +10. 7 oyun puanına ilk ulaşan kazanır.
// Hamleler: { t:'play', c }, { t:'close' }, { t:'swap9' }
import { makeRng } from '../core/rng.js';

export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = [9, 10, 11, 12, 13, 14];
export const VALUE = { 9: 0, 10: 10, 11: 2, 12: 3, 13: 4, 14: 11 };
const POWER = { 9: 0, 11: 1, 12: 2, 13: 3, 10: 4, 14: 5 }; // güç sırası: 9 < J < Q < K < 10 < A
export const TARGET = 7;
export const suitOf = (c) => c[0];
export const rankOf = (c) => +c.slice(1);
export const val = (c) => VALUE[rankOf(c)];
export const sortCards = (cs) => [...cs].sort((a, b) => SUITS.indexOf(a[0]) - SUITS.indexOf(b[0]) || POWER[rankOf(b)] - POWER[rankOf(a)]);
const ALL = [];
for (const s of SUITS) for (const r of RANKS) ALL.push(s + r);

/** b, a'yı geçer mi? (a önce oynandı) */
export function beats(a, b, trump) {
  if (suitOf(a) === suitOf(b)) return POWER[rankOf(b)] > POWER[rankOf(a)];
  return suitOf(b) === trump;
}

function newDeal(s, dealNo) {
  const deck = makeRng((s.seed + dealNo * 7919) >>> 0).shuffle([...ALL]);
  const leader = dealNo % 2 === 0 ? 1 : 0; // dağıtan değişir, dağıtmayan çıkar
  const hands = [[], []];
  // 3+3 dağıtım: önce çıkan oyuncuya
  let p = 0;
  for (const k of [3, 3]) for (const seat of [leader, 1 - leader]) for (let i = 0; i < k; i++) hands[seat].push(deck[p++]);
  const trumpCard = deck[p++];
  const stock = [...deck.slice(p), trumpCard]; // son kart açık koz
  return {
    ...s, dealNo, hands: hands.map(sortCards), stock, trump: suitOf(trumpCard), trumpCard, closed: -1, closedOpp: 0,
    leader, turn: leader, trick: [], pts: [0, 0], pending: [0, 0], tricks: [0, 0], marriages: [], seen: [], lastTrick: null, dealEnd: null, phase: 'play',
  };
}

const stockOpen = (s) => s.closed < 0 && s.stock.length > 0;

function legalPlays(s, seat) {
  const hand = s.hands[seat];
  if (!s.trick.length || stockOpen(s)) return hand;
  const lead = s.trick[0].card;
  const same = hand.filter((c) => suitOf(c) === suitOf(lead));
  if (same.length) return same;
  const tr = hand.filter((c) => suitOf(c) === s.trump);
  return tr.length ? tr : hand;
}

function canSwap9(s, seat) {
  return !s.trick.length && seat === s.leader && stockOpen(s) && s.stock.length > 2 && s.tricks[seat] > 0 && s.hands[seat].includes(s.trump + '9') && rankOf(s.trumpCard) !== 9;
}
const canClose = (s, seat) => !s.trick.length && seat === s.leader && stockOpen(s) && s.stock.length > 2;

/** Elde evlilik var mı? (bu kartı çıkarken) */
export function marriageOf(hand, c, trump) {
  const r = rankOf(c);
  if (r !== 12 && r !== 13) return 0;
  const partner = suitOf(c) + (r === 12 ? 13 : 12);
  if (!hand.includes(partner)) return 0;
  return suitOf(c) === trump ? 40 : 20;
}

function finishDeal(s, winner, reason) {
  const loser = 1 - winner;
  let gp;
  if (reason === 'closeFail') gp = s.tricks[loser] === 0 ? 3 : 2; // kapatan (loser) hiç el almadıysa 3
  else if (reason === 'noone') gp = 1;
  else gp = s.tricks[loser] === 0 ? 3 : s.pts[loser] < 33 ? 2 : 1;
  const game = s.game.map((g, i) => g + (i === winner ? gp : 0));
  const dealEnd = { n: s.dealNo, winner, gp, reason, pts: [...s.pts], tricks: [...s.tricks], game };
  const base = { ...s, game, dealEnd, sheet: [...s.sheet, dealEnd] };
  if (Math.max(...game) >= s.target || s.horizon) return { ...base, phase: 'over' };
  return { ...newDeal(base, s.dealNo + 1), dealEnd, lastTrick: s.lastTrick };
}

/** 66'ya ulaşan var mı? (yalnızca en az bir el almış oyuncu) */
function check66(s) {
  for (const i of [s.turn, 1 - s.turn]) if (s.tricks[i] > 0 && s.pts[i] >= 66) return i;
  return -1;
}

const game = {
  id: 'altmisalti',
  name: '66',
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(config, rng) {
    const s = { n: 2, seed: rng.int(2 ** 31), game: [0, 0], target: config.target || TARGET, sheet: [], horizon: false };
    return newDeal(s, 0);
  },

  currentActor: (s) => s.turn,

  legalMoves(s, seat) {
    if (s.phase === 'over' || seat !== s.turn) return [];
    const out = legalPlays(s, seat).map((c) => ({ t: 'play', c }));
    if (canSwap9(s, seat)) out.push({ t: 'swap9' });
    if (canClose(s, seat)) out.push({ t: 'close' });
    return out;
  },

  viewFor(s, seat) {
    return {
      seat, n: 2, hand: [...s.hands[seat]], handSizes: s.hands.map((h) => h.length), stockLeft: s.stock.length, trump: s.trump, trumpCard: s.trumpCard,
      closed: s.closed, leader: s.leader, turn: s.turn, trick: s.trick, myPts: s.pts[seat], pts: s.pts, pending: s.pending, tricks: s.tricks,
      game: s.game, target: s.target, dealNo: s.dealNo, seen: s.seen, marriages: s.marriages, phase: s.phase,
    };
  },

  applyMove(s, seat, move) {
    if (move.t === 'close') return { ...s, closed: seat, closedOpp: s.pts[1 - seat] };
    if (move.t === 'swap9') {
      const nine = s.trump + '9';
      const hands = s.hands.map((h, i) => (i === seat ? sortCards([...h.filter((c) => c !== nine), s.trumpCard]) : h));
      const stock = [...s.stock.slice(0, -1), nine];
      return { ...s, hands, stock, trumpCard: nine, swapped: { seat, got: s.trumpCard } };
    }
    const c = move.c;
    let st = { ...s, hands: s.hands.map((h, i) => (i === seat ? h.filter((x) => x !== c) : h)), seen: [...s.seen, c], swapped: null };
    if (!s.trick.length) {
      // çıkış: evlilik ilanı
      const m = marriageOf(s.hands[seat], c, s.trump);
      if (m) {
        const pts = [...st.pts];
        const pending = [...st.pending];
        if (st.tricks[seat] > 0) pts[seat] += m;
        else pending[seat] += m;
        st = { ...st, pts, pending, marriages: [...st.marriages, { seat, suit: suitOf(c), pts: m }], lastMarriage: { seat, suit: suitOf(c), pts: m } };
        if (st.tricks[seat] > 0 && pts[seat] >= 66) return finishDeal({ ...st, trick: [{ seat, card: c }] }, seat, 'win');
      } else st = { ...st, lastMarriage: null };
      return { ...st, trick: [{ seat, card: c }], turn: 1 - seat };
    }
    // ikinci kart: el sonucu
    const lead = s.trick[0];
    const winner = beats(lead.card, c, s.trump) ? seat : lead.seat;
    const pts = [...st.pts];
    const pending = [...st.pending];
    const tricks = [...st.tricks];
    tricks[winner]++;
    pts[winner] += val(lead.card) + val(c);
    if (pending[winner]) {
      pts[winner] += pending[winner];
      pending[winner] = 0;
    }
    const lastTrick = { winner, cards: [lead.card, c] };
    st = { ...st, pts, pending, tricks, trick: [], lastTrick, leader: winner, turn: winner, lastMarriage: null };
    // çekme: önce kazanan
    let drew = null;
    if (stockOpen(st)) {
      const stock = [...st.stock];
      const a = stock.shift();
      const b = stock.shift();
      const hands = st.hands.map((h) => [...h]);
      hands[winner].push(a);
      hands[1 - winner].push(b);
      drew = { winner, a, b };
      st = { ...st, stock, hands: hands.map(sortCards), drew };
    } else st = { ...st, drew: null };
    const w66 = check66(st);
    if (w66 >= 0) return finishDeal(st, w66, 'win');
    if (st.hands[0].length === 0) {
      // bütün kartlar oynandı
      if (st.closed >= 0) return finishDeal(st, 1 - st.closed, 'closeFail');
      pts[winner] += 10; // son el
      st = { ...st, pts };
      if (pts[winner] >= 66) return finishDeal(st, winner, 'win');
      return finishDeal(st, winner, 'noone');
    }
    return st;
  },

  isOver: (s) => s.phase === 'over',
  scores: (s) => s.game,

  publicEvent(before, seat, move, after) {
    return {
      seat, move,
      marriage: move.t === 'play' && !before.trick.length ? marriageOf(before.hands[seat], move.c, before.trump) : 0,
      trickDone: before.trick.length === 1 && move.t === 'play' ? { winner: after.lastTrick?.winner ?? null, cards: [before.trick[0].card, move.c] } : null,
      drew: after.drew && after.drew !== before.drew ? after.drew : null,
      dealEnd: after.dealEnd && after.dealEnd !== before.dealEnd ? after.dealEnd : null,
    };
  },

  // ---- Bot ----
  rateMove(view, move, ctx = {}) {
    const risk = ctx.risk ?? 0.5;
    const trump = view.trump;
    if (move.t === 'swap9') return 50;
    if (move.t === 'close') {
      // kapat: elde 66'ya yetecek güç varsa
      const strong = view.hand.reduce((a, c) => a + (suitOf(c) === trump ? 6 : 0) + (rankOf(c) === 14 ? 8 : rankOf(c) === 10 ? 5 : 0), 0);
      return view.myPts + strong * (0.7 + risk * 0.3) >= 66 ? 30 : -50;
    }
    const c = move.c;
    const m = !view.trick.length ? marriageOf(view.hand, c, trump) : 0;
    if (m) return 40 + m;
    if (!view.trick.length) {
      // çıkış: değersiz kart çık, kozu ve asları sakla
      return -val(c) - (suitOf(c) === trump ? 8 : 0) + (rankOf(c) === 9 ? 2 : 0) - (rankOf(c) >= 12 && rankOf(c) <= 13 && view.hand.includes(suitOf(c) + (rankOf(c) === 12 ? 13 : 12)) ? 12 : 0);
    }
    const lead = view.trick[0].card;
    const win = beats(lead, c, trump);
    const pot = val(lead) + val(c);
    if (win) return 10 + pot - (suitOf(c) === trump && suitOf(lead) !== trump ? 6 - val(lead) * 0.5 : 0) - val(c) * 0.2;
    return -val(c) * 1.2 - (suitOf(c) === trump ? 6 : 0) - (val(lead) >= 10 ? 3 : 0);
  },

  rolloutMove(s, seat, moves, rng) {
    const v = game.viewFor(s, seat);
    let best = moves[0];
    let bv = -Infinity;
    for (const m of moves) {
      const r = game.rateMove(v, m) + rng.gauss() * 2;
      if (r > bv) {
        bv = r;
        best = m;
      }
    }
    return best;
  },

  utility: (s, seat) => (s.dealEnd ? (s.dealEnd.winner === seat ? s.dealEnd.gp : -s.dealEnd.gp) : 0),

  /** Görünür bilgiyle uyumlu rastgele dünya: rakibin eli ve destenin sırası */
  determinize(view, seat, rng) {
    const known = new Set([...view.hand, ...view.seen, view.trumpCard]);
    for (const t of view.trick) known.add(t.card);
    const pool = rng.shuffle(ALL.filter((c) => !known.has(c)));
    // deste bittiyse açık koz kartı birinin elindedir: bende ya da oynanmış değilse rakiptedir
    const trumpInOpp = view.stockLeft === 0 && !view.hand.includes(view.trumpCard) && !view.seen.includes(view.trumpCard);
    const opp = [...(trumpInOpp ? [view.trumpCard] : []), ...pool.slice(0, view.handSizes[1 - seat] - (trumpInOpp ? 1 : 0))];
    const used = opp.length - (trumpInOpp ? 1 : 0);
    const stockRest = pool.slice(used, used + Math.max(0, view.stockLeft - 1));
    const hands = [];
    hands[seat] = [...view.hand];
    hands[1 - seat] = sortCards(opp);
    const stock = view.stockLeft > 0 ? [...stockRest, view.trumpCard] : [];
    return {
      n: 2, seed: rng.int(2 ** 31), game: [...view.game], target: view.target, sheet: [], horizon: true, dealNo: view.dealNo, hands, stock, trump: view.trump, trumpCard: view.trumpCard,
      closed: view.closed, closedOpp: 0, leader: view.leader, turn: view.turn, trick: view.trick, pts: [...view.pts], pending: [...view.pending], tricks: [...view.tricks],
      marriages: view.marriages, seen: view.seen, lastTrick: null, dealEnd: null, phase: 'play',
    };
  },
};

export default game;
