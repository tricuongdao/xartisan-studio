/* Volta — product illustration. A flat technical side elevation so the bodywork
   can be recoloured live from the configurator. */

let uid = 0;

export const PAINTS = {
  bone:    { name: 'Bone',    hex: '#E7E0D0', deep: '#CFC5B0', ink: '#8E8674', swatch: '#E7E0D0' },
  graphite:{ name: 'Graphite',hex: '#3B4046', deep: '#272B2F', ink: '#1B1E21', swatch: '#3B4046' },
  cobalt:  { name: 'Cobalt',  hex: '#2743E8', deep: '#1A2EA8', ink: '#12207A', swatch: '#2743E8' },
  sage:    { name: 'Sage',    hex: '#A3B29C', deep: '#84957C', ink: '#5C6B56', swatch: '#A3B29C' },
  clay:    { name: 'Clay',    hex: '#C36A4E', deep: '#9E4E35', ink: '#753725', swatch: '#C36A4E' },
};

const BODY = 'M168 352c-10-32 12-54 46-60l126-10 130 10c26 4 38 20 36 44l-8 34c-8 28-32 46-62 54l-50 6c-36 4-56 12-64 26l-12 14h-60c-40-18-72-62-82-118z';
const SEAT = 'M268 318c2-15 15-23 33-25l152-12c19-1 31 9 33 23 2 16-10 27-27 29l-154 10c-23 2-39-6-37-25z';

function wheel(id, cx, cy, metal) {
  return `
  <g>
    <circle cx="${cx}" cy="${cy}" r="101" fill="#171A1C"/>
    <circle cx="${cx}" cy="${cy}" r="101" fill="none" stroke="#0B0D0E" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="79" fill="none" stroke="#2B3033" stroke-width="2"/>
    <path d="M${cx - 92} ${cy - 13}a101 101 0 0 1 180 -30" fill="none" stroke="#343A3D" stroke-width="5" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="57" fill="#202528"/>
    <circle cx="${cx}" cy="${cy}" r="57" fill="none" stroke="url(#${id}-metal)" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="47" fill="none" stroke="#0E1112" stroke-width="11"/>
    <g stroke="url(#${id}-metal)" stroke-width="6" stroke-linecap="round">
      <path d="M${cx} ${cy - 47}v94"/><path d="M${cx - 47} ${cy}h94"/>
      <path d="M${cx - 33} ${cy - 33}l66 66"/><path d="M${cx + 33} ${cy - 33}l-66 66"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="15" fill="url(#${id}-metal)"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#2A2F31"/>
  </g>`;
}

export function renderScooter(opts = {}) {
  const key = opts.paint && PAINTS[opts.paint] ? opts.paint : 'cobalt';
  const p = PAINTS[key];
  const id = `s${++uid}`;

  return `
<svg class="scooter ${opts.className || ''}" viewBox="0 0 1000 640" role="img"
     aria-label="Volta electric scooter, side elevation" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}-p" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.hex}"/>
      <stop offset=".7" stop-color="${p.hex}"/>
      <stop offset="1" stop-color="${p.deep}"/>
    </linearGradient>
    <radialGradient id="${id}-sh" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#101315" stop-opacity=".2"/>
      <stop offset=".55" stop-color="#101315" stop-opacity=".07"/>
      <stop offset="1" stop-color="#101315" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-lamp" cx=".45" cy=".4" r=".6">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset=".4" stop-color="#FFF4D6"/>
      <stop offset="1" stop-color="#EBD29A"/>
    </radialGradient>
    <linearGradient id="${id}-metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#D8DBD8"/><stop offset="1" stop-color="#8E9492"/>
    </linearGradient>
  </defs>

  <ellipse cx="500" cy="576" rx="360" ry="30" fill="url(#${id}-sh)"/>
  <ellipse cx="500" cy="568" rx="240" ry="9" fill="#101315" opacity=".12"/>

  ${wheel(id, 250, 465)}
  ${wheel(id, 750, 465)}
  <circle cx="750" cy="465" r="33" fill="none" stroke="#9AA1A0" stroke-width="3" opacity=".85"/>
  <circle cx="750" cy="465" r="25" fill="none" stroke="#9AA1A0" stroke-width="1.5" opacity=".6"/>

  <!-- rear body -->
  <path d="${BODY}" fill="url(#${id}-p)"/>
  <path d="${BODY}" fill="none" stroke="${p.ink}" stroke-opacity=".4" stroke-width="2"/>
  <path d="M204 318c36-12 92-20 132-22 20-1 38 2 52 9" fill="none" stroke="#FFFFFF" stroke-opacity=".32" stroke-width="5" stroke-linecap="round"/>
  <path d="M318 300c18 16 26 36 28 62" fill="none" stroke="${p.ink}" stroke-opacity=".3" stroke-width="2"/>

  <!-- tail light -->
  <path d="M170 336c6-12 18-18 32-20l6 16-26 12c-8 3-14-1-12-8z" fill="#CF4438"/>
  <path d="M182 334l16-6" stroke="#FF9C90" stroke-width="3" stroke-linecap="round" opacity=".85"/>

  <!-- grab rail -->
  <path d="M214 306c44-12 104-16 148-10" fill="none" stroke="url(#${id}-metal)" stroke-width="6" stroke-linecap="round"/>
  <path d="M214 306v-10M362 296v-8" stroke="${p.ink}" stroke-width="3" stroke-linecap="round" opacity=".5"/>

  <!-- deck -->
  <path d="M448 434h168c10 0 16 6 16 15v6c0 9-7 16-16 16H462c-11 0-18-9-16-20z" fill="url(#${id}-p)"/>
  <path d="M448 434h168c10 0 16 6 16 15v6c0 9-7 16-16 16H462c-11 0-18-9-16-20z" fill="none" stroke="${p.ink}" stroke-opacity=".4" stroke-width="2"/>
  <path d="M466 430h150c8 0 13 4 13 9H455c0-5 5-9 11-9z" fill="#2A2F32"/>
  <g stroke="#3D4346" stroke-width="2" stroke-linecap="round">
    <path d="M480 433v2M500 433v2M520 433v2M540 433v2M560 433v2M580 433v2M600 433v2"/>
  </g>
  <path d="M470 471h150v10c0 4-3 7-7 7H477c-4 0-7-3-7-7z" fill="#1D2124"/>
  <g stroke="#4A5054" stroke-width="2"><path d="M486 478h20M514 478h20M542 478h20M570 478h20M598 478h14"/></g>

  <!-- leg shield -->
  <path d="M604 458c-8-40-12-96-6-144 6-44 22-64 52-66l26-2c16-1 26 10 28 26l8 84c2 24 0 60-2 84-2 14-10 22-24 22h-56c-14 0-24-2-26-4z" fill="url(#${id}-p)"/>
  <path d="M604 458c-8-40-12-96-6-144 6-44 22-64 52-66l26-2c16-1 26 10 28 26l8 84c2 24 0 60-2 84-2 14-10 22-24 22h-56c-14 0-24-2-26-4z" fill="none" stroke="${p.ink}" stroke-opacity=".4" stroke-width="2"/>
  <path d="M628 282c4-28 12-40 26-42l18-1" fill="none" stroke="#FFFFFF" stroke-opacity=".3" stroke-width="10" stroke-linecap="round"/>
  <path d="M644 356h52" stroke="${p.ink}" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>
  <path d="M648 370h42" stroke="${p.ink}" stroke-opacity=".3" stroke-width="3" stroke-linecap="round"/>

  <!-- headlight -->
  <path d="M678 274c20-6 36 2 40 18 4 15-5 27-21 29-18 2-30-8-30-24 0-11 4-19 11-23z" fill="#1B2023"/>
  <ellipse cx="704" cy="294" rx="16" ry="19" fill="url(#${id}-lamp)"/>
  <ellipse cx="704" cy="294" rx="16" ry="19" fill="none" stroke="#C3C9C7" stroke-width="2"/>
  <ellipse cx="699" cy="288" rx="6" ry="7" fill="#FFFFFF" opacity=".85"/>

  <!-- seat -->
  <path d="${SEAT}" fill="#24292C"/>
  <path d="${SEAT}" fill="none" stroke="#0E1113" stroke-width="2"/>
  <path d="M280 308c12-10 30-16 50-18l142-11" fill="none" stroke="#454B4F" stroke-width="3" stroke-linecap="round"/>
  <path d="M292 326c16 4 38 4 58 1l124-9" fill="none" stroke="#0D1012" stroke-width="4" stroke-linecap="round"/>
  <path d="M308 302c44-8 94-13 136-15" stroke="#545A5E" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 7"/>

  <!-- cockpit -->
  <path d="M660 250l-6-26c-2-10 4-17 14-19l10-3" fill="none" stroke="#272C2F" stroke-width="16" stroke-linecap="round"/>
  <path d="M608 214c-2-14 8-24 22-26l58-8c14-2 26 6 28 20 2 12-8 22-20 24l-56 8c-16 2-30-6-32-18z" fill="#262B2E"/>
  <path d="M622 208l64-10" stroke="#40474B" stroke-width="4" stroke-linecap="round"/>
  <path d="M626 188c10-8 24-12 36-13l4 12c-12 2-24 6-34 12z" fill="#121618"/>
  <rect x="628" y="176" width="26" height="12" rx="3" fill="#0A0D0E" transform="rotate(-8 641 182)"/>
  <path d="M668 178l6-34" stroke="#272C2F" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="678" cy="132" rx="21" ry="13" transform="rotate(-12 678 132)" fill="#2E3336"/>
  <ellipse cx="676" cy="131" rx="15" ry="8" transform="rotate(-12 676 131)" fill="#AEBCC4" opacity=".9"/>

  <!-- front fender -->
  <path d="M700 404c16-38 46-60 84-60 26 0 48 8 64 22l-10 20c-14-12-30-18-50-18-28 0-52 16-66 46z" fill="url(#${id}-p)"/>
  <path d="M700 404c16-38 46-60 84-60 26 0 48 8 64 22" fill="none" stroke="${p.ink}" stroke-opacity=".4" stroke-width="2"/>
  <path d="M700 404c16-38 46-60 84-60 26 0 48 8 64 22" fill="none" stroke="#FFFFFF" stroke-opacity=".3" stroke-width="3" stroke-linecap="round"/>

  <!-- kickstand + swingarm -->
  <path d="M452 470l-22 76" stroke="#22272A" stroke-width="9" stroke-linecap="round"/>
  <path d="M424 546h36" stroke="#22272A" stroke-width="9" stroke-linecap="round"/>
  <path d="M330 470h76" stroke="#2A2F31" stroke-width="12" stroke-linecap="round"/>
</svg>`;
}
