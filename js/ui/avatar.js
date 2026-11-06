// Avatar: emoji ya da yüklenen fotoğraf. Fotoğraf 96x96'ya kırpılıp JPEG veri adresi olarak saklanır.
export function avatarNode(photo, emoji) {
  const s = document.createElement('span');
  s.className = 'av';
  if (photo) {
    const i = document.createElement('img');
    i.src = photo;
    i.alt = '';
    i.draggable = false;
    s.append(i);
  } else s.textContent = emoji || '🙂';
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
