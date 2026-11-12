// Kahvehane havası: her oyuncunun yanında içeceği durur, oyun ilerledikçe azalır; biten tazelenir.
// Botların sevdiği içecek vardır, bitince ocakçıdan yenisini ister, ara sıra herkese çay ısmarlar.
// İnsan üst çubuktaki ☕ düğmesinden kendine söyler ya da "Çaylar benden" der. Ayarlar > Kahvehane ile kapanır.
// Görsel: oyuncu kutusunun (.ks) içinde mutlak konumlu küçük SVG; geliş kenardan kayarak (Web Animations), sıcaklarda hafif buhar.

export const DRINKS = {
  cay: { name: 'Çay', hot: true },
  kahve: { name: 'Türk kahvesi', hot: true },
  oralet: { name: 'Oralet', hot: true },
  salep: { name: 'Salep', hot: true },
  ayran: { name: 'Ayran', hot: false },
  soda: { name: 'Soda', hot: false },
  su: { name: 'Su', hot: false },
  raki: { name: 'Rakı (çay bardağında)', hot: false },
};
const FAVS = ['cay', 'cay', 'cay', 'kahve', 'oralet', 'ayran', 'soda', 'salep', 'cay', 'kahve'];

const ORDER_LINES = {
  cay: ['Ocakçı, bir çay!', 'Bir demli çay alalım', 'Çayım bitti, tazele usta'],
  kahve: ['Bir orta kahve!', 'Usta, bir kahve yap', 'Kahvesiz oynanmaz bu oyun'],
  oralet: ['Bir oralet!', 'Portakallı oralet olsun'],
  salep: ['Bir salep, tarçınlı', 'Salep iyi gider şimdi'],
  ayran: ['Bir ayran!', 'Köpüklü bir ayran'],
  soda: ['Bir soda, limonlu', 'Sade soda alayım'],
  su: ['Bir su verir misin?', 'Su lütfen'],
  raki: ['Ocakçı, bizim "özel çay"dan…', 'Bir açık çay, anladın sen', 'Usta, çay bardağında bir tane', 'Demsiz olsun, beyaz olsun'],
};
const RAKI_SEEN = ['{t}\'in çayı bir garip renkte!', 'O çay değil, belli', 'Bize de o çaydan!', 'Aslan sütü mü o?', 'Kokusu buraya geliyor {t}'];
const TREAT = ['Çaylar benden!', 'Herkese çay, benden', 'Ocakçı, masaya çay!'];
const THANKS = ['Sağ ol {t}, eksik olma', 'Eline sağlık {t}', 'Afiyet olsun bize', 'Teşekkürler {t}'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/** İçecek SVG'si. level: 0..1, uid: tanım kimliklerinin öneki (sayfada benzersiz olmalı) */
// Kullanıcının düzenleyebileceği SVG dosyaları: assets/drinks/<tür>.svg. Dosya varsa çizim ondan gelir; sıvı seviyesi
// dosyadaki id="sivi" öğesine uygulanır (data-sivi-ust / data-sivi-alt arası kırpılır; data-sivi-mod="kaydir" ise aşağı kayar).
const FILE_SVG = {};
export function loadDrinkFiles(base = 'assets/drinks/') {
  if (typeof fetch === 'undefined') return Promise.resolve();
  return Promise.all(Object.keys(DRINKS).map((k) => fetch(`${base}${k}.svg`).then((r) => (r.ok ? r.text() : null)).then((t) => {
    if (t && t.includes('<svg')) FILE_SVG[k] = t;
  }).catch(() => {})));
}
function fromFile(text, level, uid) {
  // kimlikleri bu çizime özel yap (sayfada birden çok bardak var)
  let t = text.replace(/<\?xml[^>]*>/, '').replace(/id="([^"]+)"/g, `id="${uid}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${uid}-$1)`).replace(/href="#([^"]+)"/g, `href="#${uid}-$1"`);
  const doc = new DOMParser().parseFromString(t, 'image/svg+xml');
  const svg = doc.documentElement;
  const sivi = doc.getElementById(`${uid}-sivi`);
  if (sivi) {
    const ust = +svg.getAttribute('data-sivi-ust') || 0;
    const alt = +svg.getAttribute('data-sivi-alt') || 54;
    const ns = 'http://www.w3.org/2000/svg';
    if (svg.getAttribute('data-sivi-mod') === 'kaydir') {
      sivi.setAttribute('transform', `translate(0 ${((1 - level) * (alt - ust)).toFixed(2)})`);
      if (level <= 0.05) sivi.setAttribute('opacity', '0');
    } else {
      const y = alt - (alt - ust) * level;
      const cp = doc.createElementNS(ns, 'clipPath');
      cp.setAttribute('id', `${uid}-lv`);
      const r = doc.createElementNS(ns, 'rect');
      r.setAttribute('x', '-50');
      r.setAttribute('y', y.toFixed(2));
      r.setAttribute('width', '200');
      r.setAttribute('height', '200');
      cp.append(r);
      svg.insertBefore(cp, svg.firstChild);
      const g = doc.createElementNS(ns, 'g');
      g.setAttribute('clip-path', `url(#${uid}-lv)`);
      sivi.replaceWith(g);
      g.append(sivi);
    }
  }
  svg.setAttribute('aria-hidden', 'true');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  return new XMLSerializer().serializeToString(svg);
}

export function drinkSvg(type, level, uid, { file = false } = {}) {
  if (!file && FILE_SVG[type]) {
    try {
      return fromFile(FILE_SVG[type], Math.max(0, Math.min(1, level)), uid);
    } catch {}
  }
  const L = file ? 1 : Math.max(0, Math.min(1, level));
  let sv = null; // dosya için sıvı aralığı
  // ince belli çay bardağı (tulip): ağız geniş, bel ince, dip hafif şişkin
  const tulip = 'M8.5 7C9.5 15 15 19.5 14.6 26.5C14.2 31.5 11 35.5 11.8 41C12.4 45.2 14.4 47.3 16 47.6H24C25.6 47.3 27.6 45.2 28.2 41C29 35.5 25.8 31.5 25.4 26.5C25 19.5 30.5 15 31.5 7Z';
  const straight = 'M10 8L13 47H27L30 8Z';
  const cup = 'M6.5 21H31.5V31C31.5 39.5 26 44.5 19 44.5C12 44.5 6.5 39.5 6.5 31Z';
  const liquid = { cay: '#a3361a', oralet: '#f0861f', ayran: '#f6f3ea', su: '#bfe3f5', kahve: '#3b2414', salep: '#e8d6b4', soda: '#d9f2e4', raki: '#eceee6' }[type];
  const grad = {
    cay: ['#d2541f', '#8a2309', '#5e1504'],
    oralet: ['#ffb24a', '#f0861f', '#c2580d'],
    raki: ['#fbfbf6', '#ecefe8', '#d9ded6'],
  }[type];
  const defs = grad ? `<linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${grad[0]}"/><stop offset=".55" stop-color="${grad[1]}"/><stop offset="1" stop-color="${grad[2]}"/></linearGradient>` : '';
  // tabak: beyaz porselen, kenarında kırmızı süs
  const saucer = (y = 49.6) => `<ellipse cx="20" cy="${y}" rx="17.5" ry="3.9" fill="#f7f4ee" stroke="#b9ae9a" stroke-width=".7"/>` +
    `<ellipse cx="20" cy="${y}" rx="14.6" ry="2.9" fill="none" stroke="#c0392b" stroke-width=".9" stroke-dasharray="2.4 1.6"/>` +
    `<ellipse cx="20" cy="${y - 0.3}" rx="8" ry="1.6" fill="#ece6da"/>`;
  const fill = (shape, top, bottom, paint) => {
    const y = bottom - (bottom - top) * L;
    sv = { ust: top, alt: bottom };
    const inner = `<rect x="0" y="${y.toFixed(1)}" width="40" height="${(bottom - y + 2).toFixed(1)}" fill="${paint}" clip-path="url(#${uid})"/>` +
      (L > 0.04 ? `<ellipse cx="20" cy="${y.toFixed(1)}" rx="${(y < 22 ? 9 : 6).toFixed(1)}" ry=".9" fill="rgba(255,255,255,.28)" clip-path="url(#${uid})"/>` : '');
    return `<clipPath id="${uid}"><path d="${shape}"/></clipPath>${file ? `<g id="sivi">${inner}</g>` : inner}`;
  };
  let body;
  if (type === 'cay' || type === 'oralet' || type === 'raki') {
    const spoon = type === 'raki' ? '' :
      // kaşık: bardağın içinden çaprazlama, ağızdan dışarı taşar
      '<path d="M29.5 1.5L18.5 41" stroke="#c9ccd1" stroke-width="1.6" stroke-linecap="round"/><path d="M29.5 1.5L26.6 12" stroke="#f4f5f7" stroke-width=".6" stroke-linecap="round"/>' +
      '<ellipse cx="18" cy="43" rx="1.9" ry="3.1" transform="rotate(16 18 43)" fill="#b8bcc2" opacity=".8"/>';
    body = `${saucer()}${fill(tulip, 10, 47.5, `url(#${uid}g)`)}${spoon}` +
      `<path d="${tulip}" fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.9)" stroke-width="1.1"/>` +
      '<path d="M11.5 10C12.5 16 16.2 20 15.9 26" stroke="rgba(255,255,255,.75)" stroke-width="1.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M13.4 37C13.2 40.5 14 43 15.2 44.6" stroke="rgba(255,255,255,.5)" stroke-width="1" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="20" cy="7" rx="11.5" ry="1.3" fill="none" stroke="rgba(255,255,255,.9)" stroke-width=".9"/>';
  } else if (type === 'ayran' || type === 'su') {
    body = `${fill(straight, 10, 47, liquid)}<path d="${straight}" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.85)" stroke-width="1.2"/>${type === 'ayran' && L > 0.15 ? `<ellipse cx="20" cy="${(47 - 37 * L).toFixed(1)}" rx="${(8 + 1.5 * L).toFixed(1)}" ry="1.8" fill="#fff"/>` : ''}`;
  } else if (type === 'soda') {
    body = `<path d="M17 4H23V12C27 15 28 18 28 22V46C28 47.5 27 48 25.5 48H14.5C13 48 12 47.5 12 46V22C12 18 13 15 17 12Z" fill="${L > 0.05 ? '#3d9b66' : '#7fbf98'}" fill-opacity=".85" stroke="#1d5c3a" stroke-width="1"/><rect x="13" y="26" width="14" height="10" rx="1" fill="#f6ecd6"/><rect x="16.5" y="2" width="7" height="3" rx="1" fill="#c9c9c9"/>`;
  } else {
    // porselen fincan: altın ağız, kırmızı süslü kuşak, altın kulp; kahvede köpük
    // fincanın içi görünmez: yüzey ağızdan biraz aşağı iner, daralır
    const top = 22.2 + (1 - L) * 3.5;
    const foam = type === 'kahve'
      ? `<ellipse cx="19" cy="${top.toFixed(1)}" rx="${(12 - (1 - L) * 1.5).toFixed(1)}" ry="2.3" fill="#b07a49"/><ellipse cx="18" cy="${(top - 0.3).toFixed(1)}" rx="${(8 - (1 - L) * 4).toFixed(1)}" ry="1.3" fill="#cf9c68"/>` +
        `<circle cx="14" cy="${(top + 0.4).toFixed(1)}" r=".6" fill="#e3bd8c"/><circle cx="23.5" cy="${(top - 0.2).toFixed(1)}" r=".5" fill="#e3bd8c"/><circle cx="20" cy="${(top + 0.9).toFixed(1)}" r=".45" fill="#5a3418"/>`
      : `<ellipse cx="19" cy="${top.toFixed(1)}" rx="${(12 - (1 - L) * 1.5).toFixed(1)}" ry="2.3" fill="${liquid}"/><circle cx="16" cy="${top.toFixed(1)}" r=".8" fill="#8a4b20"/><circle cx="21" cy="${(top - 0.6).toFixed(1)}" r=".8" fill="#8a4b20"/>`;
    body = `${saucer(48.8)}` +
      `<path d="M31 24C38.5 22.5 39.5 34 30.5 35" fill="none" stroke="#c99a3c" stroke-width="2.3" stroke-linecap="round"/><path d="M36.6 25.5L38.6 24.2" stroke="#c99a3c" stroke-width="1.4" stroke-linecap="round"/>` +
      `<path d="${cup}" fill="#fbfaf6" stroke="#a89c86" stroke-width=".8"/>` +
      '<path d="M7 26.5H31" stroke="#b02a1e" stroke-width="2.4"/><path d="M7 29H31" stroke="#c99a3c" stroke-width=".6"/><path d="M7 24.2H31" stroke="#c99a3c" stroke-width=".6"/>' +
      '<circle cx="19" cy="34.5" r="4.2" fill="#b02a1e" stroke="#c99a3c" stroke-width=".7"/><circle cx="19" cy="34.5" r="2.2" fill="#fbfaf6"/><circle cx="19" cy="34.5" r="1" fill="#b02a1e"/>' +
      '<path d="M9.5 35C10.5 38.5 12.5 40.5 15 41.6M28.5 35C27.5 38.5 25.5 40.5 23 41.6" stroke="#2e7d4f" stroke-width=".8" fill="none"/>' +
      (file ? `<g id="sivi">${foam}</g>` : L > 0.05 ? foam : '<ellipse cx="19" cy="38" rx="6" ry="1.5" fill="#3b2414" opacity=".7"/>') +
      '<ellipse cx="19" cy="21" rx="12.5" ry="2.2" fill="none" stroke="#c99a3c" stroke-width="1.1"/>' +
      '<path d="M9.5 27C10.3 33 12.4 37.5 15.5 39.8" stroke="rgba(255,255,255,.7)" stroke-width="1" fill="none"/>';
  }
  if (file) {
    if (type === 'kahve' || type === 'salep') sv = { ust: 22.2, alt: 25.7, mod: 'kaydir' };
    const a = sv ? ` data-sivi-ust="${sv.ust}" data-sivi-alt="${sv.alt}"${sv.mod ? ` data-sivi-mod="${sv.mod}"` : ''}` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 54" width="400" height="540"${a}>\n<!-- ${DRINKS[type].name}: id="sivi" içeceğin kendisi (seviye oyunda ayarlanır). Diğer her şeyi değiştirebilirsin. -->\n<defs>${defs}</defs>${body}</svg>\n`;
  }
  return `<svg viewBox="0 0 40 54" aria-hidden="true" focusable="false"><defs>${defs}</defs>${body}</svg>`;
}

/**
 * deps: { h, settings, seats(), name(i), isBot(i), chat }
 */
export function createCafe(deps) {
  const { h, settings, chat } = deps;
  const on = () => settings.get('cafe') !== false;
  let drinks = {}; // seat (ya da 'y' yancı) → { type, level, fresh, at }
  const yOn = () => deps.yanci?.on();
  let pendingOrders = [];

  const favOf = (i) => {
    const id = String(deps.seats()[i]?.id ?? i);
    let x = 0;
    for (const ch of id) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
    return FAVS[x % FAVS.length];
  };

  function serve(i, type, delay = 0) {
    const t = setTimeout(() => {
      drinks[i] = { type, level: 1, fresh: true, at: performance.now() };
      deps.render();
    }, delay);
    pendingOrders.push(t);
  }

  function order(i, type, { say = true, delay = 1600 } = {}) {
    if (say && deps.isBot(i)) chat.say(i, pick(ORDER_LINES[type]));
    if (drinks[i]) drinks[i].ordered = true;
    serve(i, type, delay);
  }

  /** Masaya başlarken: herkesin önünde birer içecek (botlar sevdiğini, sen son seçtiğini) */
  function start() {
    reset();
    if (!on()) return;
    const seats = deps.seats();
    seats.forEach((_, i) => {
      const type = deps.isBot(i) ? favOf(i) : settings.get('myDrink') || 'cay';
      serve(i, type, 500 + i * 450);
    });
    if (yOn()) serve('y', 'cay', 700 + seats.length * 450);
  }

  /** Her hamlede: hamleyi yapan bir yudum alır; biten botlar yeni ister; ara sıra biri çay ısmarlar */
  function onMove(seat) {
    if (!on()) return;
    const d = drinks[seat];
    if (d && d.level > 0) d.level = Math.max(0, d.level - (0.05 + Math.random() * 0.07));
    deps.seats().forEach((_, i) => {
      const x = drinks[i];
      if (!x || x.level > 0 || x.ordered) return;
      if (deps.isBot(i) && Math.random() < 0.35) order(i, Math.random() < 0.75 ? favOf(i) : pick(Object.keys(DRINKS)));
    });
    // yancı da yudumlar; bitince ocakçıya seslenir
    const y = drinks.y;
    if (y && yOn() && y.level > 0) {
      y.level = Math.max(0, y.level - Math.random() * 0.05);
      if (y.level === 0 && !y.ordered) {
        y.ordered = true;
        deps.yanci.refill();
        serve('y', 'cay', 2200);
      }
    }
    if (Math.random() < 0.012) {
      const bots = deps.seats().map((_, i) => i).filter((i) => deps.isBot(i));
      if (bots.length) treat(pick(bots));
    }
  }

  /** Herkese çay: ısmarlayan söyler, diğerleri teşekkür eder */
  function treat(by) {
    if (!on()) return;
    chat.say(by, pick(TREAT));
    deps.seats().forEach((_, i) => {
      if (i !== by) serve(i, 'cay', 1400 + i * 300);
    });
    if (drinks[by]?.level < 0.5) serve(by, 'cay', 1400);
    if (yOn()) {
      serve('y', 'cay', 1500);
      setTimeout(() => deps.yanci.thanks(), 2000);
    }
    const bots = deps.seats().map((_, i) => i).filter((i) => i !== by && deps.isBot(i));
    if (bots.length) setTimeout(() => chat.say(pick(bots), pick(THANKS).replace('{t}', deps.name(by) === 'Oyuncu' ? 'kardeşim' : deps.name(by))), 2600);
  }

  function reset() {
    pendingOrders.forEach(clearTimeout);
    pendingOrders = [];
    drinks = {};
    Object.keys(els).forEach((k) => delete els[k]);
  }

  // İçecek öğeleri her çizimde yeniden yaratılmaz: aynı öğe yeni çizime taşınır, yalnız seviye değişince bardak tazelenir.
  // Buhar Web Animations ile döner (CSS animasyonu öğe taşınınca baştan başlardı).
  // Yalnız taze doldurulan içecek tüter (~20 sn), sonra durur: sürekli dönen animasyon telefonda kart uçuşlarını takıyordu.
  const els = {};
  function steamEl(k) {
    const s = h('i', { class: `steam s${k}` });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      s.animate([{ transform: 'translateY(4px) scaleY(.6)', opacity: 0 }, { transform: 'translateY(-1px) scaleY(.9)', opacity: 0.75, offset: 0.4 }, { transform: 'translateY(-9px) scaleY(1.3)', opacity: 0 }],
        { duration: 2600, iterations: 7, delay: k === 2 ? 1300 : 0, easing: 'ease-in-out' }).finished.then(() => s.remove(), () => {});
    } else s.remove();
    return s;
  }
  /** Oyuncu kutusuna takılacak içecek öğesi; dokununca ısmarlama (kendine/herkese ya da yalnız o kişiye) */
  function node(i) {
    if (!on()) return null;
    const d = drinks[i];
    if (!d) return null;
    const hot = DRINKS[d.type].hot && d.level > 0.4;
    const lvl = Math.round(d.level * 20);
    let c = els[i];
    if (!c || c.type !== d.type) {
      const el = h('span', { class: 'drink', 'data-drink': String(i), role: 'button', tabindex: '0' });
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        offer(i);
      });
      const cup = h('span', { class: 'cup' });
      c = els[i] = { el, cup, type: d.type, lvl: -1, steam: null };
      el.append(cup);
    }
    c.el.className = `drink d-${d.type}${hot ? ' hot' : ''}`;
    c.el.title = i === 0 ? `${DRINKS[d.type].name} · dokun: ısmarla` : `${DRINKS[d.type].name} · dokun: ${i === 'y' ? 'Şerif' : deps.name(i)}'e ısmarla`;
    if (c.lvl !== lvl) {
      c.lvl = lvl;
      c.cup.innerHTML = drinkSvg(d.type, d.level, `dk${i}`);
    }
    const fresh = c.seen == null || d.level > c.seen + 0.2 || c.seenType !== d.type; // yeni geldi ya da tazelendi
    c.seen = d.level;
    c.seenType = d.type;
    if (hot && fresh) {
      c.steam?.forEach((s) => s.remove());
      c.steam = [steamEl(1), steamEl(2)];
      c.el.append(...c.steam);
    } else if (!hot && c.steam) {
      c.steam.forEach((s) => s.remove());
      c.steam = null;
    }
    return c.el;
  }

  /** İçeceğe dokununca: kendi içeceğin → kendine ya da herkese; başkasınınki → yalnız ona */
  function offer(i) {
    if (!deps.dialog) return;
    if (i === 0) return menu(deps.dialog);
    const who = i === 'y' ? (settings.get('yanciName') || 'Şerif') : deps.name(i);
    const close = (ev) => ev.target.closest('.overlay')?.remove();
    const grid = h('div', { class: 'cafegrid' }, Object.entries(DRINKS).map(([k, v]) => {
      const b = h('button', { class: 'cafeitem', type: 'button', onclick: (ev) => {
        close(ev);
        chat.say(0, `${who}, ${v.name.toLowerCase()} benden!`, 'me');
        serve(i, k, 1400);
        if (i === 'y') setTimeout(() => deps.yanci.thanks(), 1900);
        else if (deps.isBot(i)) setTimeout(() => chat.say(i, pick(THANKS).replace('{t}', deps.name(0))), 2200);
      } }, h('span', { class: 'ci' }), h('span', {}, v.name));
      b.firstChild.innerHTML = drinkSvg(k, 1, `o${k}`);
      return b;
    }));
    deps.dialog(h('div', {}, h('div', { class: 'hint' }, `${who}'e ne ısmarlayalım?`), grid), [['Vazgeç']], 'Kahvehane');
  }

  /** Çizimden sonra: yeni gelen içecek kenardan kayarak gelir */
  function afterRender(body) {
    Object.entries(drinks).forEach(([i, d]) => {
      if (!d?.fresh) return;
      d.fresh = false;
      const el = body.querySelector(`[data-drink="${i}"]`);
      if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 < innerWidth / 2 ? -r.right - 20 : innerWidth - r.left + 20;
      el.animate([{ transform: `translateX(${dx}px)`, opacity: 0.4 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }

  /** ☕ menüsü (insan): küçük resimli düğmeler, ızgara */
  function menu(dialog) {
    const close = (ev) => ev.target.closest('.overlay')?.remove();
    const item = (label, icon, fn) => {
      const b = h('button', { class: 'cafeitem', type: 'button', onclick: (ev) => { close(ev); fn(); } }, h('span', { class: 'ci' }), h('span', {}, label));
      b.firstChild.innerHTML = icon;
      return b;
    };
    const grid = h('div', { class: 'cafegrid' }, Object.entries(DRINKS).map(([k, v]) => item(`Bana ${v.name.toLowerCase()}`, drinkSvg(k, 1, `m${k}`), () => {
      settings.set('myDrink', k);
      chat.say(0, k === 'raki' ? 'Ocakçı, bana bir "çay"… beyazından 😉' : `Bana bir ${v.name.toLowerCase()}`, 'me');
      order(0, k, { say: false, delay: 1500 });
      if (k === 'raki') {
        // masadakiler fark eder
        const bots = deps.seats().map((_, i) => i).filter((i) => deps.isBot(i));
        if (bots.length) setTimeout(() => chat.say(pick(bots), pick(RAKI_SEEN).replace('{t}', deps.name(0))), 2600);
      }
    })), item('Herkese çay benden!', drinkSvg('cay', 1, 'mtreat'), () => {
      chat.say(0, 'Çaylar benden!', 'me');
      deps.seats().forEach((_, i) => i !== 0 && serve(i, 'cay', 1400 + i * 300));
      if (yOn()) {
        serve('y', 'cay', 1300);
        setTimeout(() => deps.yanci.thanks(), 1900);
      }
      const bots = deps.seats().map((_, i) => i).filter((i) => deps.isBot(i));
      bots.slice(0, 2).forEach((bt, k) => setTimeout(() => chat.say(bt, pick(THANKS).replace('{t}', deps.name(0) === 'Oyuncu' ? 'kardeşim' : deps.name(0))), 2400 + k * 1300));
    }));
    grid.lastChild.classList.add('treat');
    dialog(h('div', {}, h('div', { class: 'hint' }, 'Ocakçıya ne söyleyelim?'), grid), [['Vazgeç']], 'Kahvehane');
  }

  return { start, onMove, treat, node, afterRender, menu, reset, on };
}
