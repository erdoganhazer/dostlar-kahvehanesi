// Blöf ("Yalan"): 3-4 kişi, 52 kart eşit dağıtılır. Sırayla yüzü kapalı kart atıp "N adet <sayı>" dersin; sayılar
// As, 2, 3 ... Papaz sırasıyla gider. Herkes sırayla "yalan!" diyebilir. Yalansa atan, doğruysa diyen yığını alır.
// İlk eli biten kazanır. Kurallar: docs/BLOF-KURALLARI.md
// Hamleler: { t:'play', cards:[...] } (1-4 kart), { t:'call' }, { t:'pass' }
import { SUIT_ORDER } from './blof-util.js';

export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = [14, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // sıralı "söylenecek" sayılar
export const rankOf = (c) => +c.slice(1);
export const suitOf = (c) => c[0];
export const sortCards = (cards) => [...cards].sort((a, b) => SUIT_ORDER.indexOf(a[0]) - SUIT_ORDER.indexOf(b[0]) || rankOf(b) - rankOf(a));
const ALL = [];
for (const s of SUITS) for (let r = 2; r <= 14; r++) ALL.push(s + r);
const MAX_PLAYS = 260;

/** Aynı sayılı kartlar denk sayılır (renk önemsiz): her sayı çoklu kümesi için bir temsilci hamle üretir. */
function subsets(hand, maxK) {
  const by = new Map();
  for (const c of hand) {
    const r = rankOf(c);
    if (!by.has(r)) by.set(r, []);
    by.get(r).push(c);
  }
  const groups = [...by.values()];
  const out = [];
  const pick = (gi, cur) => {
    if (cur.length) out.push([...cur]);
    if (cur.length === maxK) return;
    for (let g = gi; g < groups.length; g++) {
      for (let take = 1; take <= groups[g].length && cur.length + take <= maxK; take++) {
        pick(g + 1, [...cur, ...groups[g].slice(0, take)]);
      }
    }
  };
  pick(0, []);
  return out;
}

const comb = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

/** Atan oyuncunun elindeki claim sayılı kartların en az k tane olma olasılığı. */
export function truthProb(view, claim, k, seatPlayed, handBefore) {
  const mine = view.hand.filter((c) => rankOf(c) === claim).length;
  const copies = 4 - mine; // başkalarında/yığında olabilecek
  const pop = 52 - view.hand.length;
  let p = 0;
  for (let j = k; j <= Math.min(4, copies); j++) p += (comb(copies, j) * comb(pop - copies, handBefore - j)) / comb(pop, handBefore);
  return Math.min(1, Math.max(0, p));
}

const game = {
  id: 'blof',
  name: 'Blöf',
  minPlayers: 3,
  maxPlayers: 4,

  createInitialState(config, rng) {
    const n = Math.min(4, Math.max(3, config.players || 4));
    const deck = rng.shuffle([...ALL]);
    const hands = Array.from({ length: n }, () => []);
    deck.forEach((c, i) => hands[i % n].push(c));
    return { n, hands: hands.map(sortCards), pile: [], ri: 0, phase: 'play', turn: rng.int(n), queue: [], lastPlay: null, lastTake: null, over: false, winner: -1, plays: 0 };
  },

  currentActor: (s) => s.turn,

  legalMoves(s, seat) {
    if (s.over || seat !== s.turn) return [];
    if (s.phase === 'call') return [{ t: 'call' }, { t: 'pass' }];
    return subsets(s.hands[seat], 4).map((cards) => ({ t: 'play', cards }));
  },

  moveKey: (m) => (m.t === 'play' ? `play:${m.cards.map(rankOf).sort((a, b) => a - b).join(',')}` : m.t),

  viewFor(s, seat) {
    const take = s.lastTake;
    return {
      seat,
      n: s.n,
      hand: [...s.hands[seat]],
      handSizes: s.hands.map((h) => h.length),
      pileSize: s.pile.length,
      phase: s.phase,
      turn: s.turn,
      next: RANKS[s.ri],
      lastPlay: s.lastPlay ? { seat: s.lastPlay.seat, k: s.lastPlay.cards.length, claim: s.lastPlay.claim } : null,
      queue: s.queue,
      lastTake: take ? { seat: take.seat, count: take.cards.length, cards: take.seat === seat ? take.cards : null } : null,
      over: s.over,
      winner: s.winner,
    };
  },

  applyMove(s, seat, move) {
    const hands = s.hands.map((h) => [...h]);
    if (move.t === 'play') {
      const set = new Set(move.cards);
      if (move.cards.length < 1 || move.cards.length > 4 || set.size !== move.cards.length || !move.cards.every((c) => hands[seat].includes(c))) throw new Error('Geçersiz blöf hamlesi');
      hands[seat] = hands[seat].filter((c) => !set.has(c));
      const claim = RANKS[s.ri];
      const queue = [];
      for (let k = 1; k < s.n; k++) queue.push((seat + k) % s.n);
      return { ...s, hands, pile: [...s.pile, ...move.cards], ri: (s.ri + 1) % 13, phase: 'call', queue, turn: queue[0], lastPlay: { seat, cards: [...move.cards], claim, handBefore: s.hands[seat].length }, lastTake: null, plays: s.plays + 1 };
    }
    const lp = s.lastPlay;
    if (move.t === 'pass') {
      const queue = s.queue.slice(1);
      if (queue.length) return { ...s, queue, turn: queue[0] };
      if (hands[lp.seat].length === 0) return { ...s, queue: [], over: true, winner: lp.seat };
      if (s.plays >= MAX_PLAYS) return finishByCards(s);
      return { ...s, queue: [], phase: 'play', turn: (lp.seat + 1) % s.n };
    }
    // call
    const truth = lp.cards.every((c) => rankOf(c) === lp.claim);
    const taker = truth ? seat : lp.seat;
    hands[taker] = sortCards([...hands[taker], ...s.pile]);
    const lastTake = { seat: taker, cards: s.pile, caller: seat, accused: lp.seat, truth, shown: lp.cards, claim: lp.claim };
    const base = { ...s, hands, pile: [], queue: [], lastTake };
    if (truth && hands[lp.seat].length === 0) return { ...base, over: true, winner: lp.seat };
    if (s.plays >= MAX_PLAYS) return finishByCards(base);
    return { ...base, phase: 'play', turn: (lp.seat + 1) % s.n };
  },

  isOver: (s) => s.over,
  scores: (s) => s.hands.map((h, i) => (i === s.winner ? 1 : 0)),
  winners: (s) => [s.winner],

  publicEvent(before, seat, move, after) {
    if (move.t === 'play') return { seat, t: 'play', k: move.cards.length, claim: after.lastPlay.claim };
    if (move.t === 'pass') return { seat, t: 'pass' };
    const lt = after.lastTake;
    return { seat, t: 'call', truth: lt.truth, accused: lt.accused, taker: lt.seat, shown: lt.shown, claim: lt.claim, count: lt.cards.length };
  },

  rateMove(view, move, ctx = {}) {
    const risk = ctx.risk ?? 0.5;
    if (move.t === 'play') {
      const claim = view.next;
      const k = move.cards.length;
      const t = move.cards.filter((c) => rankOf(c) === claim).length;
      const lies = k - t;
      // sıradaki sayıları (yakında ihtiyacım olacak) bluff için harcama
      const soon = move.cards.filter((c) => RANKS.slice((RANKS.indexOf(claim) + 1) % 13, (RANKS.indexOf(claim) + 4) % 13 + 1).includes(rankOf(c)) && rankOf(c) !== claim).length;
      const emptying = k === view.hand.length ? 1.5 : 0;
      return k * 0.9 - lies * (1.7 - risk) - (lies ? soon * 0.3 : 0) + emptying - (k > 2 && lies ? 0.6 : 0);
    }
    if (move.t === 'pass') return 0;
    // call: yığının büyüklüğü ve yalan olasılığı
    const lp = view.lastPlay;
    const handBefore = view.handSizes[lp.seat] + lp.k;
    const mine = view.hand.filter((c) => rankOf(c) === lp.claim).length;
    let plie;
    if (mine + lp.k > 4) plie = 1;
    else plie = 1 - truthProb(view, lp.claim, lp.k, lp.seat, handBefore);
    const pile = view.pileSize + 0.5;
    let val = pile * (2 * plie - 1) * (0.6 + risk * 0.5);
    if (view.handSizes[lp.seat] === 0) val += 6 * (plie > 0.02 ? 1 : 0); // son kartını attı: yakalamazsam kazanır
    return val - 0.2;
  },
};

function finishByCards(s) {
  const sizes = s.hands.map((h) => h.length);
  const winner = sizes.indexOf(Math.min(...sizes));
  return { ...s, over: true, winner };
}

export default game;

/** Yönerge için: son atışın yalan olma olasılığı */
export function lieProb(view) {
  const lp = view.lastPlay;
  if (!lp) return 0;
  const mine = view.hand.filter((c) => rankOf(c) === lp.claim).length;
  if (mine + lp.k > 4) return 1;
  return 1 - truthProb(view, lp.claim, lp.k, lp.seat, view.handSizes[lp.seat] + lp.k);
}
