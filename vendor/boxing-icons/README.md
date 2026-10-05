# boxing-icons

SF Symbols 스타일의 채움(.fill) 아이콘 2종 — **샌드백(punching-bag)** 과 **복싱 글러브(boxing-glove, 펀치)**.
24×24 그리드, Regular 굵기(1.75) 기준이고 Lucide와 같은 방식으로 씁니다.

## 설치

빌드 없이 그대로 쓰는 ESM 패키지예요. 폴더째 프로젝트에 넣고 경로로 설치하면 됩니다.

```bash
npm i ./boxing-icons      # 또는 package.json에 "boxing-icons": "file:./boxing-icons"
```

## React (lucide-react와 동일)

```jsx
import { PunchingBag, BoxingGlove } from 'boxing-icons/react';

<PunchingBag />                                  // 24px, 글자색(currentColor)
<BoxingGlove size={32} color="#C93C26" />
<BoxingGlove className="text-red-600 w-5 h-5" /> // CSS color로 칠하기
<PunchingBag title="샌드백" />                    // title → 스크린리더가 읽음 (없으면 aria-hidden)
```

| prop | 기본값 | 설명 |
|---|---|---|
| `size` | `24` | width·height |
| `color` | `currentColor` | 면과 선을 함께 칠함 |
| `strokeWidth` | `1.75` | 외곽 두께 + 밴드·주름 틈 너비 |
| `title` | — | 접근성 라벨 |
| 나머지 | — | `<svg>`에 그대로 전달 (`ref` 포함) |

## Vanilla JS / SSR (lucide 패키지와 동일)

```js
import { createIcons, createElement, toSvg, PunchingBag, BoxingGlove } from 'boxing-icons';

// 1) 자리표시자 일괄 교체
//    <i data-boxing-icon="boxing-glove" class="icon"></i>
createIcons({ attrs: { size: 20 } });

// 2) 엘리먼트 직접 생성
document.body.append(createElement(PunchingBag, { size: 32, color: '#C93C26' }));

// 3) 문자열 (SSR, innerHTML, 템플릿 엔진)
const html = toSvg(BoxingGlove, { size: 16 });
```

## 정적 SVG

`icons/punching-bag.svg`, `icons/boxing-glove.svg` — `currentColor` 기반이라 CSS `color`로 칠해져요.
번들러에서 `import gloveUrl from 'boxing-icons/icons/boxing-glove.svg'` 처럼 가져오거나 Figma에 바로 붙여넣을 수 있어요.

## 사이트 아이콘 (펀치)

`favicon/` 폴더를 사이트 루트(`public/`)에 복사하고 `<head>`에 추가하세요.

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

- `favicon.svg` 투명 배경 글러브, 다크 모드에선 밝은 코랄로 자동 전환
- `favicon.ico` 16·32·48 묶음 (구형 브라우저)
- `favicon-tile.svg` 연한 코랄 타일 배경 버전
- `apple-touch-icon.png` 180, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
- `site.webmanifest` 의 `[YOUR APP NAME]` 은 실제 이름으로 바꿔 주세요

## 가공하기

- **색 바꾸기**: `scripts/build-assets.mjs` 상단의 `ACCENT`, `TILE` 을 바꾸고 `npm run build:assets` (sharp 필요: `npm i -D sharp`). SVG·PNG·ICO가 모두 다시 만들어져요.
- **모양 손보기**: 모든 원본 패스는 `dist/icons.js` 한 곳에 있어요. 각 아이콘의 `paths` 에 몸통·밴드·엄지·커프 패스가 이름별로 들어 있고, 글러브 기울기는 `GLOVE_TILT` 한 줄이에요.
- **아이콘 추가**: 같은 형식으로 `{ name, paths, build(id, strokeWidth) }` 를 만들고 React에선 `createIcon(data, 'Name')` 으로 컴포넌트를 만들면 돼요.

## 구조 메모

채움 아이콘의 흰 밴드·주름선은 덧그린 선이 아니라 `<mask>` 로 파낸 틈이라 어떤 배경 위에서도 비쳐 보여요.
mask id는 인스턴스마다 자동으로 고유하게 생성되므로 한 페이지에 여러 개, 다른 굵기로 써도 충돌하지 않아요.
