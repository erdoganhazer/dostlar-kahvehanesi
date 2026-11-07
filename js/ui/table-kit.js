// Ortak masa iskeleti: oyuncu koltukları, maç döngüsü, insan bekleme, sonuç penceresi ve animasyon yardımcıları.
// Bütün oyun ekranları bunu kullanır. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
//
// spec: {
//   title, game, players(): n, makeConfig(seats)?, menu?: [[etiket, fn(ctx)]], rules?(h),
//   reset(ctx)?, onStart(ctx)? async (açılış dağıtımı), onTurn(ctx)?, onMove(e, ctx, before)? async (koreografi),
//   render(ctx) -> Node[]  (STATİK çizim; CSS animasyonu yok),
//   endHead(winners, ctx, res)?, fmtScore(score, seat, ctx)?, maxThink?,
//   hintMarks?(move, state) → {src:[kart], dst:[kart], piles:[yığın]} (yancı ipucunda vurgulanacaklar),
//   solo? (tek kişilik: süre yok, sıra sesi yok, yancı her hamleyi yorumlamaz), chance? (şans oyunu: yancı hamleni eleştirmez)
// }
import { Table } from '../core/engine.js';
import { makeRng } from '../core/rng.js';
import { parseCard } from './cards-util.js';
import * as A from './anim.js';
import { advise, review } from './tutor.js';
import { createChat } from './chat.js';
import { createCafe } from './kahvehane.js';
import { createYanci } from './yanci.js';
import { sfx } from './sfx.js';
import { PACE_OPTIONS, ANIM_OPTIONS } from '../players/settings.js';

/** Yatay yerleşim (css/avrora.css'teki @media ile aynı koşul) */
export const LANDSCAPE = matchMedia('(orientation: landscape) and (min-aspect-ratio: 5/4)');

const POSITIONS = { 1: ['bottom'], 2: ['bottom', 'top'], 3: ['bottom', 'right', 'left'], 4: ['bottom', 'right', 'top', 'left'] };
export const PILE_W = 52;
export const PILE_H = 74;

export function createMatchScreen({ h, shell, avatarNode, cardEl, roster, settings, go, dialog, openSettings }, spec) {
  let alive = true;
  let token = 0;
  let tok = 0;
  let state = null;
  let seats = [];
  let pending = null;
  let rejectPending = null;
  const body = h('div', { class: 'felt king' });
  // ---- Süre halkası (online hissi): sırası gelenin avatarının çevresinde azalır ----
  const BOT_LIMIT = 12000; // görsel süre; bot bunun bir kısmında oynar
  let clock = null; // { seat, start, dur, last, onTimeout, nudged }
  let raf = 0;
  function startClock(seat, dur, onTimeout = null) {
    clock = { seat, start: performance.now(), dur, last: null, onTimeout, nudged: false };
    cancelAnimationFrame(raf);
    const tick = (now) => {
      if (!clock || !alive) return;
      if (clock.last != null && document.querySelector('.overlay, .setov')) clock.start += now - clock.last; // pencere açıkken durur
      clock.last = now;
      const t = Math.max(0, 1 - (now - clock.start) / clock.dur);
      const el = body.querySelector(`.ks[data-seat="${clock.seat}"] .avw`);
      if (el) {
        el.classList.add('clock');
        el.style.setProperty('--t', t.toFixed(3));
        el.style.setProperty('--c', t < 0.25 ? '#ff5a3c' : t < 0.5 ? '#ffb02e' : '#7be05a');
      }
      // süre azalıyor: son 5 saniyede her saniye tik (son 3'te daha tiz)
      if (clock.seat === 0 && clock.onTimeout) {
        const left = Math.ceil((t * clock.dur) / 1000);
        if (left <= 5 && left > 0 && left !== clock.lastTick) {
          clock.lastTick = left;
          sfx.tick(left <= 3);
        }
      }
      if (clock.seat === 0 && !clock.nudged && t < 0.45 && clock.onTimeout) {
        clock.nudged = true;
        chat.onHumanSlow();
      }
      if (t <= 0 && clock.onTimeout) {
        const f = clock.onTimeout;
        clock.onTimeout = null;
        f();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function stopClock() {
    clock = null;
    cancelAnimationFrame(raf);
    body.querySelectorAll('.avw.clock').forEach((e) => e.classList.remove('clock'));
  }
  /** Botun düşünme süresi: hıza göre değişken, ara sıra uzun düşünür; tek seçenekte kısa. */
  function thinkTime(info, forced, mult) {
    const r = (a, b) => a + Math.random() * (b - a);
    const sp = roster.get(info.id)?.speed ?? 'normal';
    const [a, b] = forced ? [350, 900] : sp === 'hizli' ? [450, 1500] : sp === 'yavas' ? [1300, 3800] : [800, 2600];
    let ms = r(a, b);
    if (!forced && Math.random() < 0.12) ms += r(1200, 2800);
    const scale = spec.maxThink ? Math.min(1, spec.maxThink / 700) : 1;
    return ms * scale * mult;
  }
  let timedOut = false;

  // Yönerge: sıra sendeyken öneri, hamlenden sonra değerlendirme (js/ui/tutor.js)
  let advice = null;
  // Yancı ipucunda önerilen kartlar ve gideceği yer vurgulanır (9 sn ya da hamle yapılana kadar)
  let mark = null; // { src:[kart], dst:[kart], piles:[yığın] }
  let markT = 0;
  function marksFor(m) {
    if (!m) return null;
    const own = spec.hintMarks?.(m, state);
    if (own) return own;
    const src = m.cards || (m.c ? [m.c] : m.card ? [m.card] : []);
    const dst = m.take ? [...m.take] : [];
    return src.length || dst.length ? { src, dst, piles: [] } : null;
  }
  function showMarks() {
    clearTimeout(markT);
    mark = advice && pending ? marksFor(advice.best) : null;
    if (mark) markT = setTimeout(() => { mark = null; safeRender(); }, 9000);
  }
  function applyMarks() {
    if (!mark) return;
    const tag = (sel, cls) => body.querySelectorAll(sel).forEach((e) => e.classList.add(cls));
    for (const id of mark.src) tag(`[data-card="${CSS.escape(id)}"]`, 'hintsrc');
    for (const id of mark.dst) tag(`[data-card="${CSS.escape(id)}"]`, 'hintdst');
    for (const id of mark.piles || []) tag(`[data-pile="${CSS.escape(id)}"]`, 'hintdst');
  }
  let lastReview = null;
  // Yancı (js/ui/yanci.js): oyun sohbeti onun balonundan gelir; resmine dokununca ipucu verir; altındaki 🔇 ile susar.
  const yanci = createYanci({ h, settings });
  const tutorOn = () => false; // sürekli öneri yok; ipucu yalnız yancının resmine dokununca
  // Sohbet (js/ui/chat.js)
  const chat = createChat({
    h, body, settings,
    seats: () => seats,
    name: (i) => seats[i]?.name ?? '?',
    pos: (i) => POSITIONS[seats.length]?.[i] ?? 'bottom',
    isBot: (i) => seats[i]?.kind === 'bot',
    styleOf: (i) => roster.get(seats[i]?.id)?.style ?? 'dengeli',
    render: () => safeRender(),
  });

  // Kahvehane: oyuncuların yanında içecekler (js/ui/kahvehane.js). Çizim uçuş sırasında yapılmaz (yer tutucular bozulmasın).
  const cafe = createCafe({
    h, settings, chat, dialog,
    seats: () => seats,
    name: (i) => seats[i]?.name ?? '?',
    isBot: (i) => seats[i]?.kind === 'bot',
    render: () => safeRender(),
    yanci,
  });
  let safeT = 0;
  function safeRender() {
    clearTimeout(safeT);
    const again = () => {
      if (!alive || !body.isConnected) return;
      if (document.querySelector('#fx .fxw')) {
        safeT = setTimeout(again, 200);
        return;
      }
      render();
    };
    safeT = setTimeout(again, 30);
  }
  const cafeBtn = h('button', { class: 'cafebtn', hidden: settings.get('cafe') === false, 'aria-label': 'İçecek söyle', onclick: () => cafe.menu(dialog) }, h('span', { 'aria-hidden': 'true', style: 'font-size:18px;line-height:1' }, '☕'));

  // ---- Mola: oyunu durdur (botlar düşünmez, sayaç durur); sayfa gizlenince kendiliğinden ----
  let paused = false;
  let waiters = [];
  const whilePaused = () => (paused ? new Promise((r) => waiters.push(r)) : null);
  function resume() {
    paused = false;
    pauseBtn.classList.remove('on');
    const w = waiters;
    waiters = [];
    w.forEach((f) => f());
  }
  function pause() {
    if (paused || !alive || !state || spec.game.isOver(state)) return;
    paused = true;
    pauseBtn.classList.add('on');
    pauseDialog();
  }
  /** Mola penceresi: devam, yazboz, ayarlar (ikisi de oyun durmuşken açılır, kapanınca molaya dönülür) */
  function pauseDialog() {
    if (!paused || !alive) return;
    const btns = [['Devam et', resume]];
    if (spec.yazboz !== false) btns.push(['Yazboz', () => showSheet(pauseDialog)]);
    if (openSettings) btns.push(['Ayarlar', () => openSettings(() => {
      safeRender();
      pauseDialog();
    })]);
    dialog(h('div', {}, h('div', { class: 'pausebig', 'aria-hidden': 'true' }, '⏸'), h('div', {}, 'Oyun durduruldu. Botlar ve sayaç bekliyor.')), btns, 'Mola');
  }

  // ---- Yazboz: kahvehanedeki kâğıt gibi; her elin satırı, en altta toplam ----
  // spec.tally(state) → { head: 'Puan'|'Ceza', totals: [...] } (vars.: oyunun puanı). spec.yazbozRow(e, before) özel satır verebilir.
  // spec.yazboz === false: gösterilmez (tek ellik / fişli oyunlar).
  let sheetRows = [];
  const tallyOf = (st) => (spec.tally ? spec.tally(st) : { head: 'Puan', totals: spec.game.scores(st) });
  function sheetRecord(e, before) {
    if (spec.yazboz === false) return;
    try {
      if (spec.yazbozRow) {
        const r = spec.yazbozRow(e, before);
        if (r) sheetRows.push(r);
        return;
      }
      const ev = e.event || {};
      const endish = ev.roundEnd || ev.dealEnd || spec.game.isOver(e.state);
      if (!endish) return;
      const a = tallyOf(before).totals;
      const b = tallyOf(e.state).totals;
      if (a.every((x, i) => x === b[i])) return;
      sheetRows.push({ cells: b.map((x, i) => x - a[i]) });
    } catch (err) {
      console.error(err);
    }
  }
  const short = (s) => (s.length > 7 ? `${s.slice(0, 6)}.` : s);
  const sgn = (x) => (typeof x === 'number' && x > 0 && tallyOf(state).head === 'Puan' ? `+${x}` : `${x}`);
  /** Masanın köşesindeki küçük yazboz: isimler ve toplam; dokununca tam kâğıt */
  function sheetMini() {
    if (spec.yazboz === false || !state) return null;
    const t = tallyOf(state);
    return h('button', { class: 'ybz mini', title: 'Yazboz', onclick: () => showSheet() },
      h('div', { class: 'ybzh' }, t.head),
      seats.map((s, i) => h('div', { class: 'ybzr' }, h('span', {}, short(ctx.name(i))), h('b', {}, `${t.totals[i]}`))));
  }
  function showSheet(after) {
    if (!state) return;
    const t = tallyOf(state);
    const names = seats.map((_, i) => ctx.name(i));
    const paper = h('div', { class: 'ybz full' },
      h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, ''), names.map((n) => h('th', {}, short(n))))),
        h('tbody', {},
          sheetRows.length ? sheetRows.map((r, k) => h('tr', {}, h('td', { class: 'rl' }, r.label || `${k + 1}`), r.cells.map((c) => h('td', {}, typeof c === 'number' ? (c ? sgn(c) : '—') : c)))) :
            h('tr', {}, h('td', { colspan: names.length + 1, class: 'rl' }, 'Henüz el bitmedi'))),
        h('tfoot', {}, h('tr', {}, h('td', { class: 'rl' }, 'TOPLAM'), t.totals.map((x) => h('td', {}, `${x}`))))),
      t.note ? h('div', { class: 'ybzn' }, t.note) : null);
    dialog(paper, [['Kapat', after]], `Yazboz · ${t.head}`);
  }
  const pauseBtn = h('button', { class: 'pausebtn', 'aria-label': 'Oyunu durdur', onclick: () => pause() }, h('span', { class: 'pz', 'aria-hidden': 'true' }, h('i'), h('i')));
  const onVis = () => {
    if (document.hidden && body.isConnected) pause();
  };
  document.addEventListener('visibilitychange', onVis);

  // Üst çubuk: geri + başlık + ☰ menü (Skor, Kurallar, Yönerge, Yeni oyun)
  const dd = h('div', { class: 'dd', hidden: true });
  const closeDd = () => (dd.hidden = true);
  // Hız: kart hızı (dağıtma/atma/kurpiye) ve botların düşünme süresi; oyun sürerken hemen geçerli
  function speedDialog() {
    const row = (title, key, opts, apply) => h('div', { class: 'f' }, h('span', {}, title),
      h('div', { class: 'speedrow' }, opts.map((o) => h('button', {
        class: `btn small${settings.get(key) === o.v ? ' on' : ''}`,
        onclick: (ev) => {
          settings.set(key, o.v);
          apply?.(o.v);
          ev.currentTarget.parentElement.querySelectorAll('.btn').forEach((b) => b.classList.toggle('on', b === ev.currentTarget));
        },
      }, o.label))));
    dialog(h('div', { class: 'speedbox' },
      row('Kart hızı (dağıtma, atma, kurpiye)', 'animSpeed', ANIM_OPTIONS, (v) => A.setPace(v)),
      row('Botların düşünme hızı', 'paceMult', PACE_OPTIONS)), [['Tamam']], 'Hız');
  }
  const item = (label, fn) => h('button', { onclick: () => { closeDd(); fn(); } }, label);
  dd.append(
    ...(spec.menu || []).map(([label, fn]) => item(label, () => fn(ctx))),
    item('Mola ver', () => pause()),
    ...(spec.yazboz === false ? [] : [item('Yazboz', () => showSheet())]),
    item('Hız', () => speedDialog()),
    ...(openSettings ? [item('Ayarlar', () => {
      const was = paused;
      pause();
      // mola penceresi açıldıysa kaldır, doğrudan ayarlara geç; kapanınca molaya dönülür
      if (paused && !was) document.querySelector('.overlay')?.remove();
      openSettings(() => {
        safeRender();
        if (paused) pauseDialog();
      });
    })] : []),
    item('Kurallar', () => spec.rules && dialog(spec.rules(h), [['Tamam']], `${spec.title} kuralları`)),
    item('Yeni oyun', () => newGame(true)),
    item('Ana menü', () => go('menu')),
  );
  const ham = h('button', { class: 'ham', 'aria-label': 'Menü', onclick: (ev) => { ev.stopPropagation(); dd.hidden = !dd.hidden; } },
    h('span', { 'aria-hidden': 'true', style: 'font-size:18px;line-height:1' }, '☰'));
  const menu = [h('button', { class: 'back', 'aria-label': 'Ana menüye dön', onclick: () => go('menu') }, '‹'), pauseBtn, cafeBtn, chat.button(), ham, dd];
  document.addEventListener('click', (ev) => { if (!dd.hidden && !dd.contains(ev.target) && ev.target !== ham) closeDd(); });
  const el = shell(spec.title, menu, body);
  const ok = () => alive && tok === token;
  const guard = () => {
    if (!ok()) throw new Error('iptal');
  };

  const ctx = {
    h,
    cardEl,
    parseCard,
    A,
    body,
    get state() {
      return state;
    },
    get seats() {
      return seats;
    },
    get awaiting() {
      return !!pending;
    },
    n: 0,
    /** Uçuşta olan kartlar: statik çizimde yeri ayrılır ama görünmez (data-card ile). */
    pend: new Set(),
    /** Koltuk başına kart sayısı düzeltmesi (kart henüz varmadıysa -1 gibi). */
    adj: [],
    view: (seat = 0) => spec.game.viewFor(state, seat),
    name: (i) => seats[i]?.name ?? '?',
    avatar: (i) => (i === 0 ? avatarNode(settings.get('humanPhoto'), settings.get('humanAvatar')) : avatarNode(roster.get(seats[i]?.id)?.photo, roster.get(seats[i]?.id)?.avatar)),
    render,
    dialog,
    respond(move) {
      if (!pending) return;
      const r = pending;
      pending = null;
      r(move);
    },
    async wait(name) {
      await A.sleep(typeof name === 'number' ? A.dur(name) : A.dur(name));
      await whilePaused();
      guard();
    },
    /** Pencere aç ve kapanmasını bekle */
    ask(content, title, button = 'Devam') {
      return new Promise((resolve) => dialog(content, [[button, () => resolve()]], title));
    },
    pos: (i) => POSITIONS[ctx.n][i],

    // ---- Ölçüm: kartın kaynağı ve hedefi ----
    cardBox: (id) => A.box(body.querySelector(`[data-card="${CSS.escape(id)}"]`)),
    /** Oyuncunun eli: insan için elin ortası (gerçek kart boyu), rakip için kutusundaki küçük kartlar. */
    seatBox(i, scale = 0.42) {
      if (i === 0) return A.point(body.querySelector('.khand') || body, 62, 88);
      const chip = body.querySelector(`.ks-${ctx.pos(i)}`);
      return A.point(chip?.querySelector('.mini') || chip?.querySelector('.av') || chip, PILE_W * scale, PILE_H * scale);
    },
    /** Masanın ortası (deste, yığın) */
    centerBox: () => A.point(body.querySelector('.center'), PILE_W, PILE_H),
    deckBox: () => A.box(body.querySelector('.deck .card')) || A.point(body.querySelector('.center'), PILE_W, PILE_H),

    /** Bir kartı uçur ve bekle. c: kart kimliği ya da null (arka).
     *  reveal: kapalı kalkar, yolda yüzünü çevirir (sana gelen kart). conceal: açık kalkar, yolda kapanır (elinden kapalı verdiğin kart). */
    async fly(c, from, to, opts = {}) {
      guard();
      let node;
      let flipTo = null;
      if (c && opts.conceal) {
        node = cardEl(parseCard(c));
        flipTo = cardEl(null);
      } else if (c && opts.reveal) {
        node = cardEl(null);
        flipTo = cardEl(parseCard(c));
      } else node = c ? cardEl(parseCard(c)) : cardEl(null);
      await A.fly(node, from, to, { ...opts, flipTo });
      guard();
    },
    /** Rakibin kutusundaki kart sayısını yeniden çizmeden değiştir (kart inince +1, çıkınca -1). */
    bumpCount(seat, d = 1) {
      ctx.adj[seat] = (ctx.adj[seat] || 0) + d;
      const chip = body.querySelector(`.ks-${ctx.pos(seat)} .mini`);
      if (!chip) return;
      for (let k = 0; k < Math.abs(d); k++) {
        if (d > 0) {
          const g = chip.querySelector('.ghost');
          if (g) g.remove();
          if (chip.children.length < 13) chip.append(Object.assign(document.createElement('span'), { className: 'mb' }));
        } else {
          const last = chip.querySelector('.mb:not(.ghost):last-child');
          if (last) last.remove();
          if (!chip.children.length) chip.append(Object.assign(document.createElement('span'), { className: 'mb ghost' }));
        }
      }
    },
    /** Uçuşu bitmiş kartı statik yerinde göster (yeniden çizmeden). */
    reveal(id) {
      ctx.pend.delete(id);
      body.querySelectorAll(`[data-card="${CSS.escape(id)}"]`).forEach((e) => {
        e.classList.remove('pend');
        e.style.removeProperty('visibility');
      });
    },
    hide(id) {
      body.querySelectorAll(`[data-card="${CSS.escape(id)}"]`).forEach((e) => e.classList.add('pend'));
    },

    // ---- Statik çizim parçaları ----
    chip(i, sub = '', cls = '', count = null) {
      const n = count == null ? null : Math.max(0, count + (ctx.adj[i] || 0));
      return h('div', { class: `ks ks-${ctx.pos(i)} ${cls}`, 'data-seat': String(i) },
        h('span', { class: 'avw' }, ctx.avatar(i)), h('b', {}, ctx.name(i)), cafe.node(i),
        n != null ? h('div', { class: 'mini', 'aria-label': `${n} kart` }, n ? Array.from({ length: Math.min(n, 13) }, () => h('span', { class: 'mb' })) : h('span', { class: 'mb ghost' })) : null,
        sub ? h('span', { class: 'sub' }, sub) : null);
    },
    /** Üst: karşı koltuk, orta: [sol | alan | sağ], alt: bilgi satırları */
    table({ area, info, chipSub = () => '', chipCls = () => '', count = () => null }) {
      const at = (p) => POSITIONS[ctx.n].indexOf(p);
      const mad = (i) => ['', '', ' angry', ' angry furious'][chat.angerOf(i)] || '';
      const chip = (p) => (at(p) >= 0 ? ctx.chip(at(p), chipSub(at(p)), chipCls(at(p)) + mad(at(p)), count(at(p))) : h('div', { class: 'ks ghost' }));
      return h('div', { class: 'ktable' },
        h('div', { class: 'toprow' }, sheetMini(), at('top') >= 0 ? chip('top') : null),
        h('div', { class: 'mid' }, chip('left'), area, chip('right')),
        info,
        h('div', { class: 'botrow' }, ctx.chip(0, chipSub(0), chipCls(0), null), arrangeBtn()));
    },
    /** Masadaki tek kart (statik): merkezden dx,dy kayık, rot açılı. */
    pileCard(c, { dx = 0, dy = 0, rot = 0, z = 1, back = false } = {}) {
      // Ofsetler 52 px'lik kart için yazıldı; masa kartı büyüyünce (--tc-w) aynı oranda açılır
      const k = (parseFloat(getComputedStyle(body).getPropertyValue('--tc-w')) || 52) / 52;
      dx = Math.round(dx * k);
      dy = Math.round(dy * k);
      return h('div', {
        class: `pc${ctx.pend.has(c) ? ' pend' : ''}`,
        'data-card': c,
        'data-rot': String(rot),
        style: `transform:translate(${dx}px,${dy}px) rotate(${rot}deg);z-index:${z}`,
      }, back ? cardEl(null) : cardEl(parseCard(c)));
    },
    /** Desteye / yerdeki karta dokununca çekme: el, on() çağırır. Panel düğmesi yerine. */
    tapDraw(el, on) {
      if (!el) return el;
      el.classList.add('drawtap');
      el.setAttribute('role', 'button');
      el.addEventListener('click', on);
      return el;
    },
    /** Destenin üstü (dağıtım kaynağı) */
    deck(count) {
      if (!count) return null;
      return h('div', { class: 'deck', 'aria-label': `Destede ${count} kart` },
        Array.from({ length: Math.min(4, Math.ceil(count / 8)) }, (_, k) => h('span', { class: 'deckl', style: `transform:translate(${-k}px,${-k}px)` }, cardEl(null))),
        h('span', { class: 'deckn' }, String(count)));
    },
    /** Elin: kart sayısına göre aralık ayarlanır (az kartta açılır, çok kartta üst üste biner). */
    /** onDrop(c): kart masaya sürüklenince oyna; oynandıysa true döndür (yoksa kart yerine döner) */
    handRow(cards, { can = () => false, selected = null, dim = false, back = false, drag = false, onTap = () => {}, onDrop = null } = {}) {
      // Kart genişliği CSS'teki --hand-w'den okunur (alçak yatay ekranda küçülür). Yatayda sağda 280 px yan sütun var.
      const cw = parseFloat(getComputedStyle(body).getPropertyValue('--hand-w')) || 68;
      const full = body.clientWidth || 380; // kaydırma çubuğu hariç
      const side = 0; // yatayda yan sütun yok (v1.2)
      const W = (LANDSCAPE.matches ? full - side : Math.min(full, 560)) - 12;
      const n = cards.length;
      const step = n > 1 ? Math.min(cw + 8, (W - cw) / (n - 1)) : 0;
      const ml = Math.round(step - cw);
      const row = h('div', { class: `khand${drag || onDrop ? ' dragrow' : ''}`, style: `--ml:${ml}px` });
      row.append(...cards.map((c) => {
        const ok2 = can(c);
        const b = h('button', {
          class: `kc${(selected instanceof Set ? selected.has(c) : selected === c) ? ' sel' : ''}${dim && !ok2 ? ' dim' : ''}${ctx.pend.has(c) ? ' pend' : ''}`,
          'data-card': c,
          'aria-label': back ? 'Kapalı kart' : c,
          onclick: () => {
            if (b._dragged) return;
            onTap(c, ok2);
          },
        }, back ? cardEl(null) : cardEl(parseCard(c)));
        const dropFn = onDrop && !back && ok2 && ctx.awaiting ? (x) => onDrop(x) !== false && ok2 : null;
        if ((drag || dropFn) && !back) dragable(b, c, dropFn);
        return b;
      }));
      return row;
    },
  };

  // ---- El düzeni (perli oyunlar: spec.arrange = true) ----
  // Oyuncunun dizdiği sıra el boyunca korunur; yeni gelen kart sona eklenir. "Düzenle" sırayla per / renk / sayı dizer.
  let handOrder = null;
  let arrMode = 0;
  let manual = false; // oyuncu kartı sürüklediyse sıra korunur; yoksa her çizimde seçili dizilişe (per/renk/sayı) göre yeniden dizilir
  let autoFn = null;
  const ARR = ['per', 'renk', 'sayı'];
  const SUIT_ORD = { S: 0, H: 1, C: 2, D: 3, J: 4 };
  function sortBy(cards, mode) {
    if (mode === 0 && autoFn) return autoFn(cards);
    const k = (c) => {
      const p = parseCard(c);
      const r = p.suit === 'J' ? 99 : p.rank === 14 ? 1 : p.rank;
      return mode === 1 ? SUIT_ORD[p.suit] * 100 + r : r * 10 + SUIT_ORD[p.suit];
    };
    return [...cards].sort((a, b) => k(a) - k(b));
  }
  function arrangeBtn() {
    if (!spec.arrange) return null;
    return h('button', {
      class: 'arrbtn',
      title: 'Elini diz: per, renk, sayı. Kartı sürükleyerek de taşıyabilirsin.',
      onclick: () => {
        if (!handOrder) return;
        arrMode = (arrMode + 1) % ARR.length;
        manual = false; // seçilen dizilişe göre kendiliğinden güncel kalır; yalnız sürükleme sırayı dondurur
        handOrder = sortBy(handOrder, arrMode);
        render();
      },
    }, h('span', {}, 'Düzenle'), h('small', {}, ARR[arrMode]));
  }
  /** Elin oyuncu sırasıyla: auto(cards) ilk dizilişi verir (per bulucu). */
  /** Yeni el dağıtılırken çağrılır: eski dizilişi unut. */
  ctx.newGame = (confirm = true) => newGame(confirm);
  ctx.resetOrder = () => {
    handOrder = null;
    arrMode = 0;
    manual = false;
  };
  ctx.ordered = (cards, auto) => {
    autoFn = auto;
    const keep = handOrder ? handOrder.filter((c) => cards.includes(c)) : [];
    if (!keep.length || !manual) {
      if (!keep.length) arrMode = 0;
      handOrder = arrMode === 0 ? auto(cards) : sortBy(cards, arrMode);
      return handOrder.slice();
    }
    handOrder = keep.concat(cards.filter((c) => !keep.includes(c)));
    return handOrder.slice();
  };
  /** Sürükle-bırak: kart parmağı/fareyi izler, bırakınca araya girer; diğerleri kayarak yer açar (FLIP). */
  // Sürükleme durumu çizimden bağımsız tutulur: başka biri kart atıp ekran yeniden çizilse de sürükleme sürer
  // (pencere dinleyicileri; her çizimde sürüklenen kartın yeni öğesi bulunup aynı konuma konur).
  let drag = null; // { c, sx, sy, dx, dy, moved, pid }
  const dragEl = () => (drag ? body.querySelector(`.khand.dragrow .kc[data-card="${CSS.escape(drag.c)}"]`) : null);
  function dragApply() {
    const el = dragEl();
    if (!el || !drag?.moved) return;
    el.classList.add('dragging');
    el.style.transform = `translate(${drag.dx}px, ${drag.drop ? drag.dy : Math.min(0, drag.dy)}px)`;
  }
  function onDragMove(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    drag.dx = ev.clientX - drag.sx;
    drag.dy = ev.clientY - drag.sy;
    if (!drag.moved && Math.hypot(drag.dx, drag.dy) < 10) return;
    drag.moved = true;
    ev.preventDefault();
    dragApply();
  }
  function onDragEnd(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    removeEventListener('pointermove', onDragMove);
    removeEventListener('pointerup', onDragEnd);
    removeEventListener('pointercancel', onDragEnd);
    if (!d.moved) return;
    const el = body.querySelector(`.khand.dragrow .kc[data-card="${CSS.escape(d.c)}"]`);
    if (el) {
      el.classList.remove('dragging');
      el._dragged = true; // ardından gelen click yok sayılır
      setTimeout(() => (el._dragged = false), 0);
    }
    const row = el?.closest('.khand');
    // masaya sürüklendi: kartı oyna (yukarı yeterince çekildiyse ya da masanın üstünde bırakıldıysa)
    if (d.drop && el) {
      const overTable = document.elementsFromPoint(ev.clientX, ev.clientY).some((e) => e !== el && !el.contains(e) && e.closest?.('.center, .ktable'));
      if (d.dy < -70 || overTable) {
        if (d.drop(d.c)) return; // oynandı: kart bırakıldığı yerden uçar
      }
      if (!handOrder || d.dy < -40) {
        render(); // olmadı: kart elindeki yerine kayar (FLIP)
        return;
      }
    }
    if (!row || !handOrder) return;
    const rest = [...row.querySelectorAll('.kc')].filter((e) => e !== el);
    let idx = rest.findIndex((e) => {
      const r = e.getBoundingClientRect();
      return ev.clientX < r.left + r.width / 2;
    });
    if (idx < 0) idx = rest.length;
    const ids = rest.map((e) => e.dataset.card);
    ids.splice(idx, 0, d.c);
    // görünmeyen (uçuşta olan) kartlar varsa sıranın geri kalanını koru
    handOrder = ids.concat(handOrder.filter((k) => !ids.includes(k)));
    manual = true;
    if (body.querySelector('#fx .fxw') || document.querySelector('#fx .fxw')) safeRender();
    else render(); // FLIP: sürüklenen kart bırakıldığı yerden yuvasına kayar
  }
  function dragable(btn, c, drop = null) {
    btn.addEventListener('pointerdown', (ev) => {
      if (ev.button > 0 || (!handOrder && !drop) || drag) return;
      drag = { c, sx: ev.clientX, sy: ev.clientY, dx: 0, dy: 0, moved: false, pid: ev.pointerId, drop };
      addEventListener('pointermove', onDragMove, { passive: false });
      addEventListener('pointerup', onDragEnd);
      addEventListener('pointercancel', onDragEnd);
    });
    if (drag && drag.c === c && drag.moved) requestAnimationFrame(dragApply);
  }

  // Ekran döndürülünce/boyut değişince yeniden çiz; kart uçarken çizilmez (yer tutucular bozulmasın), uçuş bitince çizilir.
  let resizeT = 0;
  function onResize() {
    clearTimeout(resizeT);
    const again = () => {
      if (!alive || !body.isConnected) return;
      if (document.querySelector('#fx .fxw')) {
        resizeT = setTimeout(again, 250);
        return;
      }
      render();
    };
    resizeT = setTimeout(again, 150);
  }
  addEventListener('resize', onResize);

  function render() {
    if (!ok() || !state) return;
    const before = A.measure(body);
    const nodes = spec.render(ctx).filter(Boolean);
    const strip = yanciStrip();
    if (strip) {
      const at = nodes.findIndex((n) => n.classList?.contains('khand'));
      nodes.splice(at < 0 ? nodes.length : at, 0, strip);
    }
    body.replaceChildren(...(LANDSCAPE.matches ? landscape(nodes) : nodes), ...chat.nodes());
    cafe.afterRender(body);
    applyMarks();
    A.flipFrom(body, before);
    assertPendHidden();
  }

  /** Yatay yerleşim: tek sütun. Masa geniş; altında [sen | durum | yönerge] bandı, en altta el.
   *  Karar panelleri elin hemen üstüne biner. Göz kartlar, durum ve yönerge arasında uzağa gitmez. */
  function landscape(nodes) {
    const kt = nodes.find((n) => n.classList?.contains('ktable'));
    if (!kt) return nodes;
    const [top, mid, info, bot] = kt.children;
    const hand = nodes.filter((n) => n.classList?.contains('khand'));
    const tutor = nodes.filter((n) => n.classList?.contains('yanci'));
    const panels = nodes.filter((n) => n.classList?.contains('panel'));
    const rest = nodes.filter((n) => n !== kt && !hand.includes(n) && !tutor.includes(n) && !panels.includes(n));
    const band = h('div', { class: 'lband' }, bot, info, tutor.length ? tutor : h('div', { class: 'yanci empty' }));
    return [h('div', { class: 'lmain' }, top, mid, rest, band, panels, hand)];
  }

  /** Yancı şeridi: solda konuşma balonu, sağda yancı (avatar, ad, içeceği). Yükseklik sabit: masa büyüyüp küçülmez. */
  const PRAISE = ['Güzel, tam böyle.', 'Aferin, doğru hamle.', 'İşte bu!', 'Ben de onu yapardım.', 'Sağlam oynadın.'];
  let praise = PRAISE[0];
  let praiseFor = null;
  const pickPraise = () => {
    if (praiseFor !== lastReview) {
      praiseFor = lastReview;
      praise = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    }
    return praise;
  };
  // Öneri girişleri: her seferinde "Bence" demesin (aynı öneri için aynı giriş kalır, çizimde değişmez)
  const OPENERS = [
    (l) => `${l}.`,
    (l, lc) => `Bence ${lc(l)}.`,
    (l, lc) => `Bana kalırsa ${lc(l)}.`,
    (l) => `Şöyle yap: ${l}.`,
    (l, lc) => `Hadi, ${lc(l)}.`,
    (l, lc) => `Bak, ${lc(l)}.`,
  ];
  let openerAdv = null;
  let opener = OPENERS[0];
  let openerLast = -1;
  const openerFor = (adv) => {
    if (openerAdv !== adv) {
      openerAdv = adv;
      let k;
      do k = Math.floor(Math.random() * OPENERS.length);
      while (k === openerLast);
      openerLast = k;
      opener = OPENERS[k];
    }
    return opener;
  };
  /** Metindeki kart adlarını renklendir: Kupa/Karo kırmızı, Maça/Sinek koyu, Joker mor */
  function richCards(text) {
    const re = /(Maça|Kupa|Karo|Sinek) (As|Papaz|Kız|Vale|10|[2-9])(?![0-9A-Za-zçğıöşüÇĞİÖŞÜ])|Joker/g;
    const out = [];
    let at = 0;
    for (const m of text.matchAll(re)) {
      if (m.index > at) out.push(text.slice(at, m.index));
      const red = m[1] === 'Kupa' || m[1] === 'Karo';
      const sym = { Maça: '♠', Kupa: '♥', Karo: '♦', Sinek: '♣' }[m[1]] || '';
      out.push(h('span', { class: `cn ${m[0] === 'Joker' ? 'jk' : red ? 'rd' : 'bk'}` }, sym ? `${sym} ${m[0]}` : m[0]));
      at = m.index + m[0].length;
    }
    if (at < text.length) out.push(text.slice(at));
    return out;
  }
  function yanciStrip() {
    // Balonda tek söz, konuşur gibi: sıra sendeyse öneri, değilse son hamlenin yorumu (işaret, kalın yazı yok)
    const lines = [];
    // kart adıyla başlıyorsa büyük harf kalır ("Bence Sinek 2 at"), değilse küçülür ("Bence desteden çek")
    const lc = (t) => (/^(Maça|Kupa|Karo|Sinek|Joker)/.test(t) ? t : `${t.charAt(0).toLocaleLowerCase('tr')}${t.slice(1)}`);
    const timeout = lastReview?.timeout;
    const talk = (t) => lines.push(h('div', { class: 'ytalk plain' }, richCards(t)));
    if (timeout) talk(`Süren bitti, senin yerine oynadım: ${lastReview.better}.`);
    return yanci.node({ lines, drink: cafe.node('y'), onTap: () => { showMarks(); yanci.showHint(richCards(hintText(lc))); safeRender(); }, rich: richCards });
  }
  /** Yancının resmine dokununca: sıra sendeyse ne yapacağın, değilse oyunun gidişatı */
  function hintText(lc) {
    if (!state) return 'Masa daha kuruluyor, bir dakika.';
    if (spec.game.isOver(state)) return 'Oyun bitti. Bir el daha atalım mı?';
    if (advice && pending) return `${openerFor(advice)(advice.label, lc)}${advice.text ? ` ${advice.text}` : ''}`;
    const turn = spec.game.currentActor(state);
    try {
      const t = spec.tally ? spec.tally(state) : { head: 'Puan', totals: spec.game.scores(state) };
      const me = t.totals[0];
      const others = t.totals.filter((_, i) => i !== 0);
      const lead = t.head === 'Ceza' ? me <= Math.min(...others) : me >= Math.max(...others);
      const who = turn != null && turn !== 0 ? `${ctx.name(turn)} düşünüyor. ` : '';
      return `${who}${lead ? 'Şimdilik iyi gidiyorsun, bozma.' : 'Biraz gerideyiz; sıra sana gelince sor, beraber bakalım.'}`;
    } catch {
      return 'Sıra sana gelince dokun, ne yapacağını söylerim.';
    }
  }

  /** Kural §9: uçuşu bekleyen kart ekranda görünmemeli. Görünüyorsa hata yaz ve zorla gizle. */
  function assertPendHidden() {
    for (const id of ctx.pend) {
      body.querySelectorAll(`[data-card="${CSS.escape(id)}"]`).forEach((e) => {
        if (e.isConnected && getComputedStyle(e).visibility !== 'hidden') {
          console.error(`[animasyon kuralı §9] '${id}' uçuş bitmeden görünüyor; gizlendi. CSS'te visibility'yi ezen bir kural var.`);
          e.style.setProperty('visibility', 'hidden', 'important');
        }
      });
    }
  }

  /** Yeni oyun: oyun kişi sayısı soruyorsa (spec.askPlayers) önce sorar. */
  function newGame(confirmRunning = false) {
    if (confirmRunning && state && !spec.game.isOver(state)) {
      dialog('Oyun yarıda bırakılıp yenisi başlasın mı?', [['Evet', () => newGame(false)], ['Hayır']]);
      return;
    }
    if (!spec.askPlayers) return startMatch(false);
    const { key, options } = spec.askPlayers;
    dialog(h('div', {}, 'Kaç kişi oynansın?'), options.map((n) => [`${n} kişi`, () => {
      settings.set(key, n);
      startMatch(false);
    }]), spec.title);
  }

  function startMatch(confirm = false) {
    if (confirm && state && !spec.game.isOver(state)) {
      dialog('Oyun yarıda bırakılıp yenisi başlasın mı?', [['Evet', () => startMatch(false)], ['Hayır']]);
      return;
    }
    stop();
    const players = spec.players();
    let list;
    try {
      list = roster.seatsFor(spec.game, settings.get('humanName'), players);
    } catch (e) {
      body.replaceChildren(h('p', {}, e.message), h('button', { class: 'btn', onclick: () => go('ayarlar') }, 'Ayarlar'));
      return;
    }
    seats = list;
    ctx.n = players;
    ctx.adj = Array(players).fill(0);
    ctx.pend.clear();
    advice = null;
    mark = null;
    lastReview = null;
    alive = true;
    tok = ++token;
    handOrder = null;
    arrMode = 0;
    manual = false;
    spec.reset?.(ctx);
    cafe.start();
    // hızlar oyun sırasında da değişebilir (Ayarlar): her seferinde ayardan okunur
    const mult = () => settings.get('paceMult');
    A.setPace(settings.get('animSpeed'));
    const table = new Table({
      game: spec.game,
      seats,
      rng: makeRng(),
      config: { players, ...(spec.makeConfig ? spec.makeConfig(seats, roster) : {}) },
      pace: async (info, meta = {}) => {
        const seat = meta.seat ?? seats.indexOf(info);
        startClock(seat, BOT_LIMIT * mult());
        if ((meta.moves || []).length > 1) sfx.turnBot();
        await A.sleep(thinkTime(info, (meta.moves || []).length <= 1, mult()));
        await whilePaused();
        guard();
      },
      onEvent: async (e) => {
        guard();
        if (e.type === 'start') {
          state = e.state;
          if (spec.onStart) await spec.onStart(ctx);
          guard();
          render();
          chat.onStart();
          yanci.start();
          return;
        }
        if (e.type !== 'move') return;
        stopClock();
        if (e.seat === 0 && seats[0]?.kind === 'human' && advice) {
          lastReview = timedOut ? { good: false, text: `Süren bitti; önerilen hamle oynandı: ${advice.label}.`, timeout: true } : review(advice, e.move);
          if (lastReview) lastReview.better = advice.label;
          if (lastReview && !timedOut && !spec.solo && !spec.chance && e.move.t !== 'bet') yanci.afterMine({ good: lastReview.good, betterLabel: advice.label });
          if (!tutorOn() && !timedOut) lastReview = null;
          advice = null;
          mark = null;
        }
        timedOut = false;
        const before = state;
        let sBefore = null;
        try {
          sBefore = spec.game.scores(before);
        } catch {}
        state = e.state;
        sheetRecord(e, before);
        if (spec.onMove) await spec.onMove(e, ctx, before);
        guard();
        try {
          const sAfter = spec.game.scores(e.state);
          chat.onMove(spec.game.id, e, before, e.state, sBefore, sAfter);
          cafe.onMove(e.seat);
          if (!spec.solo) yanci.afterMove({ seat: e.seat, isBot: seats[e.seat]?.kind === 'bot', nameOf: (i) => seats[i]?.name ?? '?', sBefore, sAfter, myTurnNext: spec.game.currentActor?.(e.state) === 0 && seats[0]?.kind === 'human' });
        } catch (err) {
          console.error(err);
        }
        ctx.pend.clear();
        ctx.adj = Array(ctx.n).fill(0);
        render();
      },
    });
    // Ekran sayfaya eklenmeden ölçüm yapılamaz: maçı bir sonraki karede başlat (kural §10)
    const begin = () => (body.isConnected ? run() : requestAnimationFrame(begin));
    requestAnimationFrame(begin);
    const run = () => table
      .play({
        askHuman: ({ state: st, view, moves, seat }) => {
          state = st;
          try {
            advice = advise(spec.game, view, moves, seat);
          } catch (err) {
            console.error(err);
            advice = null;
          }
          const limit = spec.solo ? 0 : +settings.get('turnLimit') || 0; // tek kişilikte süre yok
          const reflex = moves.length === 1 && moves[0].t === 'tap';
          if (!reflex && !spec.solo) sfx.turn();
          if (limit && !reflex) {
            startClock(0, limit * 1000, () => {
              if (!pending) return;
              timedOut = true;
              ctx.respond(advice?.best ?? moves[0]);
            });
          }
          return new Promise((resolve, reject) => {
            pending = resolve;
            rejectPending = reject;
            spec.onTurn?.(ctx);
            render();
          });
        },
      })
      .then((res) => ok() && finish(res))
      .catch((e) => {
        if (e && e.message !== 'iptal') console.error(e);
      });
  }

  function finish(res) {
    stopClock();
    try {
      chat.onEnd(res.winners, spec.game.id, res.state);
      yanci.end(res.winners.includes(0));
    } catch {}
    const { scores, winners } = res;
    if (winners.includes(0) || (spec.wonByScore && spec.wonByScore(res))) sfx.win(); // kazanınca neşeli ses
    roster.recordResult(spec.game.id, seats.map((s, i) => ({ s, i })).filter((x) => x.s.kind === 'bot').map((x) => ({ id: x.s.id, won: winners.includes(x.i) })));
    const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
    const lines = order.map((i, k) => h('div', { class: 'drow' }, h('span', {}, `${k + 1}. ${ctx.name(i)}`), h('b', { class: scores[i] < 0 ? 'neg' : 'pos' }, spec.fmtScore ? spec.fmtScore(scores[i], i, ctx) : scores[i])));
    const head = spec.endHead ? spec.endHead(winners, ctx, res) : winners.includes(0) ? 'Kazandın!' : 'Oyun bitti';
    dialog(h('div', {}, h('b', {}, head), lines), [['Yeni oyun', () => newGame(false)], ['Menü', () => go('menu')]], 'Sonuç');
  }

  function stop() {
    alive = false;
    if (paused) resume();
    if (rejectPending) rejectPending(new Error('iptal'));
    pending = null;
    rejectPending = null;
    A.clearLayer();
    stopClock();
    chat.clear();
    cafe.reset();
    yanci.reset();
    chat.resetAnger();
    sheetRows = [];
    spec.reset?.(ctx);
  }

  function destroy() {
    removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
    stop();
    document.querySelectorAll('.overlay, .setov').forEach((o) => o.remove());
  }

  newGame(false);
  // yarıda çıkarken sorulsun mu? (oyun sürüyorsa evet)
  const busy = () => alive && !!state && !spec.game.isOver(state);
  return { el, destroy, busy };
}

/** Ortak koreografiler */
export const choreo = {
  /**
   * Dağıtım: desteden sırayla koltuklara. order: [{seat, card|null}] dağıtım sırasında.
   * İnsanın kartları elinde pend olarak çizilmiş olmalı; her kart inince görünür olur.
   * Rakiplerin sayısı ctx.adj ile 0'dan başlatılıp her inişte artırılır.
   */
  async deal(ctx, order, { from } = {}) {
    const src = from || ctx.deckBox();
    const jobs = order.map(({ seat, card }, k) => {
      const delay = k * ctx.A.dur('dealStagger');
      const to = seat === 0 && card ? ctx.cardBox(card) : ctx.seatBox(seat);
      const flipTo = seat === 0 && card ? ctx.cardEl(ctx.parseCard(card)) : null; // senin kartın yolda yüzünü çevirir
      return ctx.A.fly(ctx.cardEl(null), src, to, { duration: ctx.A.dur('deal'), easing: ctx.A.EASE.land, delay, flipTo }).then(() => {
        if (seat === 0 && card) ctx.reveal(card);
        else ctx.bumpCount(seat, 1);
      });
    });
    await Promise.all(jobs);
  },
  /** Masadaki kartları alan oyuncuya topla (kartlar küçülüp onun destesine karışır). */
  async collect(ctx, cards, seat) {
    const to = ctx.seatBox(seat, seat === 0 ? 0.5 : 0.42);
    if (seat === 0) {
      // insanın aldığı kartlar elinin üstüne değil, elinin yanına (önündeki alınan destesine) gider
      to.cy -= 70;
      to.w = PILE_W * 0.5;
      to.h = PILE_H * 0.5;
    }
    const jobs = cards.map((c, k) => {
      const from = ctx.cardBox(c);
      ctx.hide(c);
      return ctx.A.fly(/^[a-z]/.test(c) ? ctx.cardEl(null) : ctx.cardEl(ctx.parseCard(c)), from, to, { duration: ctx.A.dur('collect'), easing: ctx.A.EASE.leave, delay: k * ctx.A.dur('collectStagger'), fadeEnd: true });
    });
    await Promise.all(jobs);
  },
};
