// Arayüz kabuğu: ana menü ve Ayarlar (Oyuncular, Genel). Kullanıcı metni HER ZAMAN textContent ile yazılır.
import { createStorage } from '../core/storage.js';
import { GAMES, GROUPS } from '../games/index.js';
import { Roster, AVATARS, MAX_BOTS } from '../players/roster.js';
import { Settings, PACE_OPTIONS } from '../players/settings.js';
import { cardFace, cardBack, cardJoker } from './card-art.js';
import { LEVEL_NAMES, STYLE_NAMES, SPEED_NAMES } from '../players/bot.js';
import { SUIT_SYMBOL, rankLabel, isRed } from '../core/cards.js';
import { createKingScreen } from './king-table.js';
import { avatarNode, resizeImage, resizeImageTo } from './avatar.js';
import { initSfx, sfx } from './sfx.js';
import { logoSvg } from './logo.js';
import { loadDrinkFiles } from './kahvehane.js';
import { createPistiScreen } from './pisti-table.js';
import { createPapazScreen } from './papaz-table.js';
import { createEsekScreen } from './esek-table.js';
import { createBatakScreen } from './batak-table.js';
import { createBlackjackScreen } from './blackjack-table.js';
import { createBlofScreen } from './blof-table.js';
import { createPokerScreen } from './poker-table.js';
import { createFantiScreen } from './fanti-table.js';
import { createKonkenScreen } from './konken-table.js';
import { createGinScreen } from './gin-table.js';
import { createAltmisaltiScreen } from './altmisalti-table.js';
import { createYanikScreen } from './yanik-table.js';
import { createKilicScreen } from './kilic-table.js';
import { createAtyarisiScreen } from './atyarisi-table.js';
import { createBakaraScreen } from './bakara-table.js';
import { createUcpokerScreen } from './ucpoker-table.js';
import { createSavasScreen } from './savas-table.js';
import { createSolitaireScreen, createGolfScreen, createFreecellScreen, createSpiderScreen } from './sol-games.js';

// Kart resimlerini baştan yükle: boş kart görünmesin
const PRELOAD = [];

const storage = createStorage('kartsalonu');
const roster = new Roster(storage);
const settings = new Settings(storage);
initSfx(settings);
document.title = 'Dostlar Kahvehanesi';
loadDrinkFiles(); // assets/drinks/*.svg (kullanıcının düzenleyebildiği çizimler)

// Kurulabilir uygulama: kendi adresinde (https ya da localhost) ve bir sayfanın içine gömülü değilken servis işçisi kurulur
let installPrompt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
try {
  const top = window.top === window;
  if (top && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    if (!location.hash || location.hash === '#') render();
  });
  addEventListener('appinstalled', () => {
    installPrompt = null;
    render();
  });
} catch {}
// Klasik (resimli) kartlar seçiliyse resimleri önceden yükle
if (settings.get('cardStyle') === 'klasik') for (const su of ['S', 'H', 'D', 'C']) for (let r = 2; r <= 14; r++) { const im = new Image(); im.src = `assets/cards/${su}${r}.webp`; im.decode?.().catch(() => {}); PRELOAD.push(im); }
const app = document.getElementById('app');

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('aria-') && typeof v === 'boolean') {
      el.setAttribute(k, String(v));
      continue;
    }
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Ayarlara göre kart arkası fotoğrafı (yoksa boş: bordo desen) */
function backPhoto() {
  const st = settings.get('backStyle');
  if (st === 'avatar') return settings.get('humanPhoto') || '';
  if (st === 'foto') return settings.get('backPhoto') || '';
  return '';
}

/** Ayarlar: kart arkası seçimi (bordo desen / avatar fotoğrafım / yüklenen fotoğraf) ve önizleme */
function backSection() {
  const prev = h('span', { class: 'backprev' });
  const draw = () => prev.replaceChildren(cardEl(null));
  const sel = h('select', {}, [['ks', 'Bordo desen'], ['avatar', 'Avatar fotoğrafım'], ['foto', 'Yüklediğim fotoğraf']].map(([v, l]) => h('option', { value: v, selected: settings.get('backStyle') === v }, l)));
  const file = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  const up = h('button', { class: 'btn small', type: 'button', onclick: () => file.click() }, 'Fotoğraf yükle');
  const sync = () => {
    up.hidden = sel.value !== 'foto';
    draw();
  };
  sel.addEventListener('change', () => {
    settings.set('backStyle', sel.value);
    if (sel.value === 'avatar' && !settings.get('humanPhoto')) alert2('Avatarın için fotoğraf yüklemediğin için bordo desen görünecek. Avatarın bölümünden fotoğraf yükleyebilirsin.');
    if (sel.value === 'foto' && !settings.get('backPhoto')) file.click();
    sync();
  });
  file.addEventListener('change', async () => {
    try {
      settings.set('backPhoto', await resizeImageTo(file.files[0]));
      settings.set('backStyle', 'foto');
      sel.value = 'foto';
    } catch (e) {
      alert2(e.message);
    }
    file.value = '';
    sync();
  });
  sync();
  return h('div', { class: 'f backsel' }, h('span', {}, 'Kart arkası'), h('div', { class: 'row' }, prev, h('div', { class: 'stack' }, sel, up)), file);
}

function cardEl(card) {
  if (!card) return cardBack(backPhoto());
  if (card.suit === 'J') return cardJoker();
  if (card.rank >= 2 && settings.get('cardStyle') !== 'klasik') return cardFace(card, { four: !!settings.get('fourColor') });
  if (card.rank >= 2) {
    const img = h('img', { src: `assets/cards/${card.suit}${card.rank}.webp`, alt: `${SUIT_SYMBOL[card.suit]}${rankLabel(card)}`, draggable: 'false', decoding: 'sync', loading: 'eager' });
    return h('span', { class: 'card img' }, img);
  }
  return h(
    'span',
    { class: `card${isRed(card) ? ' red' : ''}` },
    h('span', { class: 'cr' }, rankLabel(card), h('br'), SUIT_SYMBOL[card.suit]),
    h('span', { class: 'mid' }, SUIT_SYMBOL[card.suit])
  );
}

function counter(n, digits = 3) {
  const s = String(n).padStart(digits, '0');
  return h('span', { class: 'counter' }, [...s].map((d) => h('i', {}, d)));
}

function shell(title, menu, body) {
  return h(
    'div',
    { class: 'window' },
    h('div', { class: 'titlebar' }, h('span', { class: 'ico' }), title),
    h('div', { class: 'menubar' }, h('span', { class: 'mtitle' }, title), menu),
    body
  );
}

/* ---------- Ana menü ---------- */
const GLYPH = { king: '♥', batak: '♠', teksas: '♦', yanik: '♣', blackjack: '♠', solitaire: '♣' };
/** Ana menünün tepesi: amblem + "Dostlar Kahvehanesi" */
function brand() {
  const logo = h('span', { class: 'blogo' });
  logo.innerHTML = logoSvg(84);
  return h('div', { class: 'brand' }, logo, h('div', { class: 'btxt' }, h('div', { class: 'bt1' }, 'Dostlar'), h('div', { class: 'bt2' }, 'Kahvehanesi'), h('div', { class: 'bt3' }, '· Hazer Erdoğan ·')));
}

function screenMenu() {
  const tile = (g, k) => {
    const ready = g.status === 'ready';
    return h(
      'button',
      { class: `tile${ready ? '' : ' off'}`, disabled: !ready, onclick: () => go(g.id) },
      h('span', { class: `tg${(GLYPH[g.id] || '♠') === '♥' || (GLYPH[g.id] || '') === '♦' ? ' red' : ''}` }, GLYPH[g.id] || ['♠', '♥', '♣', '♦'][k % 4]),
      h('b', {}, g.name),
      h('span', { class: 'td' }, g.desc),
      h('span', { class: 'tp' }, ready ? `${g.players} kişi · Oyna` : `${g.players} kişi · yakında`)
    );
  };
  return shell(
    '',
    [h('button', { onclick: () => go('ayarlar') }, 'Oyuncular'), h('button', { onclick: () => go('ayarlar') }, 'Ayarlar'), h('button', { onclick: () => go('hakkinda') }, 'Yardım')],
    h(
      'div',
      { class: 'felt menufelt' },
      brand(),
      h('h2', {}, `Hoş geldin, ${settings.get('humanName')}`),
      GROUPS.flatMap(([gid, title]) => {
        const list = GAMES.filter((g) => g.group === gid && g.status === 'ready') // yapılacaklar menüde görünmez (docs/HEDEF.md).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
        return list.length ? [h('div', { class: 'sec' }, title), h('div', { class: 'tiles' }, list.map((g, k) => tile(g, k)))] : [];
      }),
      installPrompt && !standalone()
        ? h('button', { class: 'btn installbtn', onclick: async () => {
          installPrompt.prompt();
          await installPrompt.userChoice.catch(() => null);
          installPrompt = null;
          render();
        } }, '📲 Uygulama olarak yükle')
        : null
    )
  );
}

/* ---------- Ayarlar ---------- */
let tab = 'oyuncular';

function screenSettings() {
  const tabs = h(
    'div',
    { class: 'tabs', role: 'tablist' },
    h('button', { role: 'tab', 'aria-selected': tab === 'oyuncular', onclick: () => ((tab = 'oyuncular'), render()) }, 'Oyuncular'),
    h('button', { role: 'tab', 'aria-selected': tab === 'genel', onclick: () => ((tab = 'genel'), render()) }, 'Genel')
  );
  return shell(
    'Ayarlar',
    [h('button', { onclick: () => go('menu') }, '‹ Geri')],
    h('div', { class: 'felt' }, tabs, tab === 'oyuncular' ? playersTab() : generalTab())
  );
}

function playersTab() {
  const rows = roster.list().map((b, i) => {
    const t = roster.totals(b.id);
    return h(
      'div',
      { class: `player${b.active ? '' : ' inactive'}` },
      avatarNode(b.photo, b.avatar),
      h(
        'div',
        { class: 'meta' },
        h('b', {}, b.name),
        h('span', {}, `${LEVEL_NAMES[b.level]} · ${STYLE_NAMES[b.style]} · ${SPEED_NAMES[b.speed]}${t.played ? ` · ${t.won}/${t.played} galibiyet` : ''}${b.active ? '' : ' · kapalı'}`)
      ),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn small', 'aria-label': 'Yukarı taşı', disabled: i === 0, onclick: () => (roster.move(b.id, -1), render()) }, '↑'),
        h('button', { class: 'btn small', 'aria-label': 'Aşağı taşı', disabled: i === roster.list().length - 1, onclick: () => (roster.move(b.id, 1), render()) }, '↓'),
        h('button', { class: 'btn small', onclick: () => editPlayer(b.id) }, 'Düzenle')
      )
    );
  });
  return h(
    'div',
    { class: 'stack' },
    h('p', { class: 'hint' }, 'Masaya sıradan başlayarak aktif oyuncular oturur. Sırayı ok düğmeleriyle değiştirebilirsin.'),
    h('div', { class: 'panel' }, rows),
    h('div', { class: 'row' },
      h('button', { class: 'btn grow', disabled: roster.list().length >= MAX_BOTS, onclick: () => { const b = roster.add({}); render(); if (b) editPlayer(b.id); } }, 'Oyuncu ekle'),
      h('button', { class: 'btn grow', onclick: () => confirm2('Tüm oyuncular varsayılana dönsün mü? İstatistikler silinir.', () => (roster.reset(), render())) }, 'Varsayılana dön')
    )
  );
}

function countSel(key, opts) {
  const sel = h('select', {}, opts.map((n) => h('option', { value: n, selected: n === settings.get(key) }, `${n} kişi`)));
  sel.addEventListener('change', () => settings.set(key, +sel.value));
  return sel;
}

function generalTab() {
  const nameIn = h('input', { type: 'text', value: settings.get('humanName'), maxlength: 14 });
  nameIn.addEventListener('change', () => (settings.set('humanName', nameIn.value), rs()));
  const pace = h('select', {}, PACE_OPTIONS.map((o) => h('option', { value: o.v, selected: o.v === settings.get('paceMult') }, o.label)));
  pace.addEventListener('change', () => settings.set('paceMult', +pace.value));
  const humanPicker = avatarPicker({ avatar: settings.get('humanAvatar'), photo: settings.get('humanPhoto') });
  const kingEnds = h('input', { type: 'checkbox', checked: settings.get('kingEnds') });
  kingEnds.addEventListener('change', () => settings.set('kingEnds', kingEnds.checked));
  return h(
    'div',
    { class: 'stack' },
    h('div', { class: 'panel stack' },
      h('label', { class: 'f' }, 'Adın', nameIn),
      h('label', { class: 'f' }, 'Botların oynama hızı', pace),
      h('label', { class: 'f' }, 'Hamle süren (bitince önerilen hamle oynanır)', (() => {
        const sel = h('select', {}, [[30, '30 saniye'], [15, '15 saniye'], [0, 'Süre yok']].map(([v, l]) => h('option', { value: v, selected: +settings.get('turnLimit') === v }, l)));
        sel.addEventListener('change', () => settings.set('turnLimit', +sel.value));
        return sel;
      })()),
      backSection(),
      h('label', { class: 'f' }, 'Kart görünümü', (() => {
        const sel = h('select', {}, [['buyuk', 'Büyük harfli (kolay okunur)'], ['klasik', 'Klasik (resimli)']].map(([v, l]) => h('option', { value: v, selected: settings.get('cardStyle') === v }, l)));
        sel.addEventListener('change', () => settings.set('cardStyle', sel.value));
        return sel;
      })()),
      ...[['cafe', 'Kahvehane: oyuncuların yanında çay, kahve, oralet…'], ['fourColor', 'Dört renkli deste (karo mavi, sinek yeşil)'], ['chat', 'Sohbet: botlar konuşsun, laf soksun'], ['sound', 'Ses efektleri (kâğıt, sıra, süre, mesaj)'], ['anger', 'Kaybeden botlar sinirlensin']].map(([k, l]) => {
        const cb = h('input', { type: 'checkbox', checked: settings.get(k) });
        cb.addEventListener('change', () => settings.set(k, cb.checked));
        return h('label', { class: 'row' }, cb, l);
      }),
      h('div', { class: 'hint', style: 'color:#000' }, storage.persistent ? 'Ayarlar bu cihazda saklanır.' : 'Bu ortamda kalıcı depolama yok: ayarlar sayfa kapanınca sıfırlanır.')
    ),
    yanciSection(),
    h('div', { class: 'panel stack' },
      h('b', {}, 'Avatarın'),
      humanPicker.node,
      h('button', { class: 'btn small', onclick: () => { const v = humanPicker.get(); settings.set('humanAvatar', v.avatar); settings.set('humanPhoto', v.photo); rs(); } }, 'Kaydet')
    ),
    h('div', { class: 'panel stack' },
      h('b', {}, 'Oyun seçenekleri'),
      h('label', { class: 'f' }, 'Papaz Kaçtı kaç kişilik', countSel('papazPlayers', [2, 3, 4])),
      h('label', { class: 'f' }, 'Eşek kaç kişilik', countSel('esekPlayers', [3, 4])),
      h('label', { class: 'f' }, 'Blackjack kaç kişilik', countSel('blackjackPlayers', [1, 2, 3, 4])),
      h('label', { class: 'f' }, 'Blöf kaç kişilik', countSel('blofPlayers', [3, 4])),
      h('label', { class: 'f' }, 'Poker kaç kişilik', countSel('pokerPlayers', [2, 3, 4]))
    ),
    h('div', { class: 'panel stack' },
      h('b', {}, 'Konken'),
      h('label', { class: 'f' }, 'Puanlama', (() => {
        const sel = h('select', {}, [['ceza', 'Ceza puanı (11 el, en az ceza kazanır)'], ['galibiyet', 'Galibiyet (5 eli ilk bitiren kazanır)']].map(([v, l]) => h('option', { value: v, selected: settings.get('konkenScoring') === v }, l)));
        sel.addEventListener('change', () => settings.set('konkenScoring', sel.value));
        return sel;
      })()),
      ...[['konkenJoker', 'Joker atarak bitmek cezaları 2 katına çıkarır'], ['konkenCifte', 'Çifte (5 çift aynı kart) ile bitmek olsun']].map(([k, l]) => {
        const cb = h('input', { type: 'checkbox', checked: settings.get(k) });
        cb.addEventListener('change', () => settings.set(k, cb.checked));
        return h('label', { class: 'row' }, cb, l);
      })
    ),
    h('div', { class: 'panel stack' },
      h('b', {}, 'King'),
      h('label', { class: 'row' }, kingEnds, 'Bir oyuncu koz elinde 13 eli alırsa (King) oyun biter')
    ),
    h('div', { class: 'panel' },
      h('b', {}, 'Kart görünümü'),
      h('div', { class: 'preview' }, cardEl({ suit: 'S', rank: 14 }), cardEl({ suit: 'H', rank: 12 }), cardEl(null), counter(0))
    )
  );
}

/** Yancı: mod, ad, resim (hazır simge ya da fotoğraf) */
function yanciSection() {
  const name = h('input', { type: 'text', value: settings.get('yanciName'), maxlength: 14 });
  name.addEventListener('change', () => settings.set('yanciName', name.value));
  const picker = avatarPicker({ avatar: settings.get('yanciAvatar'), photo: settings.get('yanciPhoto') });
  return h('div', { class: 'panel stack' },
    h('b', {}, 'Yancı'),
    h('div', { class: 'hint', style: 'color:#000' }, 'Masada sağ altında oturur, oyunu muhabbetle takip eder. Resmine dokununca ipucu verir; altındaki 🔇 ile susar. Çay ısmarlarsan ona da gelir.'),
    h('label', { class: 'f' }, 'Adı', name),
    picker.node,
    h('button', { class: 'btn small', onclick: () => { const v = picker.get(); settings.set('yanciAvatar', v.avatar); settings.set('yanciPhoto', v.photo); rs(); } }, 'Resmi kaydet'));
}

function avatarPicker(init) {
  const st = { avatar: init.avatar, photo: init.photo || '' };
  const wrap = h('div', { class: 'stack' });
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
  function draw() {
    const btns = AVATARS.map((a) => h('button', { type: 'button', class: 'avpick', 'aria-pressed': !st.photo && a === st.avatar, onclick: () => { st.avatar = a; st.photo = ''; draw(); } }, avatarNode('', a)));
    wrap.replaceChildren(
      h('div', { class: 'row' },
        avatarNode(st.photo, st.avatar),
        h('button', { type: 'button', class: 'btn small', onclick: () => file.click() }, 'Fotoğraf yükle'),
        st.photo ? h('button', { type: 'button', class: 'btn small', onclick: () => { st.photo = ''; draw(); } }, 'Kaldır') : null),
      h('div', { class: 'avatars' }, btns),
      file);
  }
  file.addEventListener('change', async () => {
    try { st.photo = await resizeImage(file.files[0]); } catch (e) { alert2(e.message); }
    file.value = '';
    draw();
  });
  draw();
  return { node: wrap, get: () => ({ ...st }) };
}

function editPlayer(id) {
  const b = roster.get(id);
  if (!b) return;
  const picker = avatarPicker({ avatar: b.avatar, photo: b.photo });
  const name = h('input', { type: 'text', value: b.name, maxlength: 14 });
  const sel = (opts, cur) => h('select', {}, Object.entries(opts).map(([v, label]) => h('option', { value: v, selected: String(v) === String(cur) }, label)));
  const level = sel(LEVEL_NAMES, b.level);
  const style = sel(STYLE_NAMES, b.style);
  const speed = sel(SPEED_NAMES, b.speed);
  const active = h('input', { type: 'checkbox', checked: b.active });
  const close = () => overlay.remove();
  const overlay = h('div', { class: 'overlay', onclick: (e) => e.target === overlay && close() },
    h('div', { class: 'dialog', role: 'dialog', 'aria-label': 'Oyuncu düzenle' },
      h('div', { class: 'dt' }, 'Oyuncu'),
      h('div', { class: 'db' },
        h('label', { class: 'f' }, 'Ad', name),
        picker.node,
        h('label', { class: 'f' }, 'Seviye', level),
        h('label', { class: 'f' }, 'Tarz', style),
        h('label', { class: 'f' }, 'Hız', speed),
        h('label', { class: 'row' }, active, 'Masaya oturabilir'),
        h('div', { class: 'row' },
          h('button', { class: 'btn grow', onclick: () => { roster.update(id, { name: name.value, ...(({ avatar, photo }) => ({ avatar, photo }))(picker.get()), level: level.value, style: style.value, speed: speed.value, active: active.checked }); close(); render(); } }, 'Kaydet'),
          h('button', { class: 'btn grow', onclick: close }, 'İptal'),
          h('button', { class: 'btn grow', onclick: () => confirm2(`${b.name} silinsin mi?`, () => { if (!roster.remove(id)) alert2('Son oyuncu silinemez.'); close(); render(); }) }, 'Sil')
        )
      )
    )
  );
  document.body.append(overlay);
}

function dialog(content, buttons, title = 'Dostlar Kahvehanesi') {
  const close = () => ov.remove();
  const ov = h('div', { class: 'overlay' },
    h('div', { class: 'dialog' }, h('div', { class: 'dt' }, title),
      h('div', { class: 'db' }, typeof content === 'string' ? h('div', {}, content) : content,
        h('div', { class: 'row' }, buttons.map(([label, fn]) => h('button', { class: 'btn grow', onclick: () => { close(); fn && fn(); } }, label)))))
  );
  document.body.append(ov);
}
const alert2 = (t) => dialog(t, [['Tamam']]);
const confirm2 = (t, yes) => dialog(t, [['Evet', yes], ['Hayır']]);

/* ---------- Yardım ---------- */
function screenAbout() {
  return shell('Yardım', [h('button', { onclick: () => go('menu') }, '‹ Geri')],
    h('div', { class: 'felt' }, h('h2', {}, 'Dostlar Kahvehanesi'),
      h('p', {}, 'Telefonda ve bilgisayarda oynanan kart oyunları. Aynı bot oyuncular tüm oyunlarda oturur; seviyelerini ve tarzlarını Ayarlar > Oyuncular’dan değiştirirsin.'),
      h('p', { class: 'hint' }, 'Kart resimleri: Vector Playing Cards (public domain), hayeah/playing-cards-assets (MIT).')));
}

/* ---------- Yönlendirme (yalnızca düz #ad) ---------- */
let cleanup = null;
function screenKing() {
  const k = createKingScreen({ h, shell, avatarNode, cardEl, counter, roster, settings, go, dialog });
  cleanup = k.destroy;
  return k.el;
}
// Ayar ekranındaki değişiklikler: normalde uygulamayı yeniden çizer; oyun içi ayar katmanında yalnız katmanı tazeler (oyun kapanmaz)
let settingsRefresh = null;
const rs = () => (settingsRefresh ? settingsRefresh() : render());
/** Oyun içi ayarlar (mola menüsünden): oyunun üstünde katman; kapanınca onClose (oyun yeniden çizilir) */
function openSettings(onClose) {
  const body = h('div', { class: 'setbody felt' });
  const fill = () => body.replaceChildren(generalTab());
  const close = () => {
    settingsRefresh = null;
    ov.remove();
    onClose && onClose();
  };
  const ov = h('div', { class: 'setov' },
    h('div', { class: 'setbox' }, h('div', { class: 'sethead' }, h('span', {}, 'Ayarlar'), h('button', { class: 'btn small', onclick: close }, 'Kapat')), body));
  settingsRefresh = fill;
  fill();
  document.body.append(ov);
}
const matchDeps = () => ({ h, shell, avatarNode, cardEl, counter, roster, settings, go, dialog, openSettings });
const mk = (fn) => () => { const k = fn(matchDeps()); cleanup = k.destroy; return k.el; };
const routes = { menu: screenMenu, ayarlar: screenSettings, hakkinda: screenAbout, king: screenKing,
  pisti: mk(createPistiScreen), papazkacti: mk(createPapazScreen), esek: mk(createEsekScreen), batak: mk(createBatakScreen), blackjack: mk(createBlackjackScreen), blof: mk(createBlofScreen), teksas: mk(createPokerScreen), fanti: mk(createFantiScreen), konken: mk(createKonkenScreen), gin: mk(createGinScreen), altmisalti: mk(createAltmisaltiScreen), yanik: mk(createYanikScreen), solitaire: mk(createSolitaireScreen), golf: mk(createGolfScreen), freecell: mk(createFreecellScreen), spider: mk(createSpiderScreen), kilic: mk(createKilicScreen), atyarisi: mk(createAtyarisiScreen), bakara: mk(createBakaraScreen), ucpoker: mk(createUcpokerScreen), savas: mk(createSavasScreen) };
function current() {
  const r = location.hash.replace('#', '');
  return routes[r] ? r : 'menu';
}
function go(r) {
  if (location.hash.replace('#', '') === r) render();
  else location.hash = r;
}
function render() {
  if (cleanup) { cleanup(); cleanup = null; }
  app.replaceChildren(routes[current()]());
}
addEventListener('hashchange', render);
render();
