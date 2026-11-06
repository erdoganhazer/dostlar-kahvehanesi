// Batak (ihaleli): 4 kişi, 52 kart, 13'er kart. Kurallar: docs/BATAK-KURALLARI.md
// Hamleler: { t:'bid', v: 0 (pas) | 5..13 }, { t:'trump', s:'S' }, { t:'play', c:'H13' }
// Kartlar düz metin: suit + rank ('S14' = maça ası).
import { makeRng } from '../core/rng.js';

export const N = 4;
export const SUITS = ['S', 'H', 'D', 'C'];
export const SUIT_TR = { S: 'Maça', H: 'Kupa', D: 'Karo', C: 'Sinek' };
export const MIN_BID = 5;
export const DEALS = 5;
export const suitOf = (c) => c[0];
export const rankOf = (c) => +c.slice(1);
export const sortCards = (cards) => [...cards].sort((a, b) => SUITS.indexOf(a[0]) - SUITS.indexOf(b[0]) || rankOf(b) - rankOf(a));
const ALL = [];
for (const s of SUITS) for (let r = 2; r <= 14; r++) ALL.push(s + r);

function dealHands(seed, dealNo) {
  const rng = makeRng((seed + dealNo * 7919) >>> 0);
  const deck = rng.shuffle([...ALL]);
  return Array.from({ length: N }, (_, p) => sortCards(deck.slice(p * 13, p * 13 + 13)));
}

function freshDeal(s, dealNo) {
  const dealer = dealNo % N;
  return {
    ...s,
    dealNo,
    dealer,
    hands: dealHands(s.seed, dealNo),
    phase: 'bid',
    turn: (dealer + 1) % N,
    bids: Array(N).fill(null),
    high: 0,
    bidder: -1,
    trump: null,
    trick: [],
    tricksWon: Array(N).fill(0),
    played: [],
    voids: Array.from({ length: N }, () => []),
    lastTrick: null,
    dealEnd: null,
  };
}

/** a, b kartlarından b, a'yı geçiyor mu? (a önce oynandı) */
export function beats(a, b, trump, lead) {
  const sa = suitOf(a);
  const sb = suitOf(b);
  if (sa === sb) return rankOf(b) > rankOf(a);
  if (sb === trump) return true;
  if (sa === trump) return false;
  return false; // b ne koz ne de açılan renk
}

export function trickWinner(trick, trump) {
  let best = trick[0];
  for (const t of trick.slice(1)) {
    const s = suitOf(t.card);
    const bs = suitOf(best.card);
    if (s === bs ? rankOf(t.card) > rankOf(best.card) : s === trump && bs !== trump) best = t;
  }
  return best.seat;
}

function playable(hand, trick, trump) {
  if (!trick.length) return hand;
  const lead = suitOf(trick[0].card);
  const inSuit = hand.filter((c) => suitOf(c) === lead);
  const hi = (suit) => Math.max(0, ...trick.filter((t) => suitOf(t.card) === suit).map((t) => rankOf(t.card)));
  if (inSuit.length) {
    // Kozlandıysa ve renk verdiysem yükseltmem gerekmez; yoksa mümkünse yükselt
    if (trick.some((t) => suitOf(t.card) === trump) && lead !== trump) return inSuit;
    const up = inSuit.filter((c) => rankOf(c) > hi(lead));
    return up.length ? up : inSuit;
  }
  const trumps = hand.filter((c) => suitOf(c) === trump);
  if (trumps.length) {
    const up = trumps.filter((c) => rankOf(c) > hi(trump));
    return up.length ? up : trumps;
  }
  return hand;
}

const game = {
  id: 'batak',
  name: 'Batak',
  minPlayers: 4,
  maxPlayers: 4,

  createInitialState(config, rng) {
    const s = {
      n: N,
      deals: config.deals || DEALS,
      seed: rng.int(2 ** 31),
      totals: Array(N).fill(0),
      sheet: [],
      horizon: false,
      phase: 'bid',
    };
    return freshDeal(s, 0);
  },

  currentActor: (s) => s.turn,

  legalMoves(s, seat) {
    if (s.phase === 'over' || seat !== s.turn) return [];
    if (s.phase === 'bid') {
      const done = s.bids.filter((b) => b !== null).length;
      const out = [];
      const forced = done === N - 1 && s.high === 0; // herkes pas geçtiyse son söz sahibi en az 5 demek zorunda
      if (!forced) out.push({ t: 'bid', v: 0 });
      for (let v = Math.max(MIN_BID, s.high + 1); v <= 13; v++) out.push({ t: 'bid', v });
      return out;
    }
    if (s.phase === 'trump') return SUITS.map((x) => ({ t: 'trump', s: x }));
    return playable(s.hands[seat], s.trick, s.trump).map((c) => ({ t: 'play', c }));
  },

  viewFor(s, seat) {
    return {
      seat,
      hand: [...s.hands[seat]],
      handSizes: s.hands.map((h) => h.length),
      phase: s.phase,
      turn: s.turn,
      dealNo: s.dealNo,
      deals: s.deals,
      dealer: s.dealer,
      bids: s.bids,
      high: s.high,
      bidder: s.bidder,
      trump: s.trump,
      trick: s.trick,
      tricksWon: s.tricksWon,
      played: s.played,
      voids: s.voids,
      totals: s.totals,
      sheet: s.sheet,
    };
  },

  applyMove(s, seat, move) {
    if (move.t === 'bid') {
      const bids = [...s.bids];
      bids[seat] = move.v;
      const high = Math.max(s.high, move.v);
      const bidder = move.v > s.high ? seat : s.bidder;
      const done = bids.filter((b) => b !== null).length;
      if (done < N) return { ...s, bids, high, bidder, turn: (seat + 1) % N };
      return { ...s, bids, high, bidder, phase: 'trump', turn: bidder };
    }
    if (move.t === 'trump') return { ...s, trump: move.s, phase: 'play', turn: s.bidder, trick: [] };

    // play
    const c = move.c;
    const hands = s.hands.map((h) => [...h]);
    hands[seat] = hands[seat].filter((x) => x !== c);
    const voids = s.voids.map((v) => [...v]);
    if (s.trick.length && suitOf(c) !== suitOf(s.trick[0].card) && !voids[seat].includes(suitOf(s.trick[0].card))) voids[seat].push(suitOf(s.trick[0].card));
    const trick = [...s.trick, { seat, card: c }];
    const played = [...s.played, c];
    if (trick.length < N) return { ...s, hands, trick, played, voids, turn: (seat + 1) % N, lastTrick: null };

    const winner = trickWinner(trick, s.trump);
    const tricksWon = [...s.tricksWon];
    tricksWon[winner]++;
    const lastTrick = { winner, cards: trick.map((t) => t.card) };
    if (hands[0].length) return { ...s, hands, trick: [], played, voids, tricksWon, turn: winner, lastTrick };

    // el bitti: puanlar
    const need = s.high;
    const made = tricksWon[s.bidder] >= need;
    const delta = tricksWon.map((t, i) => (i === s.bidder ? (made ? need : -need) : t));
    const totals = s.totals.map((t, i) => t + delta[i]);
    const dealEnd = { n: s.dealNo, bidder: s.bidder, bid: need, took: tricksWon[s.bidder], made, delta, trump: s.trump };
    const sheet = [...s.sheet, dealEnd];
    const base = { ...s, hands, trick: [], played, voids, tricksWon, lastTrick, totals, sheet, dealEnd };
    if (s.horizon || s.dealNo + 1 >= s.deals) return { ...base, phase: 'over' };
    return { ...freshDeal({ ...s, totals, sheet }, s.dealNo + 1), lastTrick, dealEnd };
  },

  isOver: (s) => s.phase === 'over',
  scores: (s) => s.totals,
  mcPhase: (view) => view.phase === 'play',

  publicEvent(before, seat, move, after) {
    return { seat, move, trickDone: after.lastTrick && after.lastTrick !== before.lastTrick ? after.lastTrick : null, dealEnd: after.dealEnd && after.dealEnd !== before.dealEnd ? after.dealEnd : null };
  },

  // ---- Bot ----------------------------------------------------------------------------------

  rateMove(view, move, ctx = {}) {
    if (move.t === 'bid') return rateBid(view, move, ctx.risk ?? 0.5);
    if (move.t === 'trump') return rateTrump(view.hand, move.s);
    return ratePlay(view, move);
  },

  rolloutMove(s, seat, moves, rng) {
    if (moves.length === 1 || s.phase !== 'play') return moves[0];
    const v = { seat, hand: s.hands[seat], trick: s.trick, trump: s.trump, played: s.played, bidder: s.bidder, high: s.high, tricksWon: s.tricksWon, voids: s.voids };
    let best = moves[0];
    let bv = -Infinity;
    for (const m of moves) {
      const r = ratePlay(v, m) + rng.gauss() * 0.8;
      if (r > bv) {
        bv = r;
        best = m;
      }
    }
    return best;
  },

  /** Görünür bilgiyle uyumlu rastgele tam durum; yalnızca bu eli oynatır. */
  determinize(view, seat, rng) {
    const have = new Set([...view.hand, ...view.played, ...view.trick.map((t) => t.card)]);
    const pool = rng.shuffle(ALL.filter((c) => !have.has(c)));
    const hands = Array(N);
    hands[seat] = [...view.hand];
    const others = [0, 1, 2, 3].filter((p) => p !== seat).sort((a, b) => view.voids[b].length - view.voids[a].length);
    let rest = pool;
    others.forEach((p, idx) => {
      const need = view.handSizes[p];
      let mine;
      if (idx === others.length - 1) mine = rest.slice(0, need);
      else {
        const ok = rest.filter((c) => !view.voids[p].includes(suitOf(c)));
        mine = ok.slice(0, need);
        if (mine.length < need) mine = [...mine, ...rest.filter((c) => !mine.includes(c)).slice(0, need - mine.length)];
      }
      const set = new Set(mine);
      rest = rest.filter((c) => !set.has(c));
      hands[p] = sortCards(mine);
    });
    const { seat: _s, hand: _h, handSizes: _hs, ...r } = view;
    return { ...r, n: N, hands, seed: rng.int(2 ** 31), horizon: true, lastTrick: null, dealEnd: null };
  },
};

// ---- Sezgiler -------------------------------------------------------------------------------

/** Elin tahmini el sayısı. */
export function estimateTricks(hand, trump = null) {
  const by = { S: [], H: [], D: [], C: [] };
  for (const c of hand) by[suitOf(c)].push(rankOf(c));
  let est = 0;
  for (const s of SUITS) {
    const r = by[s].sort((a, b) => b - a);
    const len = r.length;
    const isT = trump ? s === trump : false;
    if (r[0] === 14) est += 1;
    if (r[0] === 13 || r[1] === 13) est += len >= 2 ? 0.75 : 0.3;
    if (r.includes(12)) est += len >= 3 ? 0.45 : 0.15;
    if (r.includes(11) && len >= 4) est += 0.25;
    if (!trump && len >= 5) est += (len - 4) * 0.6; // koz adayı uzun renk
    if (trump && isT) est += Math.max(0, len - 3) * 0.8 + (len >= 3 ? 0.2 : 0);
    if (trump && !isT && len <= 2) est += (2 - len) * 0.3; // kısa renk: koz ile keserim
  }
  return est;
}

function rateBid(v, move, risk) {
  if (move.v === 0) return 0;
  const affordable = Math.floor(estimateTricks(v.hand) + 1.1 + risk * 0.9);
  return move.v <= affordable ? 1 + move.v * 0.1 : -1 - (move.v - affordable);
}

function rateTrump(hand, s) {
  const mine = hand.filter((c) => suitOf(c) === s);
  return mine.length * 2 + mine.reduce((a, c) => a + (rankOf(c) >= 12 ? rankOf(c) - 10 : 0), 0);
}

function ratePlay(v, move) {
  const c = move.c;
  const trump = v.trump;
  const r = rankOf(c);
  const isT = suitOf(c) === trump;
  if (!v.trick.length) {
    // açış: asları ve uzun rengin yüksek kartını sür; kozu, en yüksek koz sende değilse tutma
    let val = r - 8;
    if (isT) val -= 6;
    if (r === 14 && !isT) val += 8;
    const suitCount = v.hand.filter((x) => suitOf(x) === suitOf(c)).length;
    val += suitCount * 0.2;
    return val;
  }
  const lead = suitOf(v.trick[0].card);
  const beatsAll = v.trick.every((t) => beats(t.card, c, trump, lead));
  const last = v.trick.length === N - 1;
  if (beatsAll) {
    // alabiliyorsam: en küçük kazandıran kart iyi; son oynuyorsam kesin kazanırım
    return 20 - r * 0.6 - (isT ? 4 : 0) + (last ? 5 : 0);
  }
  // kazanamıyorum: en küçüğünü at, koz atma, kısa rengi boşalt
  const same = v.hand.filter((x) => suitOf(x) === suitOf(c)).length;
  return -r * 0.7 - (isT ? 8 : 0) - same * 0.15;
}

export default game;
