// Avatar: çizimle yapılmış kahvehane yüzü (a1…a8) ya da yüklenen fotoğraf. Emoji yok.
// Fotoğraf 96x96'ya kırpılıp JPEG veri adresi olarak saklanır.
import { AVATARS } from '../players/roster.js';
import { portraitSvg } from './portraits.js';

// Her yüz: zemin, ten, saç rengi, saç biçimi, bıyık, gözlük, kasket
const LOOKS = {
  a1: { bg: '#7a1c10', skin: '#e8b48f', hair: '#2b1a12', cut: 'kisa', mus: 'kalin' },
  a2: { bg: '#1f4d3a', skin: '#d9a07a', hair: '#1a1a1a', cut: 'uzun', mus: 'ince' },
  a3: { bg: '#3a2c6b', skin: '#e0a985', hair: '#3b2a1e', cut: 'kel', mus: 'kalin', cap: true },
  a4: { bg: '#5c3a12', skin: '#efc4a3', hair: '#e8e4dc', cut: 'kabarik', mus: 'pala' },
  a5: { bg: '#1d3f66', skin: '#c98f6a', hair: '#141414', cut: 'kisa', mus: null, gl: true },
  a6: { bg: '#6b3f1d', skin: '#e9b896', hair: '#7a4a24', cut: 'topuz', mus: null },
  a7: { bg: '#2f5d5a', skin: '#d6a07c', hair: '#9a9a9a', cut: 'yan', mus: 'ince', gl: true },
  a8: { bg: '#8a5a12', skin: '#f0c9a8', hair: '#4a2a16', cut: 'uzun', mus: null },
};
export function avatarSvg(key) {
  const pt = portraitSvg(key); // a1–a4: Sezai, Kartal, Hilmi, Şerif (ayrıntılı çizim)
  if (pt) return pt;
  const L = LOOKS[key] || LOOKS.a1;
  const hair = {
    kisa: `<path d="M27 40c0-14 9-22 21-22s21 8 21 22c-3-7-9-11-21-11s-18 4-21 11z" fill="${L.hair}"/>`,
    uzun: `<path d="M25 46c-2-18 8-28 23-28s25 10 23 28c-2-9-6-15-23-15S27 37 25 46z" fill="${L.hair}"/><path d="M25 44c-1 10 1 18 5 22l3-18zM71 44c1 10-1 18-5 22l-3-18z" fill="${L.hair}"/>`,
    kel: `<path d="M30 40c2-5 6-8 8-8M66 40c-2-5-6-8-8-8" stroke="${L.hair}" stroke-width="4" stroke-linecap="round"/>`,
    kabarik: `<path d="M24 44c-4-14 6-28 24-28s28 14 24 28c-2-4-4-8-6-9 1-4-6-9-18-9s-19 5-18 9c-2 1-4 5-6 9z" fill="${L.hair}"/><circle cx="24" cy="48" r="5" fill="${L.hair}"/><circle cx="72" cy="48" r="5" fill="${L.hair}"/>`,
    topuz: `<circle cx="48" cy="15" r="7" fill="${L.hair}"/><path d="M26 44c-1-15 8-25 22-25s23 10 22 25c-4-8-10-13-22-13s-18 5-22 13z" fill="${L.hair}"/>`,
    yan: `<path d="M27 41c0-14 9-23 22-23 10 0 19 6 20 18-6-6-16-8-30-4-5 2-9 5-12 9z" fill="${L.hair}"/>`,
  }[L.cut];
  const mus = L.mus === 'kalin' ? `<path d="M36 60c4-4 8-3 12-1 4-2 8-3 12 1-3 3-8 3-12 1-4 2-9 2-12-1z" fill="${L.hair === '#e8e4dc' ? '#d8d2c8' : L.hair}"/>`
    : L.mus === 'ince' ? `<path d="M38 60c4-2 7-2 10 0 3-2 6-2 10 0" stroke="${L.hair}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
      : L.mus === 'pala' ? `<path d="M34 58c5-4 10-3 14 0 4-3 9-4 14 0 2 4 3 9 1 12-2-6-7-8-15-7-8-1-13 1-15 7-2-3-1-8 1-12z" fill="#efebe4"/>` : '';
  const gl = L.gl ? '<g fill="none" stroke="#222" stroke-width="2"><circle cx="40" cy="47" r="6"/><circle cx="56" cy="47" r="6"/><path d="M46 47h4"/></g>' : '';
  const cap = L.cap ? `<path d="M26 36c2-12 11-18 22-18s20 6 22 18z" fill="#4a4a4a"/><path d="M26 36h48c0 3-4 4-10 4H30c-3 0-4-2-4-4z" fill="#333"/>` : '';
  return `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="96" height="96" fill="${L.bg}"/>` +
    `<path d="M14 96c2-18 16-26 34-26s32 8 34 26z" fill="${L.bg === '#1f4d3a' ? '#2a2a2a' : '#3a2a20'}"/><path d="M40 70h16l-2 8h-12z" fill="${L.skin}"/>` +
    `<ellipse cx="48" cy="48" rx="21" ry="24" fill="${L.skin}"/><ellipse cx="27" cy="50" rx="3.5" ry="6" fill="${L.skin}"/><ellipse cx="69" cy="50" rx="3.5" ry="6" fill="${L.skin}"/>` +
    `${hair}<circle cx="40" cy="47" r="2.2" fill="#1b1b1b"/><circle cx="56" cy="47" r="2.2" fill="#1b1b1b"/>` +
    `<path d="M35 41c3-2 6-2 9 0M52 41c3-2 6-2 9 0" stroke="${L.hair === '#e8e4dc' ? '#bfb8ad' : L.hair}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M48 49c-1 4-2 6 0 7" stroke="rgba(0,0,0,.25)" stroke-width="1.6" fill="none"/>${mus}${L.mus ? '' : '<path d="M42 63c4 2 8 2 12 0" stroke="#7a3b2a" stroke-width="2" fill="none" stroke-linecap="round"/>'}${gl}${cap}</svg>`;
}

export function avatarNode(photo, look) {
  const s = document.createElement('span');
  s.className = 'av';
  if (photo) {
    const i = document.createElement('img');
    i.src = photo;
    i.alt = '';
    i.draggable = false;
    s.append(i);
  } else {
    s.classList.add('drawn');
    s.innerHTML = avatarSvg(AVATARS.includes(look) ? look : 'a1');
  }
  return s;
}

export function resizeImage(file, size = 96) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Resim dosyası seç.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const side = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Resim okunamadı.'));
    };
    img.src = url;
  });
}

/** Kart arkası için dikey kırpma (kart oranı 5:7), JPEG veri adresi */
export function resizeImageTo(file, w = 170, h = 238) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Resim dosyası seç.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const k = Math.max(w / img.width, h / img.height);
      const sw = w / k;
      const sh = h / k;
      c.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Resim okunamadı.'));
    };
    img.src = url;
  });
}
