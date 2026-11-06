// Kumarhane oyunlarının ortak parçaları: çip, el sayısı, bahis miktarları, her ele yeni karılmış deste.
import { makeRng } from '../core/rng.js';

export const BETS = [50, 100, 200];
export const START_CHIPS = 1000;
export const ROUNDS = 10;
export const SUITS = ['S', 'H', 'D', 'C'];
export const rankOf = (c) => +c.slice(1); // as 14
export const FULL = [];
for (const s of SUITS) for (let r = 2; r <= 14; r++) FULL.push(s + r);

/** Her el için tohumdan yeni karılmış deste (tekrar oynatılabilir) */
export const deckFor = (seed, round) => makeRng((seed + round * 7919) >>> 0).shuffle([...FULL]);
export const newSeed = (config) => config.seed ?? Math.floor(Math.random() * 2 ** 31);

/** Bahis hamleleri: çipin yettiği miktarlar */
export const betMoves = (chips, extra = {}) => BETS.filter((v) => v <= chips).map((v) => ({ t: 'bet', v, ...extra }));

/** Bahis puanı: risk iştahına göre hedef miktara yakın olan iyi (bot ve yancı) */
export const rateBet = (v, ctx = {}) => -Math.abs(v - (50 + (ctx.risk ?? 0.5) * 150));
