# 스피너 통일 구현 계획

## Overview

코드베이스 전반에 산재된 스피너/로딩 인디케이터를 하나의 `Spinner` 컴포넌트로 통일한다. 현재 10개 파일에서 2가지 유형(Loader2, CSS border), 4가지 사이즈, 3가지 색상, 4가지 래핑 패턴이 제각각 사용되고 있다. 기존 Button/Input 컴포넌트와 동일한 CVA 패턴으로 `Spinner` 컴포넌트를 만들고, 모든 사용처를 교체한다.

## Current State Analysis

- 전용 Spinner 컴포넌트 없음 — 모든 곳에서 인라인으로 Loader2 또는 CSS border를 직접 사용
- Loader2 사용: 8개 파일 / CSS border spinner: 2개 파일
- 사이즈 4종 (h-4, h-6, h-8, h-10), 색상 3종, aria-hidden 있고 없고 불일치
- Button.tsx만 `loading` prop을 통한 통합 로딩 UI를 제공 중

### Key Discoveries:
- `src/components/Button.tsx` — CVA 기반 variant 시스템, `buttonVariants.ts` 분리 패턴
- `src/components/Input.tsx` — 동일 패턴, `inputVariants.ts` 분리
- `src/lib/utils.ts` — `cn()` 유틸리티 (clsx + twMerge)
- 컴포넌트 내보내기: barrel export 없이 직접 import
- `src/components/ui/` 디렉토리 없음 — 모든 컴포넌트가 `src/components/`에 flat하게 존재

## Desired End State

- `<Spinner />` 컴포넌트 하나로 모든 로딩 인디케이터 통일
- 사이즈 3단계: `sm` (16px), `md` (24px), `lg` (40px)
- 색상 일관: `text-primary-600` (기본)
- `aria-hidden` 항상 포함
- 페이지 레벨 센터링은 래퍼 variant로 제공
- CSS border spinner 완전 제거, Loader2로 통일

### 검증 방법:
- `npx tsc --noEmit` 타입 에러 없음
- `npm run lint` 린트 통과
- Loader2 직접 사용이 Spinner 컴포넌트와 Button.tsx에만 존재
- CSS border spinner (`border-b-2.*animate-spin`) 코드베이스에서 완전 제거
- 앱에서 각 페이지 로딩 상태 육안 확인

## What We're NOT Doing

- Skeleton/Placeholder UI 도입하지 않음
- Button.tsx의 내장 스피너는 변경하지 않음 (이미 잘 작동 중)
- 새로운 디자인 시스템 디렉토리(ui/) 생성하지 않음
- 애니메이션 커스터마이징하지 않음 (기존 `animate-spin` 유지)

## Implementation Approach

1. `Spinner` 컴포넌트를 기존 Button/Input과 동일한 CVA 패턴으로 생성
2. 10개 파일을 순차적으로 교체 (래핑 패턴 포함)
3. 불필요한 Loader2 import 제거

---

## Phase 1: Spinner 컴포넌트 생성

### Overview
CVA 기반 `Spinner` 컴포넌트를 만든다. 사이즈 variant와 래핑 variant를 제공하여 인라인부터 풀스크린까지 커버한다.

### Changes Required:

#### 1. Spinner 컴포넌트 생성
**File**: `src/components/Spinner.tsx` (신규)

```tsx
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin text-primary-600", {
  variants: {
    size: {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-10 w-10",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const wrapperVariants = cva("flex items-center justify-center", {
  variants: {
    wrapper: {
      none: "",
      page: "py-12",
      fullscreen: "min-h-screen bg-white",
      overlay: "absolute inset-0 bg-white/75",
    },
  },
  defaultVariants: {
    wrapper: "none",
  },
});

type SpinnerProps = VariantProps<typeof spinnerVariants> &
  VariantProps<typeof wrapperVariants> & {
    className?: string;
    "data-testid"?: string;
  };

export function Spinner({
  size,
  wrapper,
  className,
  "data-testid": testId,
}: SpinnerProps) {
  const icon = (
    <Loader2
      className={cn(spinnerVariants({ size }), className)}
      aria-hidden
    />
  );

  if (!wrapper || wrapper === "none") return icon;

  return (
    <div className={wrapperVariants({ wrapper })} data-testid={testId}>
      {icon}
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] `npx tsc --noEmit` — 타입 에러 없음
- [x] `npm run lint` — 린트 통과

#### Manual Verification:
- [x] 없음 (Phase 2에서 교체 후 확인)

---

## Phase 2: 전체 사용처 교체

### Overview
10개 파일에서 인라인 스피너를 `<Spinner />` 컴포넌트로 교체한다. Button.tsx는 내장 스피너이므로 변경하지 않는다.

### Changes Required:

#### 1. App.tsx — 풀스크린 로딩
**File**: `src/App.tsx`

Before:
```tsx
import { Loader2 } from "lucide-react";
// ...
<div className="flex min-h-screen items-center justify-center bg-white" data-testid="global-loader">
  <Loader2 className="text-primary-600 h-10 w-10 animate-spin" aria-hidden />
</div>
```

After:
```tsx
import { Spinner } from "./components/Spinner";
// ...
<Spinner size="lg" wrapper="fullscreen" data-testid="global-loader" />
```
- `Loader2` import 제거

#### 2. ActivityPage.tsx — 페이지 로딩
**File**: `src/components/ActivityPage.tsx`

Before:
```tsx
<div className="flex items-center justify-center py-12">
  <Loader2 className="text-primary-600 h-6 w-6 animate-spin" aria-hidden />
</div>
```

After:
```tsx
<Spinner wrapper="page" />
```
- `Loader2` import 제거, `Spinner` import 추가

#### 3. ProfilePage.tsx — 페이지 로딩
**File**: `src/components/ProfilePage.tsx`

Before:
```tsx
<div className="flex items-center justify-center py-12">
  <Loader2 className="text-primary-600 h-6 w-6 animate-spin" aria-hidden />
</div>
```

After:
```tsx
<Spinner wrapper="page" />
```
- `Loader2` import 제거, `Spinner` import 추가

#### 4. CardEditPage.tsx — 페이지 로딩
**File**: `src/components/CardEditPage.tsx`

Before:
```tsx
<div className="flex items-center justify-center py-12">
  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
</div>
```

After:
```tsx
<Spinner wrapper="page" />
```
- `text-gray-400`는 의도적 구분이 아니므로 기본 primary 색상으로 통일
- `Loader2` import에서 제거 (`ArrowLeft`만 남김), `Spinner` import 추가

#### 5. FSRSStudySession.tsx — 페이지 로딩
**File**: `src/components/FSRSStudySession.tsx`

Before:
```tsx
<div className="flex items-center justify-center py-12">
  <Loader2 className="text-primary-600 h-6 w-6 animate-spin" aria-hidden />
</div>
```

After:
```tsx
<Spinner wrapper="page" />
```
- `Loader2` import 제거 (`FileText`만 남김), `Spinner` import 추가

#### 6. BagDetailPage.tsx — 인라인 로딩
**File**: `src/components/BagDetailPage.tsx`

Before:
```tsx
<span className="flex items-center gap-2 text-gray-500">
  <Loader2 className="h-4 w-4 animate-spin" />
  {t("bagDetail.loadingMore")}
</span>
```

After:
```tsx
<span className="flex items-center gap-2 text-gray-500">
  <Spinner size="sm" />
  {t("bagDetail.loadingMore")}
</span>
```
- 인라인이므로 wrapper 없이 `sm` 사이즈로 사용
- `Loader2` import에서 제거, `Spinner` import 추가

#### 7. StudyCard.tsx — 오버레이 로딩
**File**: `src/components/StudyCard.tsx`

Before:
```tsx
<div className="bg-opacity-75 absolute inset-0 flex items-center justify-center bg-white">
  <Loader2 className="text-primary-600 h-10 w-10 animate-spin" />
</div>
```

After:
```tsx
<Spinner size="lg" wrapper="overlay" />
```
- `Loader2` import 제거, `Spinner` import 추가

#### 8. BagManager.tsx — CSS border spinner 제거
**File**: `src/components/BagManager.tsx`

Before:
```tsx
<div className="flex items-center justify-center py-12">
  <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2"></div>
</div>
```

After:
```tsx
<Spinner wrapper="page" />
```
- CSS border spinner 완전 제거, `Spinner` import 추가

#### 9. BagStats.tsx — CSS border spinner 제거
**File**: `src/components/BagStats.tsx`

Before:
```tsx
<div className="flex min-h-[400px] items-center justify-center">
  <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2"></div>
</div>
```

After:
```tsx
<Spinner wrapper="page" />
```
- CSS border spinner 완전 제거, `Spinner` import 추가
- 기존 `min-h-[400px]`은 BagStats 특유의 레이아웃 높이였으므로, 필요 시 감싸는 div 유지 가능

### Success Criteria:

#### Automated Verification:
- [x] `npx tsc --noEmit` — 타입 에러 없음
- [x] `npm run lint` — 린트 통과
- [x] Loader2 직접 사용이 `Spinner.tsx`와 `Button.tsx`에만 존재하는지 grep 확인
- [x] `border-b-2.*animate-spin` 패턴이 코드베이스에서 완전 제거되었는지 grep 확인

#### Manual Verification:
- [x] App.tsx: 초기 로딩 시 풀스크린 스피너 정상 표시
- [x] ActivityPage: 활동 페이지 로딩 시 스피너 정상 표시
- [x] ProfilePage: 프로필 페이지 로딩 시 스피너 정상 표시
- [x] CardEditPage: 카드 편집 페이지 로딩 시 스피너 정상 표시
- [x] FSRSStudySession: 학습 세션 로딩 시 스피너 정상 표시
- [x] BagDetailPage: "더 불러오기" 인라인 스피너 정상 표시
- [x] StudyCard: 카드 전환 시 오버레이 스피너 정상 표시
- [x] BagManager: 가방 목록 로딩 시 스피너 정상 표시
- [x] BagStats: 통계 로딩 시 스피너 정상 표시

**Implementation Note**: Phase 1 완료 후 바로 Phase 2 진행 가능. Phase 2 완료 후 전체 수동 확인 필요.

---

## References

- 연구 문서: `thoughts/shared/research/2026-02-07-spinner-unification.md`
- 기존 패턴 참조: `src/components/Button.tsx`, `src/components/buttonVariants.ts`
