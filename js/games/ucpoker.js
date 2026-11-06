// Üç Kart Poker: 1-4 kişi kasaya karşı. Kurallar: docs/KUMARHANE-KURALLARI.md
// Ante koy → 3 kart gelir → "oyna" (ante kadar daha koy) ya da "çekil" (ante gider). Kasa kız yüksek ya da daha iyiyle
// açar; açamazsa ante 1:1 kazanır, oyun bahsi iade. Açarsa: yenersen ante ve oyun 1:1, yenilirsen ikisi gider,
// eşitlikte iade. Ante bonusu (oynayana, kasa ne olursa olsun): seri 1, üçlü 4, renk serisi 5 kat.
// El sırası: renk serisi > üçlü > seri > renk > çift > yüksek kart. Hamleler: {t:'bet',v}, {t:'play'}, {t:'fold'}
import { BETS, START_CHIPS, ROUNDS, deckFor, newSeed, rateBet, rankOf } from './casino-common.js';

export const CAT = ['Yüksek kart', 'Çift', 'Renk', 'Seri', 'Üçlü', 'Renk serisi'];
export const BONUS = { 3: 1, 4: 4, 5: 5 };

/** El değeri: [kategori, ...sıralama] (büyük olan iyi) */
export function evalHand(cards) {
  const r = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => c[0] === cards[0][0]);
  let straight = r[0] - r[1] === 1 && r[1] - r[2] === 1;
  let top = r[0];
  if (!straight && r[0] === 14 && r[1] === 3 && r[2] === 2) {
    straight = true;
    top = 3; // A-2-3 en küçük seri
  }
  if (straight && flush) return [5, top];
  if (r[0] === r[2]) return [4, r[0]];
  if (straight) return [3, top];
  if (flush) return [2, ...r];
  if (r[0] === r[1] || r[1] === r[2]) {
    const pair = r[1];
    const kick = r[0] === r[1] ? r[2] : r[0];
    return [1, pair, kick];
  }
  return [0, ...r];
}
export const cmp = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
};
export const qualifies = (e) => e[0] > 0 || e[1] >= 12;
/** Temel strateji: kız-6-4 ve üstüyle oyna */
export const shouldPlay = (cards) => cmp(evalHand(cards), [0, 12, 6, 4]) >= 0;

const active = (s) => s.antes.map((a, i) => (a > 0 ? i : -1)).filter((i) => i >= 0);
const nextBettor = (s, from) => {
  for (let i = from + 1; i < s.n; i++) if (s.chips[i] >= BETS[0] * 2) return i;
  return -1;
};
function newRound(s, round) {
  const base = { ...s, round, phase: 'bet', antes: Array(s.n).fill(0), plays: Array(s.n).fill(null), hands: Array.from({ length: s.n }, () => []), dealer: [], deck: deckFor(s.seed, round), rev: false };
  const first = nextBettor(base, -1);
  if (round >= s.rounds || first < 0) return { ...base, phase: 'over', turn: -1 };
  return { ...base, turn: first };
}

function settle(s, plays) {
  const de = evalHand(s.dealer);
  const q = qualifies(de);
  const out = s.antes.map((a, i) => {
    if (!a) return { net: 0, res: null };
    if (!plays[i]) return { net: -a, res: 'fold' };
    const pe = evalHand(s.hands[i]);
    const bonus = (BONUS[pe[0]] || 0) * a;
    if (!q) return { net: a + bonus, res: 'noq', bonus };
    const c = cmp(pe, de);
    if (c > 0) return { net: 2 * a + bonus, res: 'win', bonus };
    if (c < 0) return { net: -2 * a + bonus, res: 'lose', bonus };
    return { net: bonus, res: 'push', bonus };
  });
  const net = out.map((o) => o.net);
  const chips = s.chips.map((c, i) => c + net[i]);
  const roundEnd = { round: s.round, hands: s.hands, dealer: s.dealer, antes: s.antes, plays, net, res: out.map((o) => o.res), bonus: out.map((o) => o.bonus || 0), dealerCat: de[0], qualified: q, chips };
  return { ...newRound({ ...s, chips }, s.round + 1), roundEnd };
}

const game = {
  id: 'ucpoker',
  name: 'Üç Kart Poker',
  minPlayers: 1,
  maxPlayers: 4,
  createInitialState(config) {
    const n = Math.min(4, Math.max(1, config.players || 3));
    return newRound({ n, rounds: config.rounds || ROUNDS, seed: newSeed(config), chips: Array(n).fill(START_CHIPS), roundEnd: null }, 0);
  },
  currentActor: (s) => s.turn,
  legalMoves(s, seat) {
    if (s.phase === 'over' || seat !== s.turn) return [];
    if (s.phase === 'bet') return BETS.filter((v) => v * 2 <= s.chips[seat]).map((v) => ({ t: 'bet', v }));
    return [{ t: 'play' }, { t: 'fold' }];
  },
  viewFor(s, seat) {
    const { deck, ...rest } = s;
    return { ...rest, seat, hands: s.hands.map((h, i) => (i === seat || s.rev ? h : h.map(() => null))), dealer: s.dealer.map(() => null) };
  },
  applyMove(s, seat, m) {
    if (m.t === 'bet') {
      const antes = [...s.antes];
      antes[seat] = m.v;
      const nb = nextBettor(s, seat);
      if (nb >= 0) return { ...s, antes, turn: nb };
      // dağıt: oyunculara üçer, kasaya üç
      const act = antes.map((a, i) => (a > 0 ? i : -1)).filter((i) => i >= 0);
      const hands = Array.from({ length: s.n }, () => []);
      const dealer = [];
      let k = 0;
      const dealLog = [];
      for (let r = 0; r < 3; r++) {
        for (const i of act) {
          hands[i].push(s.deck[k]);
          dealLog.push({ who: i, c: s.deck[k++] });
        }
        dealer.push(s.deck[k]);
        dealLog.push({ who: 'd', c: s.deck[k++] });
      }
      return { ...s, antes, hands, dealer, phase: 'play', turn: act[0], dealLog };
    }
    const plays = [...s.plays];
    plays[seat] = m.t === 'play';
    const act = active(s);
    const nx = act.find((i) => i > seat);
    if (nx != null) return { ...s, plays, turn: nx, dealLog: null };
    return settle({ ...s, rev: true, dealLog: null }, plays);
  },
  isOver: (s) => s.phase === 'over',
  scores: (s) => s.chips,
  publicEvent(before, seat, move, after) {
    return { seat, move, dealLog: after.dealLog && after.dealLog !== before.dealLog ? after.dealLog : null, roundEnd: after.roundEnd !== before.roundEnd ? after.roundEnd : null };
  },
  moveKey: (m) => `${m.t}${m.v ?? ''}`,
  rateMove(v, m, ctx = {}) {
    if (m.t === 'bet') return rateBet(m.v, { risk: (ctx.risk ?? 0.5) * 0.3 });
    const good = shouldPlay(v.hands[v.seat]);
    return (m.t === 'play') === good ? 1 : 0;
  },
};

export default game;
