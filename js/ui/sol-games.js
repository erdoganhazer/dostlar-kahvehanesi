// Tek kişilik oyunların ekranları: yerleşim, durum yazısı, kurallar. Ortak masa: sol-table.js
import solitaire from '../games/solitaire.js';
import golf from '../games/golf.js';
import freecell from '../games/freecell.js';
import spider from '../games/spider.js';
import { createSolScreen, LAYOUTS } from './sol-table.js';
import { rankOf } from '../games/sol-common.js';

const found = (s) => s.f.reduce((t, p) => t + p.length, 0);
const rules = (lines) => (h) => h('div', { class: 'rules' }, lines.map((l) => h('p', {}, l)));

export function createSolitaireScreen(deps) {
  const { settings } = deps;
  return createSolScreen(deps, {
    title: 'Solitaire',
    game: solitaire,
    layout: LAYOUTS.solitaire,
    makeConfig: () => ({ draw: settings.get('solDraw') }),
    status: (s) => `Hamle ${s.moves || 0} · temelde ${found(s)}/52 · ${s.draw === 3 ? '3 kart' : '1 kart'}`,
    auto: (s) => !s.s.length && !s.w.length && s.t.every((c) => c.every((x) => x.up)) && found(s) < 52,
    fmtScore: (sc) => `${sc}/52 kart temelde`,
    menu: [['Desteden 1 / 3 kart aç', (ctx) => {
      settings.set('solDraw', settings.get('solDraw') === 3 ? 1 : 3);
      ctx.dialog(`Bundan sonra desteden ${settings.get('solDraw')} kart açılacak. Yeni oyunla başlar.`, [['Yeni oyun', () => ctx.newGame(false)], ['Sonra']]);
    }]],
    rules: rules([
      'Amaç: 52 kartın hepsini, her renk için astan papaza sırayla, sağ üstteki dört temele çıkarmak.',
      'Masadaki yedi sütunda kartlar kırmızı-siyah sırayla ve birer azalarak dizilir (siyah 8 üstüne kırmızı 7). Açık dizinin tamamı ya da bir parçası birlikte taşınabilir.',
      'Boş sütuna yalnız papaz (ya da papazla başlayan dizi) konur. Sütundaki kapalı kart, üstü boşalınca açılır.',
      'Desteye dokununca kart açılır (ayardan 1 ya da 3 kart). Deste bitince açılanlar ters çevrilip yeniden kullanılır.',
      'Karta dokun: temele gidebiliyorsa gider, tek yeri varsa oraya gider; birden çok yeri varsa seçilir, hedefe dokun. Şerif\'in resmine dokunursan sıradaki iyi hamleyi söyler.',
    ]),
  });
}

export function createGolfScreen(deps) {
  return createSolScreen(deps, {
    title: 'Golf',
    game: golf,
    layout: LAYOUTS.golf,
    status: (s) => `Masada ${s.t.reduce((n, c) => n + c.length, 0)} kart · destede ${s.s.length}`,
    fmtScore: (sc) => (sc === 0 ? 'Masa temiz!' : `${-sc} kart kaldı`),
    stuckText: (s) => `Deste bitti, oynanacak kart yok. Masada ${s.t.reduce((n, c) => n + c.length, 0)} kart kaldı.`,
    rules: rules([
      'Amaç: masadaki yedi sütunun 35 kartını açık kartın üstüne atıp masayı temizlemek.',
      'Bir sütunun en alttaki kartı, açık kartın bir büyüğü ya da bir küçüğüyse üstüne atılabilir (renk önemsiz). As ile papaz arasında geçiş yok: asın üstüne yalnız 2, papazın üstüne yalnız kız gider.',
      'Oynanacak kart kalmayınca desteye dokun, yeni kart açılır. Deste bitip hamle kalmayınca oyun biter; masada kalan kart sayısı puanındır (az olan iyi).',
    ]),
  });
}

export function createFreecellScreen(deps) {
  return createSolScreen(deps, {
    title: 'FreeCell',
    game: freecell,
    layout: LAYOUTS.freecell,
    status: (s) => `Hamle ${s.moves || 0} · temelde ${found(s)}/52`,
    // her sütun aşağı doğru küçülüyorsa geri kalan kendiliğinden toplanır
    auto: (s) => found(s) < 52 && s.t.every((c) => c.every((x, k) => !k || rankOf(x.c) <= rankOf(c[k - 1].c))),
    fmtScore: (sc) => `${sc}/52 kart temelde`,
    rules: rules([
      'Amaç: 52 kartın hepsini, her renk için astan papaza, sağ üstteki dört temele çıkarmak. Bütün kartlar baştan açıktır; şans az, akıl çok.',
      'Sol üstteki dört boş hücrenin her birine geçici olarak bir kart konabilir.',
      'Sütunlarda kartlar kırmızı-siyah sırayla ve birer azalarak dizilir. Boş sütuna her kart konur.',
      'Birden çok kartı birlikte taşımak, boş hücre ve boş sütun sayısıyla sınırlıdır: (boş hücre + 1) × 2 üzeri boş sütun.',
    ]),
  });
}

export function createSpiderScreen(deps) {
  const { settings } = deps;
  const NAMES = { 1: 'tek renk', 2: 'iki renk', 4: 'dört renk' };
  return createSolScreen(deps, {
    title: 'Spider',
    game: spider,
    layout: LAYOUTS.spider,
    makeConfig: () => ({ suits: settings.get('spiderSuits') }),
    status: (s) => `Dizi ${s.f.length}/8 · ${s.s.length / 10} dağıtım · ${NAMES[s.suits]}`,
    fmtScore: (sc) => `${sc}/8 dizi tamam`,
    mid(before, m, after) {
      // tamamlanan dizi önce sütunda görünsün, sonra kalksın
      if (after.f.length === before.f.length) return null;
      const s = JSON.parse(JSON.stringify(before));
      if (m.t === 'deal') s.t.forEach((col) => col.push({ c: s.s.shift(), up: true }));
      else {
        const a = s.t[+m.from.slice(1)];
        s.t[+m.to.slice(1)].push(...a.splice(a.length - m.n, m.n));
        if (a.length && !a[a.length - 1].up) a[a.length - 1].up = true;
      }
      return s;
    },
    menu: [['Renk sayısı (zorluk)', (ctx) => {
      const pickN = (n) => {
        settings.set('spiderSuits', n);
        ctx.newGame(false);
      };
      ctx.dialog('Kaç renkle oynansın? Tek renk en kolayı.', [['Tek renk', () => pickN(1)], ['İki renk', () => pickN(2)], ['Dört renk', () => pickN(4)]], 'Spider');
    }]],
    rules: rules([
      'İki desteyle (104 kart) oynanır. Amaç: aynı renkten papazdan asa sekiz tam dizi kurmak; tamamlanan dizi masadan kalkar.',
      'Bir kart, rengi ne olursa olsun bir büyüğünün üstüne konur. Birlikte taşınacak kartlar ise aynı renkten sıralı olmalı.',
      'Boş sütuna her kart konur. Sütundaki kapalı kart, üstü boşalınca açılır.',
      'Sağ üstteki desteye dokununca her sütuna birer kart dağıtılır (boş sütun varken dağıtılmaz).',
      'Zorluk menüden: tek renk, iki renk ya da dört renk.',
    ]),
  });
}
