// Ortak bot: hangi oyun olursa olsun aynı sınıf çalışır. Oyunu yalnızca oyun modülünün
// sözleşmesi (js/core/game-api.js) üzerinden tanır.
import { defaultMoveKey, defaultUtility } from '../core/game-api.js';

export const LEVEL_NAMES = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };
export const STYLE_NAMES = { temkinli: 'Temkinli', dengeli: 'Dengeli', atak: 'Atak' };
export const SPEED_NAMES = { hizli: 'Hızlı', normal: 'Normal', yavas: 'Yavaş' };
export const STYLE_RISK = { temkinli: 0.2, dengeli: 0.5, atak: 0.8 };
export const SPEED_MS = { hizli: 250, normal: 700, yavas: 1300 };

const SIGMA = { 1: 0.8, 2: 0.25, 3: 0 }; // seviyeye göre "dikkatsizlik" payı
const RANDOM_MOVE_CHANCE = { 1: 0.25, 2: 0.04, 3: 0 };

export class Bot {
  constructor(profile) {
    this.profile = profile;
    this.memory = { events: [] };
  }

  get id() {
    return this.profile.id;
  }
  get name() {
    return this.profile.name;
  }
  get risk() {
    return STYLE_RISK[this.profile.style] ?? 0.5;
  }

  newMatch() {
    this.memory = { events: [] };
  }

  observe(game, event, view) {
    if (game.botObserve) {
      game.botObserve(this.memory, event, view);
    } else {
      this.memory.events.push(event);
      if (this.memory.events.length > 300) this.memory.events.shift();
    }
  }

  thinkMs(mult = 1) {
    return (SPEED_MS[this.profile.speed] ?? 700) * mult;
  }

  async choose(ctx) {
    return this.chooseSync(ctx);
  }

  chooseSync({ game, view, moves, seat, rng }) {
    if (moves.length === 1) return moves[0];
    const level = this.profile.level;
    const canMC = level === 3 && game.determinize && (!game.mcPhase || game.mcPhase(view));
    if (!game.rateMove && !canMC) return rng.pick(moves);
    if (rng() < (RANDOM_MOVE_CHANCE[level] ?? 0)) return rng.pick(moves);

    const ctx = { risk: this.risk, memory: this.memory, seat };
    const ratings = game.rateMove ? moves.map((m) => game.rateMove(view, m, ctx)) : moves.map(() => 0);

    if (canMC) {
      const mc = this.monteCarlo({ game, view, moves, seat, rng });
      let best = 0;
      let bestV = -Infinity;
      moves.forEach((_, i) => {
        const v = mc[i] + 1e-6 * ratings[i];
        if (v > bestV) {
          bestV = v;
          best = i;
        }
      });
      return moves[best];
    }

    const spread = Math.max(...ratings) - Math.min(...ratings) || 1;
    const sigma = SIGMA[level] ?? 0.25;
    let best = 0;
    let bestV = -Infinity;
    ratings.forEach((r, i) => {
      const v = r + sigma * spread * rng.gauss();
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    });
    return moves[best];
  }

  /** Zor seviye: görünmeyen kartları rastgele dağıtıp hamleleri simülasyonla puanlar. */
  monteCarlo({ game, view, moves, seat, rng }) {
    const key = game.moveKey || defaultMoveKey;
    const perMove = Math.max(20, Math.min(150, Math.floor((this.profile.mcBudget ?? 400) / moves.length)));
    const util = (s) => (game.utility ? game.utility(s, seat) : defaultUtility(game, s, seat));
    const totals = moves.map(() => 0);
    for (let k = 0; k < perMove; k++) {
      const world = game.determinize(view, seat, rng);
      moves.forEach((move, i) => {
        // Bu hamlenin yasal olduğu dünyada denenir
        let s = world;
        const legalHere = game.legalMoves(s, seat).some((m) => key(m) === key(move));
        if (!legalHere) {
          totals[i] += util(s) - 1;
          return;
        }
        s = game.applyMove(s, seat, move);
        let steps = 0;
        while (!game.isOver(s) && steps++ < 600) {
          const actor = game.currentActor(s);
          const ms = game.legalMoves(s, actor);
          const m = game.rolloutMove ? game.rolloutMove(s, actor, ms, rng) : rng.pick(ms);
          s = game.applyMove(s, actor, m);
        }
        totals[i] += util(s);
      });
    }
    return totals.map((t) => t / perMove);
  }
}
