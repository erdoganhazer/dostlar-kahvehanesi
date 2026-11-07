// Blöf masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: atılan kartlar kapalı olarak elden/kutudan yığına uçar → "yalan!" denince son atılan kartlar yığının üstünden
// açılış sırasına uçup yüzünü çevirir → okuma molası → yığın, alan oyuncuya gider (sana geliyorsa kartlar yolda yüzünü çevirir).
import blof, { RANKS } from '../games/blof.js';
import { RANK_NAME_TR } from '../core/cards.js';
import { createMatchScreen, choreo } from './table-kit.js';

const rn = (r) => RANK_NAME_TR[r] || String(r);
const SHOW = 8; // yığında en fazla bu kadar kart çizilir

export function createBlofScreen(deps) {
  const { h, settings } = deps;
  let sel = new Set();
  let disp = null; // { hand, sizes, pileN, reveal }
  let note = '';

  const pid = (i) => `p${i}`;
  const spot = (ctx, id) => {
    const j = ctx.A.jitter(id, 34);
    return { dx: j.dx, dy: j.dy + 16, rot: j.rot / 2 };
  };

  return createMatchScreen(deps, {
    yazboz: false,
    title: 'Blöf',
    game: blof,
    players: () => settings.get('blofPlayers'),
    maxThink: 500,
    reset() {
      sel = new Set();
      disp = null;
      note = '';
    },
    onTurn() {
      sel = new Set();
    },

    async onStart(ctx) {
      const { A } = ctx;
      const v = ctx.view(0);
      v.hand.forEach((c) => ctx.pend.add(c));
      ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
      disp = { hand: v.hand, sizes: v.handSizes, pileN: 0, reveal: [] };
      ctx.render();
      const order = [];
      const idx = Array(ctx.n).fill(0);
      for (let k = 0; k < 52; k++) {
        const seat = k % ctx.n;
        order.push({ seat, card: seat === 0 ? v.hand[idx[0]++] : null });
      }
      // sadece her koltuğun kendi kartı kadar dağıt (3 kişide ilk iki koltuk 18 alır)
      const need = v.handSizes.slice();
      const todo = order.filter((o) => need[o.seat]-- > 0);
      await choreo.deal(ctx, todo, { from: ctx.centerBox() });
      ctx.adj = Array(ctx.n).fill(0);
      disp = null;
    },

    async onMove(e, ctx, before) {
      const { A } = ctx;
      const ev = e.event;
      const seat = e.seat;
      sel = new Set();
      const bv = blof.viewFor(before, 0);
      const av = blof.viewFor(e.state, 0);
      if (ev.t === 'pass') {
        return;
      }
      if (ev.t === 'play') {
        const cards = e.move.cards;
        const k = cards.length;
        const ids = cards.map((_, j) => pid(bv.pileSize + j));
        const srcs = cards.map((c) => (seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat)));
        const sizes = bv.handSizes.slice();
        disp = { hand: seat === 0 ? bv.hand.filter((c) => !cards.includes(c)) : bv.hand, sizes, pileN: bv.pileSize + k, reveal: [] };
        ids.forEach((id) => ctx.pend.add(id));
        ctx.render();
        // senin kartların elinden açık kalkar, yolda kapanır; rakibinki kutusundan kapalı gelir. Sayı kart çıkınca düşer.
        await Promise.all(ids.map((id, j) => ctx.A.sleep(j * 60).then(() => {
          if (seat !== 0) ctx.bumpCount(seat, -1);
          return ctx.fly(seat === 0 ? cards[j] : null, srcs[j], ctx.cardBox(id), { duration: A.dur(seat === 0 ? 'play' : 'botPlay'), easing: A.EASE.land, conceal: seat === 0 });
        }).then(() => ctx.reveal(id))));
        disp = null;
        return;
      }
      // ---- çağrı ("yalan!") ----
      const P = bv.pileSize;
      const shown = ev.shown;
      const k = shown.length;
      const taker = ev.taker;
      note = `${ctx.name(seat)}: "Yalan!"`;
      // 1) son atılan kartlar yığının üstündeki kendi yerlerinden kalkıp açılır
      const shownSrc = shown.map((_, j) => ctx.cardBox(pid(P - k + j)));
      disp = { hand: bv.hand, sizes: bv.handSizes, pileN: P - k, reveal: shown };
      shown.forEach((c) => ctx.pend.add(c));
      ctx.render();
      await Promise.all(shown.map((c, j) =>
        A.fly(ctx.cardEl(null), shownSrc[j], ctx.cardBox(c), { duration: A.dur('pass'), easing: A.EASE.move, delay: j * 90, flipTo: ctx.cardEl(ctx.parseCard(c)) }).then(() => ctx.reveal(c))));
      note = ev.truth
        ? `${ctx.name(ev.accused)} doğru söylemiş, ortadakiler ${ctx.name(taker)}'e`
        : `Yalan çıktı! Ortadakiler ${ctx.name(taker)}'e`;
      ctx.render();
      await ctx.wait(1500);
      // 2) bütün yığın alan oyuncuya gider. Çizilmeyen alttaki kartlar en alttaki çizili kartın yerinden kalkar.
      const drawn = Array.from({ length: P - k }, (_, j) => pid(j)).slice(-SHOW);
      const bottom = drawn[0];
      const srcs = [...shown.map((c) => ({ id: c, face: true })), ...drawn.map((id) => ({ id, face: false }))];
      while (srcs.length < P) srcs.push({ id: bottom, face: false, extra: true });
      let fresh = [];
      let hand = bv.hand;
      if (taker === 0) {
        hand = av.hand;
        const got = av.hand.filter((c) => !bv.hand.includes(c));
        const rest = got.filter((c) => !shown.includes(c));
        fresh = [...shown, ...rest];
        fresh.forEach((c) => ctx.pend.add(c));
      }
      disp = { hand, sizes: bv.handSizes, pileN: P - k, reveal: shown };
      ctx.render();
      const boxes = srcs.map((x) => ctx.cardBox(x.id));
      const target = taker === 0 ? null : ctx.seatBox(taker, 0.42);
      await Promise.all(srcs.map((x, n) => ctx.A.sleep(n * A.dur('collectStagger')).then(() => {
        if (!x.extra) ctx.hide(x.id);
        const real = taker === 0 ? fresh[n] : null;
        const to = taker === 0 ? ctx.cardBox(real) : target;
        // açık gösterilen kart açık gider; kapalılar sana geliyorsa yolda yüzünü çevirir
        const node = x.face ? ctx.cardEl(ctx.parseCard(x.id)) : ctx.cardEl(null);
        const flipTo = !x.face && real ? ctx.cardEl(ctx.parseCard(real)) : x.face && taker !== 0 ? ctx.cardEl(null) : null;
        return A.fly(node, boxes[n], to, { duration: A.dur('collect'), easing: A.EASE.leave, fadeEnd: taker !== 0, flipTo });
      }).then(() => (taker === 0 ? ctx.reveal(fresh[n]) : ctx.bumpCount(taker, 1)))));
      note = '';
      disp = null;
    },

    render(ctx) {
      const v = ctx.view(0);
      const d = disp || {};
      const hand = d.hand ?? v.hand;
      const sizes = d.sizes ?? v.handSizes;
      const pileN = d.pileN ?? v.pileSize;
      const reveal = d.reveal ?? [];
      const ids = [];
      for (let i = Math.max(0, pileN - SHOW); i < pileN; i++) ids.push(pid(i));
      const pile = ids.map((id, k) => ctx.pileCard(id, { ...spot(ctx, id), z: k + 1, back: true }));
      const rev = reveal.length ? h('div', { class: 'revrow' }, reveal.map((c) => h('div', { class: `rc${ctx.pend.has(c) ? ' pend' : ''}`, 'data-card': c }, ctx.cardEl(ctx.parseCard(c))))) : null;
      const area = h('div', { class: 'center' }, rev, pile, h('div', { class: 'cnt' }, `Ortada ${pileN + reveal.length} kart`));
      const my = ctx.awaiting && !disp && v.turn === 0 && !v.over;
      const lp = v.lastPlay;
      let head;
      let sub;
      if (note) {
        head = note;
        sub = ' ';
      } else if (v.phase === 'call') {
        head = lp ? `${ctx.name(lp.seat)}: ${lp.k} adet ${rn(lp.claim)}` : '';
        sub = my ? 'Doğru mu söylüyor?' : `${ctx.name(v.turn)} karar veriyor`;
      } else {
        head = my ? `Sıra sende: ${rn(v.next)} de` : `${ctx.name(v.turn)} oynuyor`;
        sub = `Söylenecek sayı: ${rn(v.next)}`;
      }
      const info = h('div', { class: 'kinfo' }, h('div', { class: 'kg' }, head), h('div', { class: 'sub' }, sub));
      const out = [ctx.table({
        area, info, count: (i) => sizes[i],
        chipSub: (i) => (lp && lp.seat === i && v.phase === 'call' ? `${lp.k} adet ${rn(lp.claim)}` : ''),
        chipCls: (i) => (!disp && !v.over && v.turn === i ? 'turn' : ''),
      })];
      if (my && v.phase === 'call') {
        out.push(h('div', { class: 'announce panel' }, h('div', { class: 'pgrid two' },
          h('button', { class: 'btn', onclick: () => ctx.respond({ t: 'call' }) }, 'Yalan!'),
          h('button', { class: 'btn', onclick: () => ctx.respond({ t: 'pass' }) }, 'İnan'))));
      }
      if (my && v.phase === 'play') {
        const cards = hand.filter((c) => sel.has(c));
        out.push(h('div', { class: 'announce panel' },
          h('button', { class: 'btn', disabled: !cards.length, onclick: () => { sel = new Set(); ctx.respond({ t: 'play', cards }); } },
            cards.length ? `${cards.length} kartı kapalı at (${rn(v.next)} de)` : `1-4 kart seç, ${rn(v.next)} de`)));
      }
      out.push(ctx.handRow(hand, {
        selected: sel,
        can: () => my && v.phase === 'play',
        // masaya sürükle: seçtiklerin + sürüklediğin kart birlikte (en çok 4) kapalı atılır
        onDrop: (c) => {
          if (!my || v.phase !== 'play') return false;
          const set = new Set(sel);
          if (!set.has(c)) {
            if (set.size >= 4) return false;
            set.add(c);
          }
          const cards = hand.filter((x) => set.has(x));
          sel = new Set();
          ctx.respond({ t: 'play', cards });
          return true;
        },
        onTap: (c) => {
          if (!my || v.phase !== 'play') return;
          if (sel.has(c)) sel.delete(c);
          else if (sel.size < 4) sel.add(c);
          ctx.render();
        },
      }));
      return out;
    },

    endHead: (w) => (w.includes(0) ? 'Elini ilk bitiren sensin — kazandın!' : 'Biri elini bitirdi'),
    fmtScore: (s) => (s ? 'kazandı' : ''),
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, '52 kart eşit dağıtılır. Sırayla 1-4 kartı yüzü kapalı ortaya atarsın ve sıradaki sayıyı söylersin: önce As, sonra 2, 3 ... Papaz, tekrar As. Kartlar gerçekte o sayı olmak zorunda değil, yalan söyleyebilirsin.'),
      h2('p', {}, 'Her atıştan sonra diğer oyuncular sırayla "Yalan!" diyebilir ya da inanabilir. Atılan kartlar gerçekten söylenen sayıysa ortadakileri "yalan" diyen alır, değilse atan alır.'),
      h2('p', {}, 'Elindeki kartları ilk bitiren, son atışına kimse "yalan" demezse ya da dediği boşa çıkarsa kazanır. Kartları seçmek için dokun, sonra "At" düğmesine bas.')),
  });
}
