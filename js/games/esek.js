// Eşek: 3-4 oyuncu. n oyuncu için n sayı (A, K, Q, J...) × 4 renk. Herkese 4 kart.
// Herkes aynı anda bir kartı soluna (sıradaki oyuncuya) verir. Aynı sayıdan dört kartı toplayan "EŞEK!" der.
// Herkes (söyleyen hariç) tepki verir; en geç tepki veren o eli kaybeder ve bir harf alır (E-Ş-E-K).
// Hamle: { t:'pass', c } veya { t:'tap' } (ms isteğe bağlı: insanın ölçülen tepkisi)
import { makeRng } from '../core/rng.js';

const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = [14, 13, 12, 11, 10];
export const suitOf = (c) => c[0];
export const rankOf = (c) => +c.slice(1);
export const LETTERS = ['E', 'Ş', 'E', 'K'];

function dealRound(seed, round, n) {
  const rng = makeRng((seed + round * 7919) >>> 0);
  const deck = [];
  for (const r of RANKS.slice(0, n)) for (const s of SUITS) deck.push(s + r);
  rng.shuffle(deck);
  return Array.from({ length: n }, (_, p) => deck.slice(p * 4, p * 4 + 4));
}

const fourOf = (hand) => hand.length === 4 && hand.every((c) => rankOf(c) === rankOf(hand[0]));

function jitter(seed, round, seat) {
  const rng = makeRng((seed * 31 + round * 131 + seat * 977) >>> 0);
  return rng() * 400 - 150; // -150..+250 ms
}

const game = {
  id: 'esek',
  name: 'Eşek',
  minPlayers: 3,
  maxPlayers: 4,

  createInitialState(config, rng) {
    const n = config.players === 3 ? 3 : 4;
    const seed = rng.int(2 ** 31);
    return {
      n,
      seed,
      reaction: config.reaction || Array(n).fill(650),
      round: 0,
      hands: dealRound(seed, 0, n),
      picks: Array(n).fill(null),
      phase: 'pass',
      caller: -1,
      taps: Array(n).fill(null),
      losses: Array(n).fill(0),
      lastLoser: -1,
      loser: -1,
      over: false,
      last: null,
    };
  },

  currentActor(s) {
    if (s.phase === 'pass') return s.picks.findIndex((p) => p == null);
    return s.taps.findIndex((t, i) => t == null && i !== s.caller);
  },

  legalMoves(s, seat) {
    if (s.over || game.currentActor(s) !== seat) return [];
    if (s.phase === 'pass') return s.hands[seat].map((c) => ({ t: 'pass', c }));
    return [{ t: 'tap' }];
  },

  moveKey: (m) => (m.t === 'tap' ? 'tap' : JSON.stringify(m)),

  viewFor(s, seat) {
    return {
      seat,
      n: s.n,
      hand: [...s.hands[seat]],
      phase: s.phase,
      caller: s.caller,
      picked: s.picks.map((p) => p != null),
      taps: s.taps.map((t) => t != null),
      losses: s.losses,
      lastLoser: s.lastLoser,
      round: s.round,
      loser: s.loser,
      over: s.over,
      last: s.last,
      callerHand: s.phase === 'react' ? s.hands[s.caller] : null,
    };
  },

  applyMove(s, seat, move) {
    if (s.phase === 'pass') {
      const picks = [...s.picks];
      picks[seat] = move.c;
      if (picks.some((p) => p == null)) return { ...s, picks };
      // Tüm seçimler tamam: herkes soluna (ekranda sola) verir; i, (i-1)'e verir
      const hands = s.hands.map((h, i) => {
        const gave = picks[i];
        const got = picks[(i + 1) % s.n]; // herkes soluna (ekranda sola) verir: ben (i), (i-1)'e veririm
        return [...h.filter((c) => c !== gave), got];
      });
      const caller = hands.findIndex(fourOf);
      if (caller < 0) return { ...s, hands, picks: Array(s.n).fill(null), round: s.round + 0, last: { passed: true } };
      return { ...s, hands, picks: Array(s.n).fill(null), phase: 'react', caller, taps: Array(s.n).fill(null), last: { call: caller } };
    }
    // react
    const taps = [...s.taps];
    taps[seat] = move.ms ?? Math.max(120, s.reaction[seat] + jitter(s.seed, s.round, seat));
    if (taps.some((t, i) => t == null && i !== s.caller)) return { ...s, taps };
    let loser = -1;
    let worst = -1;
    taps.forEach((t, i) => {
      if (i !== s.caller && t > worst) {
        worst = t;
        loser = i;
      }
    });
    const losses = [...s.losses];
    losses[loser]++;
    const round = s.round + 1;
    const over = losses[loser] >= LETTERS.length;
    return {
      ...s,
      losses,
      round,
      lastLoser: loser,
      loser: over ? loser : -1,
      over,
      hands: over ? s.hands : dealRound(s.seed, round, s.n),
      phase: over ? 'over' : 'pass',
      taps,
      caller: over ? s.caller : -1,
      last: { loser, taps, caller: s.caller },
    };
  },

  isOver: (s) => s.over,
  scores: (s) => s.losses.map((l) => -l),
  winners: (s) => s.losses.map((_, i) => i).filter((i) => i !== s.loser),
  publicEvent: (before, seat, move, after) => ({ seat, t: move.t, call: after.last?.call, loser: after.last?.loser, roundEnded: after.round !== before.round }),

  // Bot: elindeki en sık sayıyı biriktirir, en az sahip olduğu sayıdan kart verir
  rateMove(view, move) {
    if (move.t !== 'pass') return 0;
    const cnt = {};
    for (const c of view.hand) cnt[rankOf(c)] = (cnt[rankOf(c)] || 0) + 1;
    return -cnt[rankOf(move.c)];
  },
};

export default game;
