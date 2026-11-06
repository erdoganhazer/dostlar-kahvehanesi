// Bakara (Punto Banco): 1-4 kişi kasaya karşı. Kurallar: docs/KUMARHANE-KURALLARI.md
// Bahis: Oyuncu eli (p), Kasa eli (b) ya da Beraberlik (t). İki el ikişer kart alır; değer: as 1, 2-9 kendi, 10 ve
// resimler 0; toplamın son basamağı. 8-9 "natürel": kimse çekmez. Yoksa oyuncu eli 0-5'te çeker, 6-7'de durur;
// kasa eli üçüncü kart tablosuna göre çeker. Ödeme: oyuncu 1:1, kasa 1:1 eksi %5, beraberlik 8:1 (beraberlikte
// oyuncu/kasa bahsi iade). Hamle: { t:'bet', on:'p'|'b'|'t', v }
import { BETS, START_CHIPS, ROUNDS, deckFor, newSeed, rateBet } from './casino-common.js';

export const pts = (c) => {
  const r = +c.slice(1);
  return r === 14 ? 1 : r >= 10 ? 0 : r;
};
export const total = (cards) => cards.reduce((t, c) => t + pts(c), 0) % 10;

/** Kasa eli üçüncü kartı çeker mi? (oyuncu eli çekmediyse p3 = null) */
export function bankerDraws(bt, p3) {
  if (p3 == null) return bt <= 5;
  const x = pts(p3);
  if (bt <= 2) return true;
  if (bt === 3) return x !== 8;
  if (bt === 4) return x >= 2 && x <= 7;
  if (bt === 5) return x >= 4 && x <= 7;
  if (bt === 6) return x === 6 || x === 7;
  return false;
}

/** Bir el oyna: seq = [{who:'p'|'b', c}] dağıtım sırası */
export function coup(deck) {
  let k = 0;
  const p = [deck[k++]];
  const b = [deck[k++]];
  p.push(deck[k++]);
  b.push(deck[k++]);
  const seq = [{ who: 'p', c: p[0] }, { who: 'b', c: b[0] }, { who: 'p', c: p[1] }, { who: 'b', c: b[1] }];
  if (total(p) < 8 && total(b) < 8) {
    let p3 = null;
    if (total(p) <= 5) {
      p3 = deck[k++];
      p.push(p3);
      seq.push({ who: 'p', c: p3 });
    }
    if (bankerDraws(total(b), p3)) {
      const c = deck[k++];
      b.push(c);
      seq.push({ who: 'b', c });
    }
  }
  const pt = total(p);
  const bt = total(b);
  return { p, b, pt, bt, seq, winner: pt > bt ? 'p' : bt > pt ? 'b' : 't' };
}

export function payout(bet, winner) {
  if (!bet) return 0;
  if (winner === 't') return bet.on === 't' ? bet.v * 8 : 0;
  if (bet.on === 't') return -bet.v;
  if (bet.on !== winner) return -bet.v;
  return bet.on === 'b' ? Math.floor(bet.v * 0.95) : bet.v;
}

const nextBettor = (s, from) => {
  for (let i = from + 1; i < s.n; i++) if (s.chips[i] >= BETS[0]) return i;
  return -1;
};
function newRound(s, round) {
  const base = { ...s, round, phase: 'bet', bets: Array(s.n).fill(null), deck: deckFor(s.seed, round) };
  const first = nextBettor(base, -1);
  if (round >= s.rounds || first < 0) return { ...base, phase: 'over', turn: -1 };
  return { ...base, turn: first };
}

const game = {
  id: 'bakara',
  name: 'Bakara',
  minPlayers: 1,
  maxPlayers: 4,
  createInitialState(config) {
    const n = Math.min(4, Math.max(1, config.players || 3));
    return newRound({ n, rounds: config.rounds || ROUNDS, seed: newSeed(config), chips: Array(n).fill(START_CHIPS), roundEnd: null }, 0);
  },
  currentActor: (s) => s.turn,
  legalMoves(s, seat) {
    if (s.phase === 'over' || seat !== s.turn) return [];
    const out = [];
    for (const on of ['p', 'b', 't']) for (const v of BETS) if (v <= s.chips[seat]) out.push({ t: 'bet', on, v });
    return out;
  },
  viewFor(s, seat) {
    const { deck, ...rest } = s;
    return { ...rest, seat };
  },
  applyMove(s, seat, m) {
    const bets = [...s.bets];
    bets[seat] = { on: m.on, v: m.v };
    const nb = nextBettor(s, seat);
    if (nb >= 0) return { ...s, bets, turn: nb };
    const r = coup(s.deck);
    const net = bets.map((b) => payout(b, r.winner));
    const chips = s.chips.map((c, i) => c + net[i]);
    const roundEnd = { round: s.round, ...r, bets, net, chips };
    return { ...newRound({ ...s, chips }, s.round + 1), roundEnd };
  },
  isOver: (s) => s.phase === 'over',
  scores: (s) => s.chips,
  publicEvent(before, seat, move, after) {
    return { seat, move, roundEnd: after.roundEnd !== before.roundEnd ? after.roundEnd : null };
  },
  moveKey: (m) => `${m.on}${m.v}`,
  // kasa bahsinin kasa avantajı en düşük (%1,06), oyuncu %1,24, beraberlik %14
  rateMove: (v, m, ctx = {}) => rateBet(m.v, { risk: (ctx.risk ?? 0.5) * 0.3 }) + { b: 6, p: 4, t: -40 }[m.on],
};

export default game;
