// Blackjack (21): kasaya karşı, 1-4 oyuncu, tek deste, 10 el. Kurallar: docs/BLACKJACK-KURALLARI.md
// Hamleler: { t:'bet', v:50|100|200 }, { t:'hit' }, { t:'stand' }, { t:'double' }
import { makeRng } from '../core/rng.js';

export const SUITS = ['S', 'H', 'D', 'C'];
export const BETS = [50, 100, 200];
export const START_CHIPS = 1000;
export const ROUNDS = 10;
export const rankOf = (c) => +c.slice(1);
const ALL = [];
for (const s of SUITS) for (let r = 2; r <= 14; r++) ALL.push(s + r);

/** El değeri: { total, soft } — as 11 sayılır, aşarsa 1. */
export function value(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    const r = rankOf(c);
    if (r === 14) {
      aces++;
      total += 11;
    } else total += r >= 10 ? 10 : r;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}
export const isBlackjack = (hand) => hand.length === 2 && value(hand).total === 21;

function newRound(s, round) {
  const deck = makeRng((s.seed + round * 7919) >>> 0).shuffle([...ALL]);
  const base = {
    ...s,
    round,
    deck,
    pos: 0,
    phase: 'bet',
    bets: Array(s.n).fill(0),
    hands: Array.from({ length: s.n }, () => []),
    dealer: [],
    done: Array(s.n).fill(false),
    rev: false,
    dealLog: null,
    roundEnd: null,
  };
  const first = nextBettor(base, -1);
  if (first < 0) return { ...base, phase: 'over' };
  return { ...base, turn: first };
}

const nextBettor = (s, from) => {
  for (let i = from + 1; i < s.n; i++) if (s.chips[i] >= BETS[0]) return i;
  return -1;
};
const nextPlayer = (s, from, done = s.done) => {
  for (let i = from + 1; i < s.n; i++) if (s.bets[i] > 0 && !done[i]) return i;
  return -1;
};

function settle(s, hands, dealer, bets, done, pos, draws, chips) {
  const dv = value(dealer).total;
  const dBJ = isBlackjack(dealer);
  const outcomes = [];
  const net = [];
  hands.forEach((h, i) => {
    if (!bets[i]) {
      outcomes.push(null);
      net.push(0);
      return;
    }
    const pv = value(h).total;
    let o;
    let d;
    if (pv > 21) [o, d] = ['bust', -bets[i]];
    else if (isBlackjack(h)) [o, d] = dBJ ? ['push', 0] : ['bj', Math.floor(bets[i] * 1.5)];
    else if (dBJ) [o, d] = ['lose', -bets[i]];
    else if (dv > 21 || pv > dv) [o, d] = ['win', bets[i]];
    else if (pv === dv) [o, d] = ['push', 0];
    else [o, d] = ['lose', -bets[i]];
    outcomes.push(o);
    net.push(d);
  });
  const newChips = chips.map((c, i) => c + net[i]);
  const roundEnd = { round: s.round, hands: hands.map((h) => [...h]), dealer: [...dealer], bets: [...bets], outcomes, net, draws, chips: newChips };
  const base = { ...s, hands, dealer, bets, done, pos, chips: newChips, rev: true, roundEnd };
  if (s.round + 1 >= s.rounds) return { ...base, phase: 'over' };
  return { ...newRound({ ...s, chips: newChips }, s.round + 1), roundEnd };
}

/** Oyuncuların hamleleri bitti: krupiye açar ve 17'ye kadar çeker (yumuşak 17'de durur). */
function dealerPlay(s, hands, bets, done, pos, chips) {
  const dealer = [...s.dealer];
  const draws = [];
  const anyLive = hands.some((h, i) => bets[i] > 0 && value(h).total <= 21 && !isBlackjack(h));
  while (anyLive && value(dealer).total < 17) {
    const c = s.deck[pos++];
    dealer.push(c);
    draws.push(c);
  }
  return settle(s, hands, dealer, bets, done, pos, draws, chips);
}

const game = {
  id: 'blackjack',
  name: 'Blackjack',
  minPlayers: 1,
  maxPlayers: 4,

  createInitialState(config) {
    const n = Math.min(4, Math.max(1, config.players || 3));
    const s = { n, rounds: config.rounds || ROUNDS, seed: config.seed ?? Math.floor(Math.random() * 2 ** 31), chips: Array(n).fill(START_CHIPS), round: 0, phase: 'bet', over: false };
    return newRound(s, 0);
  },

  currentActor: (s) => s.turn,

  legalMoves(s, seat) {
    if (s.phase === 'over' || seat !== s.turn) return [];
    if (s.phase === 'bet') return BETS.filter((v) => v <= s.chips[seat]).map((v) => ({ t: 'bet', v }));
    const out = [{ t: 'hit' }, { t: 'stand' }];
    if (s.hands[seat].length === 2 && s.chips[seat] - s.bets[seat] >= s.bets[seat]) out.push({ t: 'double' });
    return out;
  },

  viewFor(s, seat) {
    return {
      seat,
      n: s.n,
      phase: s.phase,
      turn: s.turn,
      round: s.round,
      rounds: s.rounds,
      chips: s.chips,
      bets: s.bets,
      hands: s.hands,
      dealer: s.rev ? s.dealer : s.dealer.slice(0, 1),
      holeHidden: !s.rev && s.dealer.length > 1,
      done: s.done,
      left: s.deck.length - s.pos,
    };
  },

  applyMove(s, seat, move) {
    if (move.t === 'bet') {
      const bets = [...s.bets];
      bets[seat] = move.v;
      const nb = nextBettor(s, seat);
      if (nb >= 0) return { ...s, bets, turn: nb };
      // herkes bahsini verdi: dağıt (önce oyuncular, krupiye açık, oyuncular, krupiye kapalı)
      const active = bets.map((b, i) => (b > 0 ? i : -1)).filter((i) => i >= 0);
      const hands = Array.from({ length: s.n }, () => []);
      const dealer = [];
      const log = [];
      let pos = 0;
      for (let round = 0; round < 2; round++) {
        for (const i of active) {
          const c = s.deck[pos++];
          hands[i].push(c);
          log.push({ who: i, card: c });
        }
        const c = s.deck[pos++];
        dealer.push(c);
        log.push({ who: 'd', card: round === 0 ? c : null });
      }
      const chips = s.chips.map((c, i) => c - 0); // bahis çipi bahis bitene kadar bakiyede kalır
      const done = hands.map((h) => isBlackjack(h));
      const up = rankOf(dealer[0]);
      const peek = (up === 14 || up >= 10) && isBlackjack(dealer);
      const st = { ...s, bets, hands, dealer, pos, chips, done, dealLog: log, rev: false };
      if (peek) return dealerPlay(st, hands, bets, done, pos, chips);
      const np = nextPlayer(st, -1, done);
      if (np < 0) return dealerPlay(st, hands, bets, done, pos, chips);
      return { ...st, phase: 'play', turn: np };
    }

    const hands = s.hands.map((h) => [...h]);
    const bets = [...s.bets];
    const done = [...s.done];
    let pos = s.pos;
    if (move.t === 'stand') done[seat] = true;
    else {
      if (move.t === 'double') bets[seat] *= 2;
      hands[seat].push(s.deck[pos++]);
      const v = value(hands[seat]).total;
      if (move.t === 'double' || v >= 21) done[seat] = true;
    }
    if (!done[seat]) return { ...s, hands, bets, pos, dealLog: null };
    const np = nextPlayer(s, seat, done);
    if (np >= 0) return { ...s, hands, bets, done, pos, turn: np, dealLog: null };
    return dealerPlay({ ...s, dealLog: null }, hands, bets, done, pos, s.chips);
  },

  isOver: (s) => s.phase === 'over',
  scores: (s) => s.chips,

  publicEvent(before, seat, move, after) {
    return { seat, move, dealLog: after.dealLog && after.dealLog !== before.dealLog ? after.dealLog : null, roundEnd: after.roundEnd && after.roundEnd !== before.roundEnd ? after.roundEnd : null };
  },

  rateMove(view, move, ctx = {}) {
    if (move.t === 'bet') {
      const target = 50 + (ctx.risk ?? 0.5) * 150;
      return -Math.abs(move.v - target);
    }
    const best = basicStrategy(view);
    const legalDouble = true;
    if (move.t === best) return 1;
    if (best === 'double' && move.t === 'hit') return 0.6;
    if (best === 'double' && move.t === 'stand') return 0.2;
    return 0;
  },
};

/** Temel strateji: 'hit' | 'stand' | 'double' */
export function basicStrategy(view) {
  const hand = view.hands[view.seat];
  const { total, soft } = value(hand);
  const up = rankOf(view.dealer[0]);
  const u = up === 14 ? 11 : Math.min(10, up);
  const two = hand.length === 2;
  if (soft) {
    if (total >= 19) return 'stand';
    if (total === 18) return u >= 9 ? 'hit' : two && u >= 3 && u <= 6 ? 'double' : 'stand';
    if (two && u >= 4 && u <= 6) return 'double';
    return 'hit';
  }
  if (total >= 17) return 'stand';
  if (total >= 13) return u <= 6 ? 'stand' : 'hit';
  if (total === 12) return u >= 4 && u <= 6 ? 'stand' : 'hit';
  if (total === 11) return two ? 'double' : 'hit';
  if (total === 10) return two && u <= 9 ? 'double' : 'hit';
  if (total === 9) return two && u >= 3 && u <= 6 ? 'double' : 'hit';
  return 'hit';
}

export default game;
