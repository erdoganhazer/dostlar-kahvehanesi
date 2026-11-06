// At Yarışı: 2-4 kişi. Kurallar (kullanıcının anlattığı): docs/KUMARHANE-KURALLARI.md
// Her elde herkes bir renge (ata) ve miktara oynar. Karılmış deste tek tek açılır, her kart kendi renginin kulvarına
// dizilir. 13 kartı ilk tamamlanan renk (at) kazanır. O ata oynayan bahsinin 3 katını kazanır (4 at, şans eşit),
// diğerleri bahsini kaybeder. 10 el; çipi biten oyuncu oynayamaz.
// Hamle: { t:'bet', suit:'S'|'H'|'D'|'C', v }
import { BETS, START_CHIPS, ROUNDS, SUITS, deckFor, newSeed, rateBet } from './casino-common.js';

export const PAYOUT = 3;

const nextBettor = (s, from) => {
  for (let i = from + 1; i < s.n; i++) if (s.chips[i] >= BETS[0]) return i;
  return -1;
};

function newRound(s, round) {
  const base = { ...s, round, phase: 'bet', bets: Array(s.n).fill(null), deck: deckFor(s.seed, round) };
  const first = nextBettor(base, -1);
  if (round >= s.rounds || first < 0 || s.chips[0] < BETS[0]) return { ...base, phase: 'over', turn: -1 };
  return { ...base, turn: first };
}

/** Yarışı koş: açılan kartlar ve kazanan renk */
export function race(deck) {
  const cnt = { S: 0, H: 0, D: 0, C: 0 };
  for (let k = 0; k < deck.length; k++) {
    const su = deck[k][0];
    if (++cnt[su] === 13) return { seq: deck.slice(0, k + 1), winner: su };
  }
  return null;
}

const game = {
  id: 'atyarisi',
  name: 'At Yarışı',
  minPlayers: 2,
  maxPlayers: 4,
  createInitialState(config) {
    const n = Math.min(4, Math.max(2, config.players || 4));
    return newRound({ n, rounds: config.rounds || ROUNDS, seed: newSeed(config), chips: Array(n).fill(START_CHIPS), roundEnd: null }, 0);
  },
  currentActor: (s) => s.turn,
  legalMoves(s, seat) {
    if (s.phase === 'over' || seat !== s.turn) return [];
    const out = [];
    for (const suit of SUITS) for (const v of BETS) if (v <= s.chips[seat]) out.push({ t: 'bet', suit, v });
    return out;
  },
  viewFor(s, seat) {
    const { deck, ...rest } = s;
    return { ...rest, seat };
  },
  applyMove(s, seat, m) {
    const bets = [...s.bets];
    bets[seat] = { suit: m.suit, v: m.v };
    const nb = nextBettor(s, seat);
    if (nb >= 0) return { ...s, bets, turn: nb };
    const r = race(s.deck);
    const net = bets.map((b) => (!b ? 0 : b.suit === r.winner ? b.v * PAYOUT : -b.v));
    const chips = s.chips.map((c, i) => c + net[i]);
    const roundEnd = { round: s.round, seq: r.seq, winner: r.winner, bets, net, chips };
    return { ...newRound({ ...s, chips }, s.round + 1), roundEnd };
  },
  isOver: (s) => s.phase === 'over',
  scores: (s) => s.chips,
  publicEvent(before, seat, move, after) {
    return { seat, move, roundEnd: after.roundEnd !== before.roundEnd ? after.roundEnd : null };
  },
  moveKey: (m) => `${m.suit}${m.v}`,
  rateMove(v, m, ctx = {}) {
    // atların şansı eşit: yalnız miktar önemli (küçük bahis); başkasının oynamadığı ata hafif yönel (çeşit olsun)
    const taken = v.bets.filter((b) => b && b.suit === m.suit).length;
    return rateBet(m.v, { risk: (ctx.risk ?? 0.5) * 0.2 }) - taken * 2;
  },
};

export default game;
