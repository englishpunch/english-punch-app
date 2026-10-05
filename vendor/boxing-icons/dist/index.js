// Vanilla JS / SSR 진입점 (Lucide의 `lucide` 패키지와 같은 쓰임새)
import { icons, iconsByName, defaultAttributes } from './icons.js';

export * from './icons.js';

let counter = 0;
const uid = (name) => `bi-${name}-${++counter}`;
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function rootAttrs(opts = {}) {
  const { size = 24, color = 'currentColor', strokeWidth = 1.75, class: cls, className, id, ...rest } = opts;
  const attrs = { ...defaultAttributes, width: size, height: size, 'stroke-width': strokeWidth, ...rest };
  // 채움 아이콘이라 stroke·fill 모두 currentColor → color 속성 하나로 둘 다 바뀜
  if (color !== 'currentColor') attrs.color = color;
  const c = cls ?? className;
  if (c) attrs.class = c;
  if (!('aria-label' in attrs) && !('aria-hidden' in attrs)) attrs['aria-hidden'] = 'true';
  return { attrs, strokeWidth, id };
}

function nodeToString([tag, attrs, children]) {
  const a = Object.entries(attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  return `<${tag}${a}>${(children || []).map(nodeToString).join('')}</${tag}>`;
}

/** 아이콘 → SVG 문자열 (SSR, 파비콘, innerHTML) */
export function toSvg(icon, opts = {}) {
  const { attrs, strokeWidth, id } = rootAttrs(opts);
  return nodeToString(['svg', attrs, icon.build(id ?? uid(icon.name), strokeWidth)]);
}

const NS = 'http://www.w3.org/2000/svg';
function nodeToElement([tag, attrs, children], doc) {
  const el = doc.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (k !== 'xmlns') el.setAttribute(k, String(v));
  (children || []).forEach((c) => el.appendChild(nodeToElement(c, doc)));
  return el;
}

/** 아이콘 → SVGElement */
export function createElement(icon, opts = {}, doc = globalThis.document) {
  const { attrs, strokeWidth, id } = rootAttrs(opts);
  return nodeToElement(['svg', attrs, icon.build(id ?? uid(icon.name), strokeWidth)], doc);
}

/** <i data-boxing-icon="boxing-glove"></i> 자리표시자를 SVG로 교체 (lucide.createIcons 방식) */
export function createIcons({ icons: set = iconsByName, nameAttr = 'data-boxing-icon', attrs = {}, root = globalThis.document } = {}) {
  root.querySelectorAll(`[${nameAttr}]`).forEach((el) => {
    const icon = set[el.getAttribute(nameAttr)];
    if (!icon) return;
    const own = {};
    for (const { name, value } of Array.from(el.attributes)) if (name !== nameAttr) own[name] = value;
    const merged = { ...attrs, ...own };
    if (attrs.class && own.class) merged.class = `${attrs.class} ${own.class}`;
    if (merged['stroke-width']) { merged.strokeWidth = Number(merged['stroke-width']); delete merged['stroke-width']; }
    el.replaceWith(createElement(icon, merged, el.ownerDocument));
  });
}

export default icons;
