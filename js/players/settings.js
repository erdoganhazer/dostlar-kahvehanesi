// Genel ayarlar (oyuncu adı, hız çarpanı). Bot ayarları roster.js'te.
export const DEFAULT_SETTINGS = { humanName: 'Oyuncu', humanAvatar: 'a5', humanPhoto: '', paceMult: 1, kingEnds: true, pistiPlayers: 2, papazPlayers: 4, esekPlayers: 4, blackjackPlayers: 3, blofPlayers: 4, pokerPlayers: 4, fantiPlayers: 2, konkenPlayers: 4, yanikPlayers: 4, konkenScoring: 'ceza', konkenJoker: true, konkenCifte: true, tutor: true, chat: true, turnLimit: 30, cardStyle: 'buyuk', fourColor: false, backStyle: 'ks', backPhoto: '', cafe: true, myDrink: 'cay', wallet: 1000, yanciMode: 'sohbet', yanciName: 'Şerif', yanciAvatar: 'a4', yanciPhoto: '', sound: true, soundVol: 0.7, anger: true, solDraw: 1, spiderSuits: 1, atyarisiPlayers: 4, bakaraPlayers: 3, ucpokerPlayers: 3, savasPlayers: 3 };
export const PACE_OPTIONS = [
  { v: 0.5, label: 'Hızlı' },
  { v: 1, label: 'Normal' },
  { v: 1.6, label: 'Yavaş' },
];

export class Settings {
  constructor(storage) {
    this.storage = storage;
    const saved = storage.get('settings.v1', {}) || {};
    // eski "Yönerge kapalı" ayarı yancı kapalıya taşınır
    if (saved.tutor === false && !saved.yanciMode) saved.yanciMode = 'sessiz';
    if (saved.yanciMode === 'kapali') saved.yanciMode = 'sessiz';
    if (saved.yanciMode === 'yonerge') saved.yanciMode = 'sohbet';
    if (!saved.yanciName || saved.yanciName === 'Hüsnü Abi') saved.yanciName = 'Şerif';
    this.data = { ...DEFAULT_SETTINGS, ...saved };
  }
  get(k) {
    return this.data[k];
  }
  set(k, v) {
    if (k === 'humanName') v = String(v ?? '').trim().slice(0, 14) || DEFAULT_SETTINGS.humanName;
    if (k === 'paceMult') v = PACE_OPTIONS.some((o) => o.v === +v) ? +v : 1;
    if (k === 'backPhoto') v = typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length < 150000 ? v : '';
    if (k === 'backStyle') v = ['ks', 'avatar', 'foto'].includes(v) ? v : 'ks';
    if (k === 'humanPhoto') v = typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length < 60000 ? v : '';
    if (k === 'yanciMode') v = v === 'sessiz' || v === 'kapali' ? 'sessiz' : 'sohbet';
    if (k === 'yanciName') v = String(v ?? '').trim().slice(0, 14) || DEFAULT_SETTINGS.yanciName;
    if (k === 'yanciAvatar') v = /^a[1-8]$/.test(v) ? v : 'a4';
    if (k === 'yanciPhoto') v = typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(v) && v.length < 60000 ? v : '';
    if (k === 'humanAvatar') v = /^a[1-8]$/.test(v) ? v : 'a5';
    if (k === 'pistiPlayers') v = [2, 4].includes(+v) ? +v : 2;
    if (k === 'papazPlayers') v = [2, 3, 4].includes(+v) ? +v : 4;
    if (k === 'esekPlayers') v = [3, 4].includes(+v) ? +v : 4;
    if (k === 'blackjackPlayers') v = [1, 2, 3, 4].includes(+v) ? +v : 3;
    if (k === 'blofPlayers') v = [3, 4].includes(+v) ? +v : 4;
    if (k === 'pokerPlayers') v = [2, 3, 4].includes(+v) ? +v : 4;
    if (k === 'wallet') v = Number.isFinite(+v) && +v >= 0 ? Math.round(+v) : 1000;
    if (k === 'yanikPlayers') v = [2, 3, 4].includes(+v) ? +v : 4;
    if (k === 'konkenPlayers') v = [2, 3, 4].includes(+v) ? +v : 4;
    if (k === 'fantiPlayers') v = [2, 4].includes(+v) ? +v : 2;
    if (k === 'konkenScoring') v = v === 'galibiyet' ? 'galibiyet' : 'ceza';
    if (k === 'konkenJoker' || k === 'konkenCifte' || k === 'tutor' || k === 'chat' || k === 'fourColor' || k === 'cafe') v = !!v;
    if (k === 'cardStyle') v = v === 'klasik' ? 'klasik' : 'buyuk';
    if (k === 'turnLimit') v = [0, 15, 30].includes(+v) ? +v : 30;
    if (k === 'kingEnds') v = !!v;
    if (k === 'atyarisiPlayers') v = [2, 3, 4].includes(+v) ? +v : 4;
    if (k === 'bakaraPlayers' || k === 'ucpokerPlayers' || k === 'savasPlayers') v = [1, 2, 3, 4].includes(+v) ? +v : 3;
    if (k === 'solDraw') v = +v === 3 ? 3 : 1;
    if (k === 'spiderSuits') v = [1, 2, 4].includes(+v) ? +v : 1;
    this.data[k] = v;
    this.storage.set('settings.v1', this.data);
  }
  reset() {
    this.data = { ...DEFAULT_SETTINGS };
    this.storage.set('settings.v1', this.data);
  }
}
