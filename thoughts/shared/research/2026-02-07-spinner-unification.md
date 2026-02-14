---
date: 2026-02-07T00:00:00+09:00
researcher: th.kim
git_commit: cc0574a655673059312b9c0077119bb7a53c6704
branch: main
repository: english-punch-app
topic: "스피너/로딩 인디케이터 현황 조사 및 통일 방안"
tags: [research, codebase, spinner, loading, ui-components]
status: complete
last_updated: 2026-02-07
last_updated_by: th.kim
---

# Research: 스피너/로딩 인디케이터 현황 조사

**Date**: 2026-02-07
**Researcher**: th.kim
**Git Commit**: cc0574a655673059312b9c0077119bb7a53c6704
**Branch**: main
**Repository**: english-punch-app

## Research Question

코드베이스 전체에서 사용되는 스피너/로딩 인디케이터의 현황을 파악하고, 통일을 위한 기초 자료를 정리한다.

## Summary

코드베이스에는 **전용 Spinner 컴포넌트가 없으며**, 각 페이지에서 `Loader2` (lucide-react) 아이콘 또는 CSS border spinner를 직접 인라인으로 사용하고 있다. 총 **10개 파일**에서 스피너가 사용되며, 사이즈(4종), 색상(3종), aria 속성, 래핑 패턴이 파일마다 다르다. 유일하게 `Button` 컴포넌트만 `loading` prop을 통해 통합된 로딩 상태를 제공한다.

## Detailed Findings

### 1. 스피너 유형: 2가지

#### 1-1. Loader2 아이콘 (lucide-react) — 8개 파일

```tsx
import { Loader2 } from "lucide-react";
<Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-hidden />
```

사용 파일:
- `src/App.tsx`
- `src/components/ActivityPage.tsx`
- `src/components/ProfilePage.tsx`
- `src/components/CardEditPage.tsx`
- `src/components/BagDetailPage.tsx`
- `src/components/FSRSStudySession.tsx`
- `src/components/StudyCard.tsx`
- `src/components/Button.tsx`

#### 1-2. CSS Border Spinner — 2개 파일

```tsx
<div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2"></div>
```

사용 파일:
- `src/components/BagManager.tsx`
- `src/components/BagStats.tsx`

### 2. 사이즈 변형 (4종)

| 사이즈 | 클래스 | 픽셀 | 사용처 |
|--------|--------|------|--------|
| XS | `h-4 w-4` | 16px | Button.tsx, BagDetailPage.tsx (인라인 로딩) |
| SM | `h-6 w-6` | 24px | ActivityPage, ProfilePage, CardEditPage, FSRSStudySession |
| MD | `h-8 w-8` | 32px | BagManager, BagStats (CSS border spinner) |
| LG | `h-10 w-10` | 40px | App.tsx (전체 화면), StudyCard.tsx (오버레이) |

### 3. 색상 변형 (3종)

| 색상 | 클래스 | 사용처 |
|------|--------|--------|
| Primary | `text-primary-600` | App, FSRSStudySession, ProfilePage, ActivityPage, StudyCard |
| Gray 400 | `text-gray-400` | CardEditPage |
| 상속/없음 | (부모 색상 상속) | BagDetailPage, Button |
| Primary (border) | `border-primary-500` | BagManager, BagStats (CSS spinner) |

### 4. aria-hidden 속성 불일치

| 있음 (`aria-hidden`) | 없음 |
|---|---|
| App.tsx | CardEditPage.tsx |
| FSRSStudySession.tsx | BagDetailPage.tsx |
| ProfilePage.tsx | StudyCard.tsx |
| ActivityPage.tsx | BagManager.tsx |
| Button.tsx | BagStats.tsx |

### 5. 래핑 패턴 (4종)

#### Pattern A: 페이지 레벨 센터링 (가장 흔함)
```tsx
<div className="flex items-center justify-center py-12">
  <Loader2 className="text-primary-600 h-6 w-6 animate-spin" aria-hidden />
</div>
```
사용: ActivityPage, ProfilePage, CardEditPage, FSRSStudySession, BagManager, BagStats

#### Pattern B: 전체 화면 센터링
```tsx
<div className="flex min-h-screen items-center justify-center bg-white" data-testid="global-loader">
  <Loader2 className="text-primary-600 h-10 w-10 animate-spin" aria-hidden />
</div>
```
사용: App.tsx

#### Pattern C: 오버레이
```tsx
<div className="bg-opacity-75 absolute inset-0 flex items-center justify-center bg-white">
  <Loader2 className="text-primary-600 h-10 w-10 animate-spin" />
</div>
```
사용: StudyCard.tsx

#### Pattern D: 인라인 (텍스트 옆)
```tsx
<span className="flex items-center gap-2 text-gray-500">
  <Loader2 className="h-4 w-4 animate-spin" />
  {t("bagDetail.loadingMore")}
</span>
```
사용: BagDetailPage.tsx

### 6. Button 컴포넌트의 통합 로딩 (이미 잘 구현됨)

`src/components/Button.tsx`에서 `loading` prop을 통해 일관된 로딩 UI를 제공:

```tsx
<Button loading={isSubmitting} disabled={!canSubmit}>
  {t("common.actions.signIn")}
</Button>
```

특징:
- `aria-busy`, `aria-disabled`, `data-loading` 속성 자동 설정
- 콘텐츠 opacity 10%로 감소, 스피너 오버레이 표시
- 200ms 트랜지션
- 모든 버튼 variant에서 동작

사용처: AuthPage, CardForm, BatchCardCreationPage, BagManager

## Code References

- `src/App.tsx:14-25` — 전체 화면 로딩 (Loader2, h-10 w-10, text-primary-600)
- `src/components/ActivityPage.tsx:17-25` — 페이지 로딩 (Loader2, h-6 w-6, text-primary-600)
- `src/components/ProfilePage.tsx:10-18` — 페이지 로딩 (Loader2, h-6 w-6, text-primary-600)
- `src/components/CardEditPage.tsx:83-90` — 페이지 로딩 (Loader2, h-6 w-6, text-gray-400)
- `src/components/FSRSStudySession.tsx:66-74` — 페이지 로딩 (Loader2, h-6 w-6, text-primary-600)
- `src/components/BagDetailPage.tsx:475-480` — 인라인 로딩 (Loader2, h-4 w-4, 색상 상속)
- `src/components/StudyCard.tsx:376-381` — 오버레이 로딩 (Loader2, h-10 w-10, text-primary-600)
- `src/components/Button.tsx:53-60` — 버튼 내장 스피너 (Loader2, h-4 w-4, 색상 상속)
- `src/components/BagManager.tsx:146-151` — 페이지 로딩 (CSS border spinner, h-8 w-8)
- `src/components/BagStats.tsx:118-124` — 페이지 로딩 (CSS border spinner, h-8 w-8)

## Architecture Documentation

### 현재 패턴

1. **전용 Spinner 컴포넌트 없음** — 모든 곳에서 인라인으로 Loader2 또는 CSS border를 직접 사용
2. **Convex 쿼리 로딩 패턴** — `useQuery`가 로딩 중 `undefined`를 반환하며, `if (data === undefined)` 패턴으로 로딩 상태 감지
3. **Button만 통합됨** — `loading` prop으로 일관된 버튼 로딩 제공
4. **Skeleton 없음** — 모든 로딩 상태가 스피너로 처리되며, skeleton/placeholder UI는 사용하지 않음
5. **Tailwind animate-spin** — 모든 스피너가 공통적으로 사용하는 유일한 일관된 요소

### 불일치 요약

| 항목 | 변형 수 | 비고 |
|------|---------|------|
| 스피너 유형 | 2 | Loader2 vs CSS border |
| 사이즈 | 4 | h-4, h-6, h-8, h-10 |
| 색상 | 3 | primary-600, gray-400, 상속 |
| aria-hidden | 2 | 있음/없음 |
| 래핑 패턴 | 4 | 페이지/전체화면/오버레이/인라인 |

## Open Questions

- 통일 시 Loader2를 유지할지, 커스텀 SVG 스피너를 만들지
- 사이즈 체계를 어떻게 정의할지 (sm/md/lg 등)
- 오버레이 패턴도 Spinner 컴포넌트에 포함할지 별도로 둘지
- CardEditPage의 gray-400 색상이 의도적인 디자인 선택인지
