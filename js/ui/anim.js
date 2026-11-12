import { sfx } from './sfx.js';
// Kart animasyon motoru. KURALLAR: docs/ANIMASYON-KURALLARI.md (yeni oyun yazmadan önce oku).
//
// Temel fikir: ekran her zaman STATİK çizilir (CSS animasyonu yok). Hareket eden her kart, ekranın üstündeki
// ayrı bir katmanda (#fx) gerçek kaynağından (elindeki kart, oyuncunun kutusu, deste, yığın) gerçek hedefine
// (ölçülen yuva) uçar. Kart inince statik kopyası görünür olur. Böylece:
//   - kart asla ışınlanmaz, asla yanlış yerden doğmaz, yeniden çizimde animasyon tekrar oynamaz;
//   - hedefteki görüntü (el, sayı, yığın) kart inmeden değişmez.

/** Süreler (ms, Normal hızda). Ayarlardaki hız çarpanıyla çarpılır. */
export const T = {
  play: 320, // elden masaya
  botPlay: 380, // rakip kutusundan masaya
  read: 650, // tamamlanan eli okumak için bekleme
  collect: 430, // masadaki kartların alana gitmesi
  collectStagger: 45,
  pass: 560, // oyuncudan oyuncuya (çekme, verme)
  deal: 260, // desteden oyuncuya tek kart
  dealStagger: 40,
  reflow: 200, // eldeki kartların boşluğu kapatması
  flip: 160, // kartın yüzünü çevirme (yarım tur)
  pause: 300, // ardışık iki hareket arası nefes
};

/** Eğriler: inişte yavaşlayan, kalkışta hızlanan; zıplama ve esneme yok. */
export const EASE = {
  land: 'cubic-bezier(.2,.75,.25,1)',
  leave: 'cubic-bezier(.55,0,.75,.35)',
  move: 'cubic-bezier(.45,.05,.3,1)',
};

let paceMult = 1;
export function setPace(m) {
  paceMult = m || 1;
}
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const dur = (name) => Math.round((typeof name === 'number' ? name : T[name] ?? 300) * paceMult * (reduced() ? 0.15 : 1));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Uçan kartların katmanı (sayfanın üstünde, tıklamayı engellemez). */
export function layer() {
  let l = document.getElementById('fx');
  if (!l) {
    l = document.createElement('div');
    l.id = 'fx';
    document.body.append(l);
  }
  return l;
}
export function clearLayer() {
  const l = document.getElementById('fx');
  if (l) l.replaceChildren();
}

/** Bir öğenin ekrandaki kutusu: merkez, dönüşsüz genişlik/yükseklik ve (varsa) data-rot açısı. */
export function box(el, scale = 1) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const w = (el.offsetWidth || r.width) * scale;
  const h = (el.offsetHeight || r.height) * scale;
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w, h, rot: +(el.dataset?.rot || 0) };
}

/** Bir noktada belirli boyda sanal kutu (ör. oyuncu kutusunun ortası, küçük kart boyu). */
export function point(el, w, h, rot = 0) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w, h, rot };
}

/**
 * Kartı `from` kutusundan `to` kutusuna uçurur. node: kart öğesi (yüz ya da arka).
 * opts: duration, easing, delay, fadeEnd (son %20'de kaybolur: bir oyuncunun destesine karışırken),
 *       keep (inince katmanda bırak; çağıran kaldırır), flipTo (yarı yolda yüzünü değiştirecek öğe)
 */
export function fly(node, from, to, opts = {}) {
  // Gecikmeli uçuş (dağıtım): uçan kart ancak sırası gelince oluşturulur. Eskiden 52 kartın hepsi baştan ekrana
  // konup bekletiliyordu (52 ayrı katman): telefonda ekran kartı zorlanıyor, ses çalarken görüntü geride kalıyordu.
  // Ses de uçuşun gerçekten başladığı anda çalar, ikisi ayrışmaz.
  if (opts.delay > 0 && from && to) {
    // yer tutucu (görünmez, katmansız): "uçuş sürüyor" denetimleri (#fx .fxw) bekleyen kartı da saysın
    const hold = document.createElement('i');
    hold.className = 'fxw';
    hold.style.display = 'none';
    layer().append(hold);
    return new Promise((res) => setTimeout(() => {
      hold.remove();
      res(fly(node, from, to, { ...opts, delay: 0 }));
    }, opts.delay));
  }
  if (!opts.silent) sfx.card();
  if (!from || !to) return Promise.resolve(null);
  const { duration = dur('play'), easing = EASE.land, fadeEnd = false, keep = false, flipTo = null } = opts;
  const delay = 0;
  const wrap = document.createElement('div');
  wrap.className = 'fxw';
  wrap.style.cssText = `left:${to.cx - to.w / 2}px;top:${to.cy - to.h / 2}px;width:${to.w}px;height:${to.h}px;--card-w:${to.w}px;--card-h:${to.h}px`;
  wrap.append(node);
  const tr = (b, sx = 1) => `translate(${b.cx - to.cx}px, ${b.cy - to.cy}px) rotate(${b.rot || 0}deg) scale(${(b.w / to.w) * sx}, ${b.h / to.h})`;
  wrap.style.transform = tr(from);
  wrap.style.visibility = delay ? 'hidden' : 'visible';
  layer().append(wrap);
  const frames = [
    { transform: tr(from), opacity: 1, offset: 0 },
    ...(flipTo ? [{ transform: midTr(from, to, 0), offset: 0.5 }] : []),
    ...(fadeEnd ? [{ opacity: 1, offset: 0.78 }] : []),
    { transform: tr(to), opacity: fadeEnd ? 0 : 1, offset: 1 },
  ];
  function midTr(a, b, sx) {
    const m = { cx: (a.cx + b.cx) / 2, cy: (a.cy + b.cy) / 2, w: (a.w + b.w) / 2, h: (a.h + b.h) / 2, rot: ((a.rot || 0) + (b.rot || 0)) / 2 };
    return tr(m, Math.max(0.001, sx));
  }
  const anim = wrap.animate(frames, { duration, easing, delay, fill: 'forwards' });
  if (delay) setTimeout(() => (wrap.style.visibility = 'visible'), delay);
  if (flipTo) setTimeout(() => wrap.replaceChildren(flipTo), delay + duration / 2);
  return anim.finished.then(
    () => {
      if (!keep) requestAnimationFrame(() => wrap.remove());
      return wrap;
    },
    () => {
      wrap.remove();
      return null;
    }
  );
}

/** Yerinde yüz çevirme (arka → yüz ya da tersi). */
export async function flipInPlace(el, newChild) {
  if (!el) return;
  const d = dur('flip');
  await el.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: d, easing: EASE.leave }).finished.catch(() => {});
  el.replaceChildren(newChild);
  await el.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: d, easing: EASE.land }).finished.catch(() => {});
}

/** FLIP: yeniden çizimden önce konumları ölç, sonra eski konumdan yenisine kaydır (eldeki boşluk kapanır). */
export function measure(root, sel = '.khand [data-card]') {
  const m = new Map();
  if (!root) return m;
  root.querySelectorAll(sel).forEach((e) => m.set(e.dataset.card, e.getBoundingClientRect()));
  return m;
}
export function flipFrom(root, before, sel = '.khand [data-card]') {
  if (!root || !before.size) return;
  root.querySelectorAll(sel).forEach((e) => {
    const b = before.get(e.dataset.card);
    if (!b) return;
    const a = e.getBoundingClientRect();
    const dx = b.left - a.left;
    const dy = b.top - a.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    e.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0,0)' }], { duration: dur('reflow'), easing: EASE.move });
  });
}

/** Kart için sabit (kart kimliğine bağlı) küçük sapma: masadaki kart her çizimde aynı yerde, aynı açıda durur. */
export function jitter(id, range = 8) {
  let x = 7;
  for (const ch of String(id)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917) >>> 0;
  x ^= x >>> 16;
  const a = (x % 1000) / 1000;
  const b = ((x >>> 10) % 1000) / 1000;
  const c = ((x >>> 20) % 1000) / 1000;
  return { dx: (a - 0.5) * range, dy: (b - 0.5) * range, rot: (c - 0.5) * range * 2 };
}
