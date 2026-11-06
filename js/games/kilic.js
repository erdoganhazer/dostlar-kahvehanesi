// Kılıç ("kılıç atmak / kılıç açmak"): iki kişilik kahvehane kumarı. Kurallar: docs/KUMARHANE-KURALLARI.md
// Her elde sırayla biri bahsi ve bir kartı söyler ("Sinek 7"). Karılmış deste bir onun önüne, bir rakibinin önüne
// tek tek açılır. Söylenen kart kimin önüne düşerse çanağı o alır. 10 el ya da biri batana kadar.
// Hamleler: { t:'bet', v } (söyleyen), { t:'name', c } (söyleyen)
import { BETS, START_CHIPS, ROUNDS, deckFor, newSeed, betMoves, rateBet, FULL } from './casino-common.js';

function newRound(s, round) {
  const chooser = round % 2;
  const can = Math.min(...s.chips) >= BETS[0];
  if (round >= s.rounds || !can) return { ...s, round, phase: 'over', turn: -1 };
  return { ...s, round, chooser, turn: chooser, phase: 'bet', bet: 0, named: null, deck: deckFor(s.seed, round) };
}

const game = {
  id: 'kilic',
  name: 'Kılıç',
  minPlayers: 2,
  maxPlayers: 2,
  createInitialState(config) {
    return newRound({ n: 2, rounds: config.rounds || ROUNDS, seed: newSeed(config), chips: [START_CHIPS, START_CHIPS], roundEnd: null }, 0);
  },
  currentActor: (s) => s.turn,
  legalMoves(s, seat) {
    if (s.phase === 'over' || seat !== s.turn) return [];
    if (s.phase === 'bet') return betMoves(Math.min(...s.chips));
    return FULL.map((c) => ({ t: 'name', c }));
  },
  viewFor(s, seat) {
    const { deck, ...rest } = s;
    return { ...rest, seat };
  },
  applyMove(s, seat, m) {
    if (m.t === 'bet') return { ...s, bet: m.v, phase: 'name' };
    // kartlar açılır: ilki söyleyenin önüne
    const k = s.deck.indexOf(m.c);
    const seq = s.deck.slice(0, k + 1);
    const winner = k % 2 === 0 ? s.chooser : 1 - s.chooser;
    const chips = s.chips.map((c, i) => c + (i === winner ? s.bet : -s.bet));
    const roundEnd = { round: s.round, chooser: s.chooser, named: m.c, bet: s.bet, seq, winner, chips };
    return { ...newRound({ ...s, chips }, s.round + 1), roundEnd, named: null };
  },
  isOver: (s) => s.phase === 'over',
  scores: (s) => s.chips,
  publicEvent(before, seat, move, after) {
    return { seat, move, roundEnd: after.roundEnd !== before.roundEnd ? after.roundEnd : null };
  },
  moveKey: (m) => `${m.t}:${m.v ?? m.c}`,
  rateMove(v, m, ctx = {}) {
    if (m.t === 'bet') {
      // öndeysen küçük oyna, gerideysen biraz aç
      const lead = v.chips[v.seat] - v.chips[1 - v.seat];
      return rateBet(m.v, { risk: Math.max(0, Math.min(1, (ctx.risk ?? 0.5) * 0.2 - lead / 1500)) }); // şans oyunu: küçük bahis
    }
    return 0; // hangi kart söylense şans aynı
  },
};

export default game;
