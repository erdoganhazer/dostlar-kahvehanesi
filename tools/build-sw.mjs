// sw.js üretir: yayınlanacak bütün dosyaların listesi + içerik özetinden sürüm.
// Kullanım: node tools/build-sw.mjs  (GitHub Actions da yayından önce çalıştırır)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const INCLUDE = ['index.html', 'manifest.webmanifest', 'css', 'js', 'assets'];
const files = [];
const walk = (rel) => {
  const abs = path.join(root, rel);
  if (fs.statSync(abs).isDirectory()) for (const f of fs.readdirSync(abs).sort()) walk(path.join(rel, f));
  else if (!/\.(md|txt)$/i.test(rel)) files.push(rel.split(path.sep).join('/'));
};
INCLUDE.forEach(walk);
const hash = crypto.createHash('sha256');
for (const f of files) hash.update(f).update(fs.readFileSync(path.join(root, f)));
const version = hash.digest('hex').slice(0, 12);
const tpl = fs.readFileSync(path.join(root, 'tools/sw.template.js'), 'utf8');
fs.writeFileSync(path.join(root, 'sw.js'), tpl.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(['./', ...files.map((f) => `./${f}`)], null, 1)));
console.log(`sw.js: ${files.length} dosya, sürüm ${version}`);
