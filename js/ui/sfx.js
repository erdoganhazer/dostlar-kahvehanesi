// Ses efektleri: dosya yok, Web Audio ile üretilir (küçük, telifsiz, her tarayıcıda aynı).
// card: kâğıt kayması (dağıtma, çekme, atma, toplama) · turn: sıra sende · tick: süre azalıyor · msg: biri konuştu
// Ayar 'sound' (true/false). Tarayıcı ilk dokunuştan önce ses çaldırmaz; bağlam ilk dokunuşta açılır.
let settings = null;
/** app.js açılışta ayar nesnesini verir */
export function initSfx(s) {
  settings = s;
}

let ctx = null;
let noise = null;
const last = {};

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    // 1 sn beyaz gürültü (kâğıt sesi için)
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// ilk etkileşimde aç (otomatik çalma kuralı)
const unlock = () => {
  ac();
  removeEventListener('pointerdown', unlock);
  removeEventListener('keydown', unlock);
};
addEventListener('pointerdown', unlock);
addEventListener('keydown', unlock);

const on = () => !!settings && settings.get('sound') !== false;
/** Aynı ses çok sık üst üste binmesin */
const gate = (k, ms) => {
  const t = performance.now();
  if (last[k] && t - last[k] < ms) return false;
  last[k] = t;
  return true;
};
const vol = () => Math.max(0, Math.min(1, +(settings.get('soundVol') ?? 0.7)));

function tone(c, { f = 880, f2 = null, t0 = 0, dur = 0.15, type = 'sine', g = 0.2 }) {
  const o = c.createOscillator();
  const a = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, c.currentTime + t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + t0 + dur);
  a.gain.setValueAtTime(0.0001, c.currentTime + t0);
  a.gain.exponentialRampToValueAtTime(g * vol(), c.currentTime + t0 + 0.01);
  a.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
  o.connect(a).connect(c.destination);
  o.start(c.currentTime + t0);
  o.stop(c.currentTime + t0 + dur + 0.02);
}

export const sfx = {
  /** Kâğıt kayması: bant geçiren süzgeçten kısa gürültü, ses biraz değişken */
  card() {
    if (!on() || !gate('card', 45)) return;
    const c = ac();
    if (!c || c.state !== 'running') return;
    const src = c.createBufferSource();
    src.buffer = noise;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400 + Math.random() * 1600;
    bp.Q.value = 0.9;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const a = c.createGain();
    const t = c.currentTime;
    const d = 0.07 + Math.random() * 0.04;
    a.gain.setValueAtTime(0.0001, t);
    a.gain.exponentialRampToValueAtTime(0.35 * vol(), t + 0.008);
    a.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(bp).connect(hp).connect(a).connect(c.destination);
    src.start(t, Math.random() * 0.8, d + 0.02);
  },
  /** Sıra sende: iki notalı yumuşak çan */
  turn() {
    if (!on() || !gate('turn', 400)) return;
    const c = ac();
    if (!c || c.state !== 'running') return;
    tone(c, { f: 660, dur: 0.18, g: 0.16 });
    tone(c, { f: 990, t0: 0.11, dur: 0.28, g: 0.14 });
  },
  /** Bot sırası: çok hafif tok (sıra değişimi duyulsun, yormasın) */
  turnBot() {
    if (!on() || !gate('turnBot', 250)) return;
    const c = ac();
    if (!c || c.state !== 'running') return;
    tone(c, { f: 330, f2: 300, dur: 0.07, type: 'sine', g: 0.07 });
  },
  /** Süre azalıyor: kısa tik (son saniyeler) */
  tick(urgent = false) {
    if (!on() || !gate('tick', 300)) return;
    const c = ac();
    if (!c || c.state !== 'running') return;
    tone(c, { f: urgent ? 1500 : 1150, dur: 0.05, type: 'square', g: urgent ? 0.07 : 0.05 });
  },
  /** Mesaj: kısa "pıt" */
  msg() {
    if (!on() || !gate('msg', 250)) return;
    const c = ac();
    if (!c || c.state !== 'running') return;
    tone(c, { f: 520, f2: 880, dur: 0.11, type: 'triangle', g: 0.16 });
  },
};
