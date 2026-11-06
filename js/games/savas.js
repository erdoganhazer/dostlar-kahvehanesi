// Casino Savaşı: 1-4 kişi kasaya karşı. Kurallar: docs/KUMARHANE-KURALLARI.md
// Bahis → herkese ve kasaya birer açık kart. Büyük kart kazanır (as en büyük), 1:1. Eşitlikte: teslim ol (bahsin
// yarısı gider) ya da savaşa gir (bahis kadar daha koy): kasa 3 kart yakar, savaşanlara ve kendine birer kart verir;
// kartın kasanınkine eşit ya da büyükse ek bahis 1:1 kazanır, ilk bahis iade; küçükse ikisi de gider.
// Hamleler: {t:'bet',v}, {t:'war'}, {t:'surrender'}
import { BETS, START_CHIPS, ROUNDS, deckFor, newSeed, rateBet, rankOf } from './casino-common.js';

const nextBettor = (s, from) => {
  for (let i = from + 1; i < s.n; i++) if (s.chips[i] >= BETS[0]) return i;
  return -1;
};
function newRound(s, round) {
  const base = { ...s, round, phase: 'bet', bets: Array(s.n).fill(0), cards: Array(s.n).fill(null), dealer: null, ties: [], choice: Array(s.n).fill(null), deck: deckFor(s.seed, round), pos: 0 };
  const first = nextBettor(base, -1);
  if (round >= s.rounds || first < 0) return { ...base, phase: 'over', turn: -1 };
  return { ...base, turn: first };
}

function settle(s, choice) {
  let pos = s.pos;
  const warriors = s.ties.filter((i) => choice[i] === 'war');
  const war = warriors.length ? { burn: s.deck.slice(pos, pos + 3), cards: {}, dealer: null } : null;
  if (war) {
    pos += 3;
    for (const i of warriors) war.cards[i] = s.deck[pos++];
    war.dealer = s.deck[pos++];
  }
  const dr = rankOf(s.dealer);
  const res = [];
  const net = s.bets.map((b, i) => {
    if (!b) return res.push(null) && 0;
    const r = rankOf(s.cards[i]);
    if (r > dr) return res.push('win') && b;
    if (r < dr) return res.push('lose') && -b;
    if (choice[i] === 'surrender') return res.push('surrender') && -Math.floor(b / 2);
    const ok = rankOf(war.cards[i]) >= rankOf(war.dealer);
    res.push(ok ? 'warwin' : 'warlose');
    return ok ? b : -2 * b;
  });
  const chips = s.chips.map((c, i) => c + net[i]);
  const roundEnd = { round: s.round, cards: s.cards, dealer: s.dealer, bets: s.bets, ties: s.ties, choice, war, net, res, chips };
  return { ...newRound({ ...s, chips }, s.round + 1), roundEnd };
}

const game = {
  id: 'savas',
  name: 'Casino Savaşı',
  minPlayers: 1,
  maxPlayers: 4,
  createInitialState(config) {
    const n = Math.min(4, Math.max(1, config.players || 3));
    return newRound({ n, rounds: config.rounds || ROUNDS, seed: newSeed(config), chips: Array(n).fill(START_CHIPS), roundEnd: null }, 0);
  },
  currentActor: (s) => s.turn,
  legalMoves(s, seat) {
    if (s.phase === 'over' || seat !== s.turn) return [];
    if (s.phase === 'bet') return BETS.filter((v) => v <= s.chips[seat]).map((v) => ({ t: 'bet', v }));
    const out = [{ t: 'surrender' }];
    if (s.chips[seat] >= s.bets[seat] * 2) out.unshift({ t: 'war' });
    return out;
  },
  viewFor(s, seat) {
    const { deck, ...rest } = s;
    return { ...rest, seat };
  },
  applyMove(s, seat, m) {
    if (m.t === 'bet') {
      const bets = [...s.bets];
      bets[seat] = m.v;
      const nb = nextBettor(s, seat);
      if (nb >= 0) return { ...s, bets, turn: nb };
      const act = bets.map((b, i) => (b > 0 ? i : -1)).filter((i) => i >= 0);
      const cards = Array(s.n).fill(null);
      let pos = 0;
      const dealLog = [];
      for (const i of act) {
        cards[i] = s.deck[pos++];
        dealLog.push({ who: i, c: cards[i] });
      }
      const dealer = s.deck[pos++];
      dealLog.push({ who: 'd', c: dealer });
      const ties = act.filter((i) => rankOf(cards[i]) === rankOf(dealer));
      const st = { ...s, bets, cards, dealer, pos, ties, dealLog };
      if (!ties.length) return settle(st, s.choice);
      return { ...st, phase: 'tie', turn: ties[0] };
    }
    const choice = [...s.choice];
    choice[seat] = m.t;
    const nx = s.ties.find((i) => i > seat);
    if (nx != null) return { ...s, choice, turn: nx, dealLog: null };
    return settle({ ...s, dealLog: null }, choice);
  },
  isOver: (s) => s.phase === 'over',
  scores: (s) => s.chips,
  publicEvent(before, seat, move, after) {
    return { seat, move, dealLog: after.dealLog && after.dealLog !== before.dealLog ? after.dealLog : null, roundEnd: after.roundEnd !== before.roundEnd ? after.roundEnd : null };
  },
  moveKey: (m) => `${m.t}${m.v ?? ''}`,
  // savaşa girmek her zaman teslim olmaktan iyi (kasa avantajı %2,9'a karşı %3,7)
  rateMove: (v, m, ctx = {}) => (m.t === 'bet' ? rateBet(m.v, { risk: (ctx.risk ?? 0.5) * 0.3 }) : m.t === 'war' ? 1 : 0),
};

export default game;
