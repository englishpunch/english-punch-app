// 아이콘 원본 데이터 (24×24, Regular 1.75 기준)
// 각 아이콘은 build(id, strokeWidth) → IconNode[] 를 반환합니다.
// IconNode = [tagName, attrs, children?]  — Lucide의 IconNode 모양에 children만 추가.
// 채움(.fill) 아이콘의 밴드·주름은 mask로 파낸 "틈"이라 배경색과 무관하게 비쳐 보입니다.

const BAG_BODY = 'M6.5 9.5C6.5 8.5 9 8 12 8S17.5 8.5 17.5 9.5V19C17.5 21 15 22 12 22S6.5 21 6.5 19Z';
const BAG_CUTS = 'M4 11.66Q12 14.84 20 11.66M4 16.16Q12 19.34 20 16.16';
const BAG_HANGER = 'M11 4.6 7.5 8.6M13 4.6 16.5 8.6';

const GLOVE_FIST = 'M16 16V8.5C16 5 13.5 2.5 10 2.5S4 5 4 8.5V14a2 2 0 0 0 2 2Z';
const GLOVE_THUMB = 'M16 9.5H17.5A2.5 2.5 0 0 1 20 12v0.5A3.5 3.5 0 0 1 16.5 16H16Z';
const GLOVE_CUFF = 'M15 16h-9v3.5a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2Z';
const GLOVE_CUT_BUTT = 'M2 16H22';
const GLOVE_CUT_ROUND = 'M16 10.5V16';
const GLOVE_TILT = 'translate(13.5 11.8) rotate(35) scale(0.9) translate(-12 -12)';

const cutMask = (id, sw, butt, round) => [
  'mask',
  { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 24, height: 24 },
  [
    ['rect', { width: 24, height: 24, fill: '#fff', stroke: 'none' }],
    butt && ['path', { d: butt, fill: 'none', stroke: '#000', 'stroke-width': sw, 'stroke-linecap': 'butt' }],
    round && ['path', { d: round, fill: 'none', stroke: '#000', 'stroke-width': sw, 'stroke-linecap': 'round' }],
  ].filter(Boolean),
];

export const PunchingBag = {
  name: 'punching-bag',
  // 가공용 원본 패스 (Figma 등에서 다시 조립할 때)
  paths: { hangerRing: 'circle cx=12 cy=3.5 r=1.5', hanger: BAG_HANGER, body: BAG_BODY, cuts: BAG_CUTS },
  build: (id, sw) => [
    ['circle', { cx: 12, cy: 3.5, r: 1.5 }],
    ['path', { d: BAG_HANGER }],
    cutMask(id, sw, BAG_CUTS),
    ['path', { d: BAG_BODY, fill: 'currentColor', mask: `url(#${id})` }],
  ],
};

export const BoxingGlove = {
  name: 'boxing-glove',
  paths: {
    fist: GLOVE_FIST,
    thumb: GLOVE_THUMB,
    cuff: GLOVE_CUFF,
    cutStraight: GLOVE_CUT_BUTT,
    cutCrease: GLOVE_CUT_ROUND,
    transform: GLOVE_TILT,
  },
  build: (id, sw) => [
    ['g', { transform: GLOVE_TILT }, [
      cutMask(id, sw, GLOVE_CUT_BUTT, GLOVE_CUT_ROUND),
      ['g', { fill: 'currentColor', mask: `url(#${id})` }, [
        ['path', { d: GLOVE_FIST }],
        ['path', { d: GLOVE_THUMB }],
        ['path', { d: GLOVE_CUFF }],
      ]],
    ]],
  ],
};

export const icons = { PunchingBag, BoxingGlove };
export const iconsByName = { 'punching-bag': PunchingBag, 'boxing-glove': BoxingGlove };

export const defaultAttributes = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.75,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};
