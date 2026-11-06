// İçecek çizimlerini düzenlenebilir SVG dosyalarına yazar: assets/drinks/<tür>.svg
// Oyun bu dosyaları kullanır; düzenledikten sonra bu betiği ÇALIŞTIRMA (üstüne yazar). Sıfırlamak için çalıştır.
import fs from 'fs';
globalThis.addEventListener ??= () => {};
const { drinkSvg, DRINKS } = await import('../js/ui/kahvehane.js');
const dir = new URL('../assets/drinks/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
for (const k of Object.keys(DRINKS)) fs.writeFileSync(new URL(`${k}.svg`, dir), drinkSvg(k, 1, k, { file: true }));
console.log('yazıldı:', Object.keys(DRINKS).join(', '));
