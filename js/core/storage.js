// Güvenli depolama. localStorage yoksa ya da hata verirse bellekte tutar (sayfa kapanınca gider).
export function createStorage(ns = 'kartsalonu') {
  const mem = new Map();
  let ok = false;
  try {
    localStorage.setItem(`${ns}.__t`, '1');
    localStorage.removeItem(`${ns}.__t`);
    ok = true;
  } catch (e) {
    ok = false;
  }
  const k = (key) => `${ns}.${key}`;
  return {
    persistent: ok,
    get(key, def = null) {
      try {
        const raw = ok ? localStorage.getItem(k(key)) : mem.get(k(key));
        return raw == null ? def : JSON.parse(raw);
      } catch (e) {
        return def;
      }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      mem.set(k(key), raw);
      if (ok) {
        try {
          localStorage.setItem(k(key), raw);
        } catch (e) {
          ok = false;
        }
      }
    },
    remove(key) {
      mem.delete(k(key));
      if (ok) {
        try {
          localStorage.removeItem(k(key));
        } catch (e) {
          /* yoksay */
        }
      }
    },
  };
}
