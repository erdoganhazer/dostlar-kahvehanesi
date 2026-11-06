// Dostlar Kahvehanesi amblemi: bordo-altın yuvarlak içinde yelpaze üç kâğıt ve önde buharı tüten ince belli çay bardağı.
// Kendi çizimimiz (SVG); ana menünün tepesinde ve sekme simgesinde kullanılır.
export function logoSvg(size = 72) {
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="lgbg" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#9c1b1b"/><stop offset="1" stop-color="#4a0909"/></radialGradient>
    <linearGradient id="lggold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset=".5" stop-color="#d9a640"/><stop offset="1" stop-color="#9c6b1c"/></linearGradient>
    <linearGradient id="lgtea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d2541f"/><stop offset="1" stop-color="#5e1504"/></linearGradient>
  </defs>
  <circle cx="60" cy="60" r="57" fill="url(#lgbg)" stroke="url(#lggold)" stroke-width="5"/>
  <circle cx="60" cy="60" r="49" fill="none" stroke="#d9a640" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>
  <!-- yelpaze kâğıtlar -->
  <g transform="translate(60 74)">
    <g transform="rotate(-28)"><rect x="-13" y="-52" width="26" height="38" rx="3" fill="#fbf6e6" stroke="#9c6b1c" stroke-width="1.2"/><text x="-9" y="-41" font-family="Roboto Slab, Georgia, serif" font-weight="800" font-size="10" fill="#111">A</text><text x="-1" y="-24" font-size="13" fill="#111">♠</text></g>
    <g transform="rotate(28)"><rect x="-13" y="-52" width="26" height="38" rx="3" fill="#fbf6e6" stroke="#9c6b1c" stroke-width="1.2"/><text x="-9" y="-41" font-family="Roboto Slab, Georgia, serif" font-weight="800" font-size="10" fill="#c0392b">K</text><text x="-1" y="-24" font-size="13" fill="#c0392b">♦</text></g>
    <g><rect x="-13" y="-56" width="26" height="38" rx="3" fill="#fffaf0" stroke="#9c6b1c" stroke-width="1.2"/><text x="-9" y="-45" font-family="Roboto Slab, Georgia, serif" font-weight="800" font-size="10" fill="#c0392b">Q</text><text x="-1" y="-28" font-size="13" fill="#c0392b">♥</text></g>
  </g>
  <!-- buhar -->
  <path d="M55 52c-3-4 3-6 0-10M63 50c-3-4 3-6 0-10" stroke="#fbe9c0" stroke-width="2" fill="none" stroke-linecap="round" opacity=".85"/>
  <!-- tabak -->
  <ellipse cx="60" cy="100" rx="22" ry="5" fill="#f7f4ee" stroke="#9c6b1c" stroke-width="1"/>
  <ellipse cx="60" cy="100" rx="17" ry="3.4" fill="none" stroke="#c0392b" stroke-width="1.2" stroke-dasharray="3 2"/>
  <!-- ince belli bardak -->
  <path d="M49 58C50 66 56 70 55.5 77C55 82 52 86 52.8 92C53.4 96 55.4 98 57 98.4H63C64.6 98 66.6 96 67.2 92C68 86 65 82 64.5 77C64 70 70 66 71 58Z" fill="url(#lgtea)" stroke="#fff" stroke-width="1.4"/>
  <path d="M51.5 60.5C52.5 66 56.5 70 56.3 76" stroke="rgba(255,255,255,.7)" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="60" cy="58" rx="11" ry="1.6" fill="#f4b183" stroke="#fff" stroke-width="1"/>
</svg>`;
}
