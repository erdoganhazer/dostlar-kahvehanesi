// Tohumlu (seed'li) rastgele sayı üreteci. Aynı tohum = aynı oyun; test ve tekrar için gerekli.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0) {
  const f = mulberry32(seed);
  f.seed = seed;
  f.int = (n) => Math.floor(f() * n);
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(f() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  // Yaklaşık normal dağılım (üç düzgün sayının toplamı)
  f.gauss = () => f() + f() + f() - 1.5;
  f.fork = () => makeRng(Math.floor(f() * 4294967296));
  return f;
}
