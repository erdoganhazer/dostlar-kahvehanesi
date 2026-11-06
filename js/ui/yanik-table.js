// Yanık masası. Animasyon kuralları: docs/ANIMASYON-KURALLARI.md
// Koreografi: dağıtım (desteden 10'ar, başlayana 11) → çekme (desteden kapalı / yandan açık) → açma ve per (elden/kutudan yerdeki
// per yuvalarına sırayla) → işleme (kart pere) → joker alma (kart pere, joker ele) → atma (yana) → el sonu özeti → hepsi desteye → yeni dağıtım.
// Yerdeki perler masanın sağında küçük kartlarla dizilir; deste ve atılan kartlar solda.
import yanik, { addSpot, swapSpot, handPen, LIMIT, STAKE, START_MONEY } from '../games/yanik.js';
import { solve, isJoker } from '../games/konken.js';
import { createMatchScreen, choreo } from './table-kit.js';
import { RANK_NAME_TR, SUIT_NAME_TR, SUIT_SYMBOL } from '../core/cards.js';

const rl = (r) => ({ 1: 'A', 14: 'A', 13: 'K', 12: 'Q', 11: 'J' }[r] || String(r));
const cname = (c) => (isJoker(c) ? 'Joker' : `${SUIT_NAME_TR[c[0]]} ${RANK_NAME_TR[parseInt(c.slice(1), 10)] || parseInt(c.slice(1), 10)}`);
const meldName = (m) => (m.kind === 'run' ? `${SUIT_SYMBOL[m.suit]}${rl(m.lo)}–${rl(m.hi)}` : m.kind === 'set' ? `${rl(m.rank)}'ler` : 'çift');

export function createYanikScreen(deps) {
  const { h, settings } = deps;
  let disp = null; // { hand, sizes, pile, pileN, deck, table }
  let selected = null;
  let note = '';

  const arrange = (hand) => {
    const r = solve(hand, 20);
    const inMeld = r.melds.flat();
    return [...inMeld, ...hand.filter((c) => !inMeld.includes(c))];
  };

  async function dealRound(ctx, st) {
    const v = yanik.viewFor(st, 0);
    v.hand.forEach((c) => ctx.pend.add(c));
    ctx.adj = v.handSizes.map((n, i) => (i === 0 ? 0 : -n));
    disp = { hand: v.hand, sizes: v.handSizes, pile: [], pileN: 0, deck: 106, table: [] };
    ctx.render();
    ctx.resetOrder();
    const mine = arrange(v.hand);
    let k = 0;
    const order = [];
    for (let r = 0; r < 10; r++) for (let i = 0; i < ctx.n; i++) {
      const seat = (st.starter + i) % ctx.n;
      if (!v.handSizes[seat]) continue; // çekilen oyuncuya kart dağıtılmaz
      order.push({ seat, card: seat === 0 ? mine[k++] : null });
    }
    order.push({ seat: st.starter, card: st.starter === 0 ? mine[k++] : null });
    await choreo.deal(ctx, order, { from: ctx.deckBox() });
    ctx.adj = Array(ctx.n).fill(0);
    disp = null;
  }

  /** Kartları sırayla yerdeki yerlerine uçur. srcOf(c): kaynak kutu */
  async function flyTo(ctx, cards, srcOf, { reveal = false } = {}) {
    const { A } = ctx;
    await Promise.all(cards.map((c, k) => A.sleep(k * 70).then(() => {
      if (ctx.pos && srcOf.bump) ctx.bumpCount(srcOf.bump, -1);
      return ctx.fly(c, srcOf(c), ctx.cardBox(c), { duration: A.dur('play'), easing: A.EASE.land, reveal }).then(() => ctx.reveal(c));
    })));
  }

  return createMatchScreen(deps, {
    title: 'Yanık',
    arrange: true,
    tally: (s) => ({ head: 'Ceza', totals: s.totals, note: `Çanak ${s.pot} · paralar: ${s.money.join(' · ')}` }),
    yazbozRow: (e) => {
      const re = e.event.roundEnd;
      return re ? { cells: re.pens.map((p, i) => `${p}${re.burned.includes(i) ? ' 🔥' : ''}`) } : null;
    },
    game: yanik,
    players: () => settings.get('yanikPlayers'),
    askPlayers: { key: 'yanikPlayers', options: [2, 3, 4] },
    makeConfig: () => {
      // cüzdan oyundan oyuna taşınır; girişe ve bir yanmaya yetmiyorsa ocakçı 1000 ile tazeler
      let w = +settings.get('wallet');
      if (!(w >= STAKE * 3)) w = START_MONEY;
      return { money: w, stake: STAKE, humanOut: true };
    },
    maxThink: 550,
    reset() {
      disp = null;
      selected = null;
      note = '';
    },
    onTurn() {
      selected = null;
    },
    onStart: (ctx) => dealRound(ctx, ctx.state),

    async onMove(e, ctx, before) {
      const { A } = ctx;
      const seat = e.seat;
      const mv = e.move;
      const ev = e.event.ev || {};
      const bv = yanik.viewFor(before, 0);
      const av = yanik.viewFor(e.state, 0);
      selected = null;
      note = '';
      const base = { hand: bv.hand, sizes: bv.handSizes.slice(), pile: bv.pile, pileN: bv.pileSize, deck: bv.deckLeft, table: bv.table };
      const re = e.event.roundEnd;
      const srcHand = (c) => (seat === 0 ? ctx.cardBox(c) : ctx.seatBox(seat));

      if (mv.t === 'rebuy' || mv.t === 'quit') {
        note = mv.t === 'rebuy' ? `${ctx.name(seat)} çanağa ${ev.cost} koyup tekrar girdi` : `${ctx.name(seat)} masadan çekildi`;
        ctx.render();
        await ctx.wait(1200);
        note = '';
        if (e.event.newRound) await dealRound(ctx, e.state);
        return;
      }
      if (mv.t === 'draw') {
        if (!ev.t) {
          disp = null; // deste bitti, el sona erdi
        } else {
          const fromPile = mv.from === 'pile';
          const card = fromPile ? ev.c : seat === 0 ? av.hand.find((c) => !bv.hand.includes(c)) : null;
          const src = fromPile ? ctx.cardBox(ev.c) : ctx.deckBox();
          const sizes = base.sizes;
          disp = { ...base, hand: seat === 0 ? [...bv.hand, card] : bv.hand, sizes, pile: fromPile ? bv.pile.slice(0, -1) : bv.pile, pileN: bv.pileSize - (fromPile ? 1 : 0), deck: fromPile ? bv.deckLeft : bv.deckLeft - 1 };
          if (seat === 0) ctx.pend.add(card);
          if (fromPile) ctx.hide(ev.c);
          ctx.render();
          const to = seat === 0 ? ctx.cardBox(card) : ctx.seatBox(seat);
          if (fromPile) await ctx.fly(card, src, to, { duration: A.dur('pass'), easing: A.EASE.move });
          else await ctx.fly(card, src, to, { duration: A.dur('deal') * 1.4, easing: A.EASE.land, reveal: seat === 0 });
          if (seat === 0) ctx.reveal(card);
          else ctx.bumpCount(seat, 1);
          if (fromPile && seat !== 0) note = `${ctx.name(seat)} yandan ${cname(card)} aldı`;
          disp = null;
          if (!re) return;
        }
      } else if (mv.t === 'open' || mv.t === 'lay') {
        const cards = ev.melds.flatMap((m) => m.cards);
        note = mv.t === 'open' ? `${ctx.name(seat)} ${ev.mode === 'cift' ? 'çift' : 'per'} açtı` : `${ctx.name(seat)} yeni per açtı`;
        const sizes = base.sizes;
        sizes[seat] -= cards.length;
        disp = { ...base, hand: seat === 0 ? bv.hand.filter((c) => !cards.includes(c)) : bv.hand, sizes, table: [...bv.table, ...ev.melds] };
        if (seat !== 0) ctx.adj[seat] = (ctx.adj[seat] || 0) + cards.length; // kutudaki sayı kartlar kalktıkça düşer
        const boxes = Object.fromEntries(cards.map((c) => [c, srcHand(c)]));
        cards.forEach((c) => ctx.pend.add(c));
        ctx.render();
        await Promise.all(cards.map((c, k) => A.sleep(k * 70).then(() => {
          if (seat !== 0) ctx.bumpCount(seat, -1);
          return ctx.fly(c, boxes[c], ctx.cardBox(c), { duration: A.dur('play'), easing: A.EASE.land, reveal: seat !== 0 }).then(() => ctx.reveal(c));
        })));
        ctx.adj[seat] = 0;
        disp = null;
      } else if (mv.t === 'add') {
        const c = ev.c;
        note = `${ctx.name(seat)} ${cname(c)} işledi`;
        const sizes = base.sizes;
        sizes[seat]--;
        const src = srcHand(c);
        disp = { ...base, hand: seat === 0 ? bv.hand.filter((x) => x !== c) : bv.hand, sizes, table: av.table };
        ctx.pend.add(c);
        ctx.render();
        await ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur('play'), easing: A.EASE.land, reveal: seat !== 0 });
        ctx.reveal(c);
        disp = null;
      } else if (mv.t === 'swap') {
        const c = ev.c;
        const j = ev.joker;
        note = `${ctx.name(seat)} ${cname(c)} koyup jokeri aldı`;
        const src = srcHand(c);
        const jbox = ctx.cardBox(j);
        disp = { ...base, hand: seat === 0 ? [...bv.hand.filter((x) => x !== c), j] : bv.hand, table: av.table };
        ctx.pend.add(c);
        if (seat === 0) ctx.pend.add(j);
        ctx.render();
        await Promise.all([
          ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur('play'), easing: A.EASE.land, reveal: seat !== 0 }).then(() => ctx.reveal(c)),
          A.sleep(150).then(() => ctx.fly(j, jbox, seat === 0 ? ctx.cardBox(j) : ctx.seatBox(seat), { duration: A.dur('pass'), easing: A.EASE.move })).then(() => seat === 0 && ctx.reveal(j)),
        ]);
        disp = null;
      } else if (mv.t === 'discard') {
        const c = mv.c;
        const src = srcHand(c);
        const sizes = base.sizes;
        sizes[seat]--;
        disp = { ...base, hand: seat === 0 ? bv.hand.filter((x) => x !== c) : bv.hand, sizes, pile: [...bv.pile, c].slice(-4), pileN: bv.pileSize + 1 };
        if (ev.fault) note = `${ctx.name(seat)} işlenebilecek kartı attı: +10 ceza`;
        ctx.pend.add(c);
        ctx.render();
        await ctx.fly(c, src, ctx.cardBox(c), { duration: A.dur(seat === 0 ? 'play' : 'botPlay'), easing: A.EASE.land });
        ctx.reveal(c);
        if (!re) {
          disp = null;
          return;
        }
      }
      if (!re) return;
      // ---- el sonu ----
      note = re.finisher >= 0 ? `${ctx.name(re.finisher)} bitti!` : 'Deste bitti';
      ctx.render();
      await ctx.wait(800);
      const rows = re.pens.map((p, i) => h('div', { class: 'drow' },
        h('span', {}, `${ctx.name(i)}${i === re.finisher ? ' — bitti' : re.opened[i] === 'cift' ? ' (çift: 2 kat)' : re.opened[i] ? '' : ' (açmadı)'}${re.extra[i] ? ` +${re.extra[i]} işleme cezası` : ''}`),
        h('b', { class: p ? 'neg' : 'pos' }, `+${p} → ${re.totals[i]}${re.burned.includes(i) ? ' 🔥 YANDI' : ''}`)));
      const ns = e.state;
      const more = re.burned.length ? 'Yananlar ya çekilir ya da çanağa koyduğunun 2 katını koyup tekrar girer.' : '';
      await ctx.ask(h('div', {}, rows, h('div', { class: 'hint' }, `Çanak: ${ns.pot} · ${more}`)), `El ${re.round + 1}`);
      const to = ctx.deckBox();
      const ids = [...ctx.body.querySelectorAll('.ymelds [data-card], .ypile [data-card], .khand .kc[data-card]')].map((n) => n.dataset.card);
      const jobs = ids.map((id, k) => {
        const from = ctx.cardBox(id);
        ctx.hide(id);
        return A.fly(ctx.cardEl(ctx.parseCard(id)), from, to, { duration: A.dur('collect'), easing: A.EASE.leave, delay: k * 18, flipTo: ctx.cardEl(null) });
      });
      const sizes = (disp || base).sizes;
      for (let i = 1; i < ctx.n; i++) {
        const n = Math.min(sizes[i] + (ctx.adj[i] || 0), 6);
        for (let k = 0; k < n; k++) jobs.push(A.sleep(k * 50).then(() => {
          if (k === n - 1) ctx.bumpCount(i, -(sizes[i] + (ctx.adj[i] || 0)));
          return A.fly(ctx.cardEl(null), ctx.seatBox(i), to, { duration: A.dur('collect'), easing: A.EASE.leave });
        }));
      }
      await Promise.all(jobs);
      note = '';
      ctx.adj = Array(ctx.n).fill(0);
      if (!yanik.isOver(e.state) && e.state.phase !== 'rebuy') await dealRound(ctx, e.state);
      disp = null;
    },

    render(ctx) {
      const s = ctx.state;
      const v = ctx.view(0);
      const d = disp || {};
      const hand = d.hand ?? v.hand;
      const sizes = d.sizes ?? v.handSizes;
      const pile = d.pile ?? v.pile;
      const pileN = d.pileN ?? v.pileSize;
      const deck = d.deck ?? v.deckLeft;
      const table = d.table ?? v.table;
      const my = ctx.awaiting && !disp && v.turn === 0 && s.phase !== 'over';
      const pend = (c) => (ctx.pend.has(c) ? ' pend' : '');
      const melds = h('div', { class: 'ymelds' }, table.map((m) => h('div', { class: `ym ${m.kind}` },
        m.cards.map((c) => h('div', { class: `ymc${pend(c)}`, 'data-card': c }, ctx.cardEl(ctx.parseCard(c)))))));
      const pileNode = h('div', { class: 'ypile' }, pile.slice(-4).map((c, k) => h('div', { class: `ypc${pend(c)}`, 'data-card': c, style: `transform:translate(${k * 3}px,${-k * 2}px) rotate(${((k * 37) % 9) - 4}deg);z-index:${k + 1}` }, ctx.cardEl(ctx.parseCard(c)))));
      const deckNode = ctx.deck(deck);
      if (my && v.phase === 'draw') {
        ctx.tapDraw(deckNode, () => ctx.respond({ t: 'draw', from: 'deck' }));
        if (v.pileTop && pileNode.lastChild) ctx.tapDraw(pileNode.lastChild, () => ctx.respond({ t: 'draw', from: 'pile' }));
      }
      const area = h('div', { class: 'center yanik' }, deckNode, pileNode, melds, h('div', { class: 'cnt' }, `Deste ${deck} · yanda ${pileN}`));
      const legal = my ? yanik.legalMoves(s, 0) : [];
      const left = solve(hand, 20);
      let head;
      if (note) head = note;
      else if (my && v.phase === 'draw') head = '▶ Desteye ya da yandaki karta dokun';
      else if (my) head = selected ? `▶ ${cname(selected)}: işle, jokeri al ya da at` : '▶ Aç, işle ya da atacağın kartı seç';
      else head = disp ? ' ' : `${ctx.name(v.turn)} oynuyor`;
      const info = h('div', { class: 'kinfo' },
        h('div', { class: 'kg' }, head),
        h('div', { class: 'sub' }, `Cezan ${v.totals[0]}/${LIMIT}${v.burns[0] ? ` · ${v.burns[0]} yanık` : ''} · elindeki ${handPen(hand)}${v.opened[0] ? ` · açtın (${v.opened[0]})` : ''}`),
        h('div', { class: 'sub' }, `Çanak ${v.pot} · paran ${v.money[0]} · ${left.melds.length} per hazır`));
      const out = [ctx.table({
        area, info, count: (i) => sizes[i],
        chipSub: (i) => (v.out[i] ? 'çekildi' : `ceza ${v.totals[i]}`),
        chipCls: (i) => (v.out[i] ? 'done' : !disp && v.turn === i && s.phase !== 'over' ? 'turn' : ''),
      })];
      if (my && v.phase === 'rebuy') {
        const cost = v.entry[0] * 2;
        const can = v.money[0] >= cost;
        out.push(h('div', { class: 'announce panel' }, h('b', {}, `Yandın! Cezan ${v.totals[0]}`),
          h('div', { class: 'hint' }, can ? `Tekrar girmek için çanağa ${cost} koyarsın (paran ${v.money[0]}); cezan masadaki en yüksek cezayla başlar.` : `Tekrar girmeye paran yetmiyor (${cost} gerekli).`),
          h('div', { class: 'pgrid two' },
            h('button', { class: 'btn', disabled: !can, onclick: () => ctx.respond({ t: 'rebuy' }) }, `Tekrar gir (${cost})`),
            h('button', { class: 'btn', onclick: () => ctx.respond({ t: 'quit' }) }, 'Çekil'))));
      }
      if (my && v.phase === 'act') {
        const btn = (label, m) => h('button', { class: 'btn', onclick: () => { selected = null; ctx.respond(m); } }, label);
        const bs = [];
        for (const m of legal) {
          if (m.t === 'open') bs.push(btn(m.mode === 'per' ? 'Yere aç (per)' : 'Çift aç', m));
          if (m.t === 'lay') bs.push(btn('Yeni per aç', m));
        }
        if (selected) {
          const base = selected.slice(0, -1);
          for (const m of legal) {
            if (m.c && m.c.slice(0, -1) !== base) continue;
            if (m.t === 'add') bs.push(btn(`İşle: ${meldName(v.table[m.m])}`, m));
            if (m.t === 'swap') bs.push(btn(`Jokeri al: ${meldName(v.table[m.m])}`, m));
          }
          bs.push(btn(hand.length === 1 ? 'At ve bit' : `At: ${cname(selected)}`, { t: 'discard', c: selected }));
        }
        if (bs.length) out.push(h('div', { class: 'announce panel ypanel' }, h('div', { class: 'pgrid ygrid' }, bs)));
      }
      out.push(ctx.handRow(ctx.ordered(hand, arrange), {
        drag: true,
        can: () => my && v.phase === 'act',
        selected,
        onTap: (c, can) => {
          if (!can) return;
          if (selected === c) {
            // ikinci dokunuş: işlenecek yer yoksa at
            const other = legal.some((m) => (m.t === 'add' || m.t === 'swap') && m.c.slice(0, -1) === c.slice(0, -1));
            if (!other) {
              selected = null;
              ctx.respond({ t: 'discard', c });
              return;
            }
            selected = null;
          } else selected = c;
          ctx.render();
        },
      }));
      return out;
    },

    endHead: (w, ctx, res) => {
      settings.set('wallet', res.scores[0]); // cüzdan bir sonraki oyuna taşınır
      return w.includes(0) ? `Çanak senin! Paran ${res.scores[0]}` : `Oyun bitti · paran ${res.scores[0]}`;
    },
    fmtScore: (sc) => `${sc} para`,
    rules: (h2) => h2('div', { class: 'rules' },
      h2('p', {}, '2 deste ve 2 joker (106 kart). Herkese 10, başlayana 11 kart; başlayan ilk turda çekmeden atar. Sıran gelince desteden çekersin ya da yandan (önceki oyuncunun attığı) kartı alırsın; yandan alınca açmak zorunda değilsin.'),
      h2('p', {}, 'Per: aynı sayıdan farklı renkte 3-4 kart. Seri: aynı renkten ardışık 3+ kart (as 2\'nin önüne ya da papazın arkasına). Joker her kartın yerine geçer. Çift: aynı kartın iki destesi (ya da kart + joker).'),
      h2('p', {}, 'Yere açmak için en az 2 per/seri ya da 4 çift gerekir. Önceki cezan ile açınca elinde kalanların toplamı (atacağın kart hariç) 100\'ü geçemez. Açtıktan sonra yeni per açabilir, yerdeki perlere kart işleyebilirsin. Yerdeki bir jokerin yerini tutan kart sende varsa koyup jokeri alabilirsin.'),
      h2('p', {}, 'İşlenebilecek kartı atarsan 10 ceza. Son kartını atan biter. El sonunda herkes elinde kalan kadar ceza yer: 2-9 kendi değeri, 10, vale, kız, papaz, as 10, joker 20. Çift açan 2 katını yer.'),
      h2('p', {}, `Paralı oynanır: herkes girişte çanağa ${STAKE} koyar. Toplam cezası 100\'ü geçen yanar: ya masadan çekilir ya da bir önceki koyduğunun 2 katını çanağa koyup tekrar girer; tekrar girenin cezası yanmayanların en yüksek cezasından başlar. Masada tek oyuncu kalınca çanağı o alır. Paran oyundan oyuna taşınır; biterse ocakçı 1000 ile tazeler.`),
      h2('p', {}, 'Kartına dokun: işleyebileceğin, jokerini alabileceğin yerler ve "At" düğmesi çıkar. Aynı karta tekrar dokunmak (işlenecek yer yoksa) onu atar.')),
  });
}
