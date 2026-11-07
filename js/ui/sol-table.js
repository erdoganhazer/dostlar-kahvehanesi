// Tek kişilik oyunların ortak masası (Solitaire, Golf, FreeCell, Spider). Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Ekran durumdan STATİK çizilir: her kart (kapalılar dahil) kendi kimliğiyle (data-card) mutlak konumda durur.
// Hamlede: eski konumlar ölçülür → yeni durum çizilir → yeri değişen her kart eski yerinden yenisine kayar (FLIP, gerçek
// yol), yüzü değişen kart yolda döner; yerinde açılan kart (altındaki kapalı) hareketler bitince çevrilir. Işınlanma yok.
// Dokunma: karta dokun → tek gidişi varsa (ya da temele gidebiliyorsa) oynanır; birden çok yeri varsa kart seçilir,
// gidebileceği yerler hafifçe çerçevelenir, hedefe dokun (aynı karta tekrar dokunmak en iyisini oynar). Desteye dokun → kart aç.
import { createMatchScreen } from './table-kit.js';
import { sfx } from './sfx.js';

const top = (a) => a[a.length - 1];

/**
 * opt: { title, game, layout(state) → { cols, piles:[{ id, col, row, cards:[{c,up}], fan:'down'|'right'|'stack', label, rev }] },
 *        makeConfig?, menu?, rules(h), fmtScore(score), status(state) → metin, auto?(state) → bool, mid?(before, move, after) → ara durum }
 */
export function createSolScreen(deps, opt) {
  const { h } = deps;
  let disp = null; // animasyon sırasında ara durum
  let sel = null; // { pile, n, moves }
  let autoOn = false;
  let geo = null; // son çizimin ölçüleri
  let note = null; // kısa uyarı (ör. neden dağıtılmadı), birkaç saniye görünür
  let noteT = 0;
  const say = (ctx, text) => {
    note = text;
    clearTimeout(noteT);
    noteT = setTimeout(() => {
      note = null;
      ctx.render();
    }, 4000);
    ctx.render();
  };

  const legal = (ctx) => (ctx.awaiting ? opt.game.legalMoves(ctx.state, 0) : []);

  function play(ctx, m) {
    sel = null;
    ctx.respond(m);
  }

  function tapCard(ctx, pile, k) {
    if (!ctx.awaiting) return;
    const L = legal(ctx);
    if (pile.id === 's') {
      const d = L.find((m) => m.t === 'draw' || m.t === 'deal');
      if (d) play(ctx, d);
      else say(ctx, opt.noDraw?.(ctx.state) || 'Destede kart kalmadı.');
      return;
    }
    // seçiliyken hedefe dokunma
    if (sel && sel.pile !== pile.id) {
      const m = sel.moves.find((x) => x.to === pile.id);
      if (m) return play(ctx, m);
    }
    const n = pile.cards.length - k;
    const x = pile.cards[k];
    if (!x?.up) {
      sel = null;
      return ctx.render();
    }
    const ms = L.filter((m) => m.t === 'mv' && m.from === pile.id && m.n === n);
    if (!ms.length) {
      sel = null;
      return ctx.render();
    }
    const best = () => ms.reduce((a, b) => (opt.game.rateMove(ctx.view(0), b) > opt.game.rateMove(ctx.view(0), a) ? b : a));
    if (sel && sel.pile === pile.id && sel.n === n) return play(ctx, best());
    const toF = ms.find((m) => m.to[0] === 'f' || m.to === 'w');
    if (toF) return play(ctx, toF);
    if (ms.length === 1) return play(ctx, ms[0]);
    sel = { pile: pile.id, n, moves: ms };
    ctx.render();
  }

  // ---- Sürükle-bırak: açık kartı (altındakilerle birlikte) tutup gideceği sütuna bırak ----
  let drag = null; // { ctx, pile, n, moves, els, sx, sy, moved }
  let dragged = false;
  function dragStart(ctx, pile, k, ev) {
    if (!ctx.awaiting || ev.button > 0 || pile.id === 's') return;
    const card = pile.cards[k];
    if (!card?.up) return;
    const n = pile.cards.length - k;
    const moves = legal(ctx).filter((m) => m.t === 'mv' && m.from === pile.id && m.n === n);
    if (!moves.length) return;
    const ids = pile.cards.slice(k).map((x) => x.c);
    const els = ids.map((id) => ctx.body.querySelector(`.solc[data-card="${CSS.escape(id)}"]`)).filter(Boolean);
    drag = { ctx, pile, n, moves, els, sx: ev.clientX, sy: ev.clientY, moved: false, pid: ev.pointerId };
    dragged = false;
    addEventListener('pointermove', dragMove);
    addEventListener('pointerup', dragEnd);
    addEventListener('pointercancel', dragEnd);
  }
  function dragMove(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    const dx = ev.clientX - drag.sx;
    const dy = ev.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.els.forEach((e, i) => {
        e.dataset.z = e.style.zIndex;
        e.style.zIndex = String(2000 + i);
        e.classList.add('dragging');
      });
    }
    drag.els.forEach((e) => (e.style.transform = `translate(${dx}px,${dy}px)`));
    ev.preventDefault();
  }
  function dropTarget(ev, d) {
    for (const e of document.elementsFromPoint(ev.clientX, ev.clientY)) {
      if (d.els.some((x) => x === e || x.contains(e))) continue;
      const host = e.closest?.('[data-pile]');
      if (host && host.dataset.pile !== d.pile.id) return host.dataset.pile;
    }
    return null;
  }
  async function dragEnd(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    removeEventListener('pointermove', dragMove);
    removeEventListener('pointerup', dragEnd);
    removeEventListener('pointercancel', dragEnd);
    const d = drag;
    drag = null;
    if (!d.moved) return;
    dragged = true;
    setTimeout(() => (dragged = false), 0);
    const to = ev.type === 'pointerup' ? dropTarget(ev, d) : null;
    const m = to && d.moves.find((x) => x.to === to);
    if (m && d.ctx.awaiting) {
      // kartlar bırakıldığı yerden yerine kayar (snap bu konumu ölçer)
      d.els.forEach((e) => e.classList.remove('dragging'));
      return play(d.ctx, m);
    }
    // olmadı: kartlar geldiği yere geri kayar
    await Promise.all(d.els.map((e) => {
      const from = e.style.transform;
      e.style.transform = '';
      return e.animate([{ transform: from }, { transform: 'translate(0,0)' }], { duration: d.ctx.A.dur(220), easing: d.ctx.A.EASE.move }).finished.catch(() => {});
    }));
    d.els.forEach((e) => {
      e.classList.remove('dragging');
      e.style.zIndex = e.dataset.z || '';
    });
  }

  function tapSlot(ctx, pile) {
    if (!ctx.awaiting) return;
    if (pile.id === 's') return tapCard(ctx, pile, 0);
    if (sel) {
      const m = sel.moves.find((x) => x.to === pile.id);
      if (m) return play(ctx, m);
    }
    sel = null;
    ctx.render();
  }

  /** Yerleşim: kart boyu genişliğe ve yüksekliğe göre, yelpaze aralığı sütun boyuna göre sıkışır. */
  function measure(ctx, L) {
    const body = ctx.body;
    const W = Math.max(280, (body.clientWidth || 380) - 16);
    // gerçek yükseklik: araç satırı ve yancı şeridi ölçülür (yoksa tahmin); masa yancının üstüne taşmamalı
    const yH = body.querySelector(':scope > .yanci')?.offsetHeight || 68;
    const tH = body.querySelector(':scope > .soltool')?.offsetHeight || 36;
    const H = Math.max(220, (body.clientHeight || 640) - 14 - tH - yH - 14);
    const gap = Math.max(3, Math.min(10, Math.round(W / 90)));
    // kart boyu: genişliğe ve oyunun olağan sütun boyuna (L.need, kart boyu cinsinden) göre
    let cw = Math.floor((W - gap * (L.cols - 1)) / L.cols);
    cw = Math.min(cw, 100, Math.floor(H / 1.4 / (2.18 + (L.need || 2))));
    // sütunlar: açık / kapalı kart sayısı (son kart hariç)
    const cols = L.piles.filter((p) => p.fan === 'down' && p.cards.length > 1).map((p) => {
      const rest = p.cards.slice(0, -1);
      const up = rest.filter((x) => x.up).length;
      return { up, dn: rest.length - up };
    });
    const fit = (ch) => {
      const tabH = H - ch - Math.round(ch * 0.18);
      let U = 0.42 * ch; // yer varsa geniş aralık
      let D = 0.12 * ch;
      for (const c of cols) {
        if (c.up) U = Math.min(U, (tabH - ch - c.dn * D) / c.up);
      }
      if (U < 0.24 * ch) {
        D = 0.06 * ch; // önce kapalıları sıkıştır
        U = 0.42 * ch;
        for (const c of cols) if (c.up) U = Math.min(U, (tabH - ch - c.dn * D) / c.up);
      }
      return { U, D };
    };
    let ch = Math.round(cw * 1.4);
    let { U, D } = fit(ch);
    // hâlâ sığmıyorsa kartlar küçülür (sayı ve renk okunur kalsın: açık aralık en az 0.22 kart boyu)
    for (let i = 0; i < 12 && U < 0.22 * ch && cw > 26; i++) {
      cw = Math.floor(cw * 0.92);
      ch = Math.round(cw * 1.4);
      ({ U, D } = fit(ch));
    }
    U = Math.max(U, 0.16 * ch);
    const rowGap = Math.round(ch * 0.18);
    const left = Math.floor((W - (L.cols * cw + (L.cols - 1) * gap)) / 2) + 8;
    return { cw, ch, gap, rowGap, up: U, down: D, left, H };
  }

  function draw(ctx) {
    const st = disp || ctx.state;
    const L = opt.layout(st);
    const g = (geo = measure(ctx, L));
    const area = h('div', { class: 'solarea', style: `--sw:${g.cw}px;--sh:${g.ch}px;height:${g.H}px` });
    const targets = new Set(sel ? sel.moves.map((m) => m.to) : []);
    let z = 1;
    for (const p of L.piles) {
      const x0 = g.left + p.col * (g.cw + g.gap);
      const y0 = p.row ? g.ch + g.rowGap : 0;
      const slot = h('div', { class: `solslot${targets.has(p.id) ? ' tgt' : ''}`, 'data-pile': p.id, style: `left:${x0}px;top:${y0}px`, onclick: () => tapSlot(ctx, p) }, p.label || '');
      area.append(slot);
      let y = y0;
      let x = x0;
      const n = p.cards.length;
      const vis = p.fan === 'right' ? Math.max(0, n - (p.show || 3)) : 0;
      const G = Math.ceil(n / 10);
      p.cards.forEach((card, k) => {
        if (p.fan === 'right' && k > vis) x += Math.round(g.cw * 0.24);
        // Spider destesi: her dağıtım ayrı deste, sola doğru kaymış; sıradaki dağıtım en sağda ve üstte
        if (p.fan === 'deals') x = x0 - Math.floor(k / 10) * Math.round(g.cw * 0.2);
        const isSel = sel && sel.pile === p.id && k >= n - sel.n;
        const tgt = targets.has(p.id) && k === n - 1;
        const el = h('div', {
          class: `solc${isSel ? ' sel' : ''}${tgt ? ' tgt' : ''}`,
          'data-card': card.c,
          'data-up': card.up ? '1' : '0',
          'data-pile': p.id,
          style: `left:${x}px;top:${y}px;z-index:${p.fan === 'deals' ? 1 + (G - Math.floor(k / 10)) * 12 + (k % 10) : z++}`,
          onclick: () => {
            if (dragged) return; // sürüklemenin sonundaki tıklama sayılmaz
            tapCard(ctx, p, k);
          },
          onpointerdown: (ev) => dragStart(ctx, p, k, ev),
        }, card.up ? ctx.cardEl(ctx.parseCard(card.c)) : ctx.cardEl(null));
        area.append(el);
        if (p.fan === 'down') y += Math.round(card.up ? g.up : g.down);
      });
    }
    return area;
  }

  /** Kartların ekran konumu ve yüzü */
  const snap = (ctx) => {
    const m = new Map();
    ctx.body.querySelectorAll('.solc[data-card]').forEach((e) => m.set(e.dataset.card, { r: e.getBoundingClientRect(), up: e.dataset.up === '1' }));
    return m;
  };

  /** Eski konumdan yenisine kaydır; yüzü değişen yolda döner; yerinde açılan kart sonra çevrilir. */
  async function animateTo(ctx, old, { stagger = 0 } = {}) {
    const { A } = ctx;
    const jobs = [];
    const flips = [];
    let k = 0;
    ctx.body.querySelectorAll('.solc[data-card]').forEach((e) => {
      const o = old.get(e.dataset.card);
      if (!o) return;
      const r = e.getBoundingClientRect();
      const dx = o.r.left - r.left;
      const dy = o.r.top - r.top;
      const upNow = e.dataset.up === '1';
      const moved = Math.abs(dx) > 1 || Math.abs(dy) > 1;
      if (!moved) {
        if (o.up !== upNow) flips.push(e);
        return;
      }
      const d = A.dur(Math.min(520, 260 + Math.hypot(dx, dy) * 0.25));
      const delay = stagger * k++;
      const z0 = e.style.zIndex;
      e.style.zIndex = String(900 + k);
      let frames = [{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }];
      if (o.up !== upNow) {
        const face = e.firstChild;
        const other = upNow ? ctx.cardEl(null) : ctx.cardEl(ctx.parseCard(e.dataset.card));
        e.replaceChildren(other);
        setTimeout(() => e.isConnected && e.replaceChildren(face), delay + d / 2);
        frames = [{ transform: `translate(${dx}px,${dy}px) scaleX(1)` }, { transform: `translate(${dx / 2}px,${dy / 2}px) scaleX(0)`, offset: 0.5 }, { transform: 'translate(0,0) scaleX(1)' }];
      }
      if (k <= 1 || stagger) setTimeout(() => sfx.card(), delay);
      jobs.push(e.animate(frames, { duration: d, delay, easing: A.EASE.move, fill: 'backwards' }).finished.catch(() => {}).then(() => (e.style.zIndex = z0)));
    });
    await Promise.all(jobs);
    if (flips.length) {
      await Promise.all(flips.map((e) => {
        const face = e.firstChild;
        e.replaceChildren(e.dataset.up === '1' ? ctx.cardEl(null) : ctx.cardEl(ctx.parseCard(e.dataset.card)));
        return A.flipInPlace(e, face);
      }));
    }
  }

  return createMatchScreen(deps, {
    solo: true,
    yazboz: false,
    title: opt.title,
    game: opt.game,
    players: () => 1,
    makeConfig: opt.makeConfig,
    rules: opt.rules,
    menu: opt.menu,
    // yancı ipucu: taşınacak kart(lar) ve gideceği kart / boş yer
    hintMarks(m, st) {
      const L = opt.layout(st);
      const pile = (id) => L.piles.find((p) => p.id === id);
      if (m.t === 'draw' || m.t === 'deal') return { src: [], dst: [], piles: ['s'] };
      if (m.t !== 'mv') return null;
      const from = pile(m.from);
      const to = pile(m.to);
      const src = from ? from.cards.slice(-(m.n || 1)).map((x) => x.c) : [];
      const top = to?.cards[to.cards.length - 1];
      return { src, dst: top ? [top.c] : [], piles: top ? [] : [m.to] };
    },
    reset() {
      note = null;
      disp = null;
      sel = null;
      autoOn = false;
    },
    async onStart(ctx) {
      // açılış: bütün kartlar desteden yerlerine dağılır
      ctx.render();
      const old = new Map();
      // kaynak: deste (yoksa masanın üst ortası)
      const src = ctx.body.querySelector('.solslot[data-pile="s"]');
      let sr = src?.getBoundingClientRect();
      if (!sr) {
        const a = ctx.body.querySelector('.solarea')?.getBoundingClientRect();
        if (!a) return;
        sr = { left: a.left + a.width / 2 - geo.cw / 2, top: a.top };
      }
      ctx.body.querySelectorAll('.solc[data-card]').forEach((e) => old.set(e.dataset.card, { r: sr, up: false }));
      await animateTo(ctx, old, { stagger: ctx.A.dur(18) });
    },
    onTurn(ctx) {
      if (!autoOn) return;
      const m = opt.game.legalMoves(ctx.state, 0).find((x) => x.t === 'mv' && x.to[0] === 'f');
      if (!m) {
        autoOn = false;
        return;
      }
      setTimeout(() => ctx.awaiting && ctx.respond(m), ctx.A.dur(60));
    },
    async onMove(e, ctx, before) {
      sel = null;
      const mid = opt.mid?.(before, e.move, e.state);
      if (mid) {
        disp = mid;
        const o1 = snap(ctx);
        ctx.render();
        await animateTo(ctx, o1);
        await ctx.wait('pause');
        disp = null;
      }
      const old = snap(ctx);
      const many = e.move.t === 'deal' || (e.move.t === 'draw' && !before.s.length);
      ctx.render();
      await animateTo(ctx, old, { stagger: many ? ctx.A.dur(e.move.t === 'deal' ? 70 : 12) : 0 });
    },
    endHead: (w, ctx, res) => (w.includes(0) ? 'Kazandın! Tebrikler.' : res.state.stuck ? 'Oyun bitti' : 'Oyunu bıraktın'),
    fmtScore: (sc) => opt.fmtScore(sc),
    render(ctx) {
      ctx.body.classList.add('sol'); // yatayda da tek sütun: araç satırı, masa, yancı
      const s = ctx.state;
      const st = disp || s;
      const L = ctx.awaiting ? opt.game.legalMoves(s, 0) : [];
      const canUndo = L.some((m) => m.t === 'undo');
      const auto = !autoOn && ctx.awaiting && opt.auto?.(st);
      const msg = note || (s.stuck ? (opt.stuckText?.(s) || 'Hamle kalmadı: geri al ya da bitir.') : opt.status(st));
      const tool = h('div', { class: 'soltool' },
        h('span', { class: 'solmsg' }, msg),
        auto ? h('button', { class: 'btn sm', onclick: () => {
          const m = ctx.awaiting && opt.game.legalMoves(s, 0).find((x) => x.to?.[0] === 'f');
          if (!m) return;
          autoOn = true;
          play(ctx, m);
        } }, 'Topla') : null,
        s.stuck ? h('button', { class: 'btn sm', onclick: () => ctx.awaiting && play(ctx, { t: 'resign' }) }, 'Bitir') : null,
        h('button', { class: 'btn sm', disabled: !canUndo, onclick: () => canUndo && play(ctx, { t: 'undo' }) }, '↶ Geri al'));
      return [tool, draw(ctx)];
    },
  });
}

// ---- Oyunların yerleşimleri ----
const col = (cards) => cards.map((x) => (typeof x === 'string' ? { c: x, up: true } : x));
const backs = (cards) => cards.map((c) => ({ c, up: false }));
const STATUS_TIME = (s) => `Hamle ${s.moves || 0}`;

export const LAYOUTS = {
  solitaire: (s) => ({
    cols: 7,
    need: 2.2,
    piles: [
      { id: 's', col: 0, row: 0, cards: backs(s.s), fan: 'stack', label: '↻' },
      { id: 'w', col: 1, row: 0, cards: col(s.w), fan: s.draw === 3 ? 'right' : 'stack', show: 3 },
      ...s.f.map((p, i) => ({ id: `f${i}`, col: 3 + i, row: 0, cards: col(p), fan: 'stack', label: 'A' })),
      ...s.t.map((c, i) => ({ id: `t${i}`, col: i, row: 1, cards: c, fan: 'down', label: 'K' })),
    ],
  }),
  golf: (s) => ({
    cols: 7,
    need: 1.3,
    piles: [
      { id: 's', col: 0, row: 0, cards: backs(s.s), fan: 'stack' },
      { id: 'w', col: 1, row: 0, cards: col(s.w), fan: 'stack' },
      ...s.t.map((c, i) => ({ id: `t${i}`, col: i, row: 1, cards: c, fan: 'down' })),
    ],
  }),
  freecell: (s) => ({
    cols: 8,
    need: 2.6,
    piles: [
      ...s.c.map((c, i) => ({ id: `c${i}`, col: i, row: 0, cards: c ? col([c]) : [], fan: 'stack' })),
      ...s.f.map((p, i) => ({ id: `f${i}`, col: 4 + i, row: 0, cards: col(p), fan: 'stack', label: 'A' })),
      ...s.t.map((c, i) => ({ id: `t${i}`, col: i, row: 1, cards: c, fan: 'down' })),
    ],
  }),
  spider: (s) => ({
    cols: 10,
    need: 2.4,
    piles: [
      ...s.f.map((run, i) => ({ id: `f${i}`, col: i, row: 0, cards: col([...run].reverse()), fan: 'stack' })),
      { id: 's', col: 9, row: 0, cards: backs(s.s), fan: 'deals' },
      ...s.t.map((c, i) => ({ id: `t${i}`, col: i, row: 1, cards: c, fan: 'down' })),
    ],
  }),
};
export { STATUS_TIME };
