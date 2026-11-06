// Oyuncu listesi: aynı botlar TÜM oyunlarda kullanılır. Ayarlardan düzenlenir, cihazda saklanır.
import { Bot } from './bot.js';

// Çizimle yapılmış yüzler (js/ui/avatar.js); emoji yok
export const AVATARS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
// Masada en fazla 4 kişi: sen + 3 hazır oyuncu
export const MAX_BOTS = 3;
const LEVELS = [1, 2, 3];
const STYLES = ['temkinli', 'dengeli', 'atak'];
const SPEEDS = ['hizli', 'normal', 'yavas'];

export const DEFAULT_BOTS = [
  { id: 'bot-1', name: 'Kemal', avatar: 'a1', level: 2, style: 'dengeli', speed: 'normal', active: true },
  { id: 'bot-2', name: 'Murat', avatar: 'a2', level: 3, style: 'atak', speed: 'normal', active: true },
  { id: 'bot-3', name: 'Cemal', avatar: 'a3', level: 2, style: 'temkinli', speed: 'normal', active: true },
];

export const validPhoto = (p) => (typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(p) && p.length < 60000 ? p : '');
const clone = (o) => JSON.parse(JSON.stringify(o));

function sanitize(p) {
  const out = { ...p };
  if ('name' in out) out.name = String(out.name ?? '').trim().slice(0, 14) || 'Oyuncu';
  if ('avatar' in out && !AVATARS.includes(out.avatar)) out.avatar = AVATARS[0];
  if ('photo' in out) out.photo = validPhoto(out.photo);
  if ('level' in out) out.level = LEVELS.includes(+out.level) ? +out.level : 2;
  if ('style' in out && !STYLES.includes(out.style)) out.style = 'dengeli';
  if ('speed' in out && !SPEEDS.includes(out.speed)) out.speed = 'normal';
  if ('active' in out) out.active = !!out.active;
  return out;
}

export class Roster {
  constructor(storage) {
    this.storage = storage;
    const saved = storage.get('roster.v1', null);
    this.bots = Array.isArray(saved) && saved.length ? saved.map((b, k) => ({ ...sanitize({ stats: {}, ...b }), ...(AVATARS.includes(b.avatar) ? {} : { avatar: AVATARS[k % AVATARS.length] }) })) : this._defaults();
    // en fazla 3 hazır oyuncu: fazlası (önce etkin olanlar kalır) atılır
    if (this.bots.length > MAX_BOTS) {
      this.bots = [...this.bots.filter((b) => b.active), ...this.bots.filter((b) => !b.active)].slice(0, MAX_BOTS);
      this.bots.forEach((b) => (b.active = true));
      this._save();
    }
  }

  _defaults() {
    return DEFAULT_BOTS.map((b) => ({ ...clone(b), stats: {} }));
  }
  _save() {
    this.storage.set('roster.v1', this.bots);
  }

  list() {
    return this.bots;
  }
  active() {
    return this.bots.filter((b) => b.active);
  }
  get(id) {
    return this.bots.find((b) => b.id === id) ?? null;
  }

  add(partial = {}) {
    if (this.bots.length >= MAX_BOTS) return null;
    const base = { name: 'Yeni oyuncu', avatar: AVATARS[0], level: 2, style: 'dengeli', speed: 'normal', active: true };
    const bot = { ...sanitize({ ...base, ...partial }), id: `bot-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, stats: {} };
    this.bots.push(bot);
    this._save();
    return bot;
  }

  update(id, patch) {
    const b = this.get(id);
    if (!b) return null;
    const { id: _i, stats: _s, ...rest } = patch;
    Object.assign(b, sanitize(rest));
    this._save();
    return b;
  }

  remove(id) {
    if (this.bots.length <= 1) return false;
    this.bots = this.bots.filter((b) => b.id !== id);
    this._save();
    return true;
  }

  move(id, dir) {
    const i = this.bots.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= this.bots.length) return false;
    [this.bots[i], this.bots[j]] = [this.bots[j], this.bots[i]];
    this._save();
    return true;
  }

  reset() {
    this.bots = this._defaults();
    this._save();
  }

  /** Bir masa için sırayla n aktif bot seçer. Yeterli yoksa eldekileri döndürür. */
  pick(n) {
    return this.active().slice(0, n);
  }

  /** Koltuk listesi üretir: insan + (n-1) bot. */
  seatsFor(game, humanName = 'Oyuncu', players = game.maxPlayers) {
    const bots = this.pick(players - 1);
    if (bots.length < players - 1) {
      throw new Error(`Bu oyun için ${players - 1} aktif oyuncu gerekli, ${bots.length} var. Ayarlar > Oyuncular'dan etkinleştir.`);
    }
    return [{ kind: 'human', name: humanName }, ...bots.map((p) => ({ kind: 'bot', id: p.id, name: p.name, bot: new Bot(p) }))];
  }

  /** results: [{ id, won }] — yalnızca botlar için. */
  recordResult(gameId, results) {
    for (const r of results) {
      const b = this.get(r.id);
      if (!b) continue;
      const s = (b.stats[gameId] ??= { played: 0, won: 0 });
      s.played += 1;
      if (r.won) s.won += 1;
    }
    this._save();
  }

  totals(id) {
    const b = this.get(id);
    const all = Object.values(b?.stats ?? {});
    return { played: all.reduce((a, s) => a + s.played, 0), won: all.reduce((a, s) => a + s.won, 0) };
  }
}
