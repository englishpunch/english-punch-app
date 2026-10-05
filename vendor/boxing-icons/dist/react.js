// React 진입점 (lucide-react와 같은 쓰임새) — JSX 없이 작성돼 빌드 없이 import 가능
import { createElement as h, forwardRef, useId } from 'react';
import { PunchingBag as BagData, BoxingGlove as GloveData, defaultAttributes } from './icons.js';

const camel = (k) => (k.includes('-') ? k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : k);
const toReact = ([tag, attrs, children], key) => {
  const props = { key };
  for (const [k, v] of Object.entries(attrs)) props[camel(k)] = v;
  return h(tag, props, ...(children || []).map((c, i) => toReact(c, i)));
};

export function createIcon(icon, displayName) {
  const Comp = forwardRef(function Icon(
    { size = 24, color = 'currentColor', strokeWidth = 1.75, className, title, children, ...rest },
    ref,
  ) {
    // 인스턴스마다 고유 mask id (같은 페이지에 여러 개, 다른 굵기여도 충돌 없음)
    const id = `bi-${icon.name}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const svgProps = {};
    for (const [k, v] of Object.entries(defaultAttributes)) svgProps[camel(k)] = v;
    Object.assign(svgProps, {
      ref,
      width: size,
      height: size,
      // stroke·fill 모두 currentColor라 color 하나로 둘 다 칠해짐
      color: color === 'currentColor' ? undefined : color,
      strokeWidth,
      className: ['boxing-icon', `boxing-icon-${icon.name}`, className].filter(Boolean).join(' '),
      ...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true }),
      ...rest,
    });
    return h('svg', svgProps, ...icon.build(id, strokeWidth).map((n, i) => toReact(n, i)), children);
  });
  Comp.displayName = displayName;
  return Comp;
}

export const PunchingBag = createIcon(BagData, 'PunchingBag');
export const BoxingGlove = createIcon(GloveData, 'BoxingGlove');
export { PunchingBag as PunchingBagIcon, BoxingGlove as BoxingGloveIcon };
