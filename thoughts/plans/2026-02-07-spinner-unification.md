---
date: 2026-02-07
author: claude
status: completed
topic: Unify spinner/loading indicators into a single Spinner component
---

# Spinner Unification Implementation Plan

## Overview

Unify spinner and loading indicators spread across the codebase into a single `Spinner` component. The current code uses two spinner types (Loader2 and CSS border), four sizes, three color patterns, and four wrapper patterns across 10 files. Create a `Spinner` component using the same CVA pattern as the existing Button/Input components, then replace all call sites.

## Current State Analysis

- No dedicated Spinner component exists; pages use inline Loader2 or CSS border spinners directly.
- Loader2 is used in 8 files; CSS border spinner is used in 2 files.
- There are 4 sizes (`h-4`, `h-6`, `h-8`, `h-10`), 3 color patterns, and inconsistent `aria-hidden` usage.
- Only Button.tsx provides integrated loading UI through the `loading` prop.

### Key Discoveries

- `src/components/Button.tsx` uses a CVA-based variant system and the separated `buttonVariants.ts` pattern.
- `src/components/Input.tsx` follows the same pattern with `inputVariants.ts`.
- `src/lib/utils.ts` provides the `cn()` utility through clsx + twMerge.
- Components are imported directly without barrel exports.
- There is no `src/components/ui/` directory; components live flat under `src/components/`.

## Desired End State

- One `<Spinner />` component owns all loading indicators.
- Sizes are normalized to 3 levels: `sm` (16px), `md` (24px), and `lg` (40px).
- Color is consistent: `text-primary-600` by default.
- `aria-hidden` is always present.
- Page-level centering is available through a wrapper variant.
- CSS border spinners are removed completely; Loader2 is the single spinner icon.

### Verification

- `npx tsc --noEmit` has no type errors.
- `npm run lint` passes.
- Direct Loader2 usage remains only in Spinner and Button.tsx.
- CSS border spinner pattern (`border-b-2.*animate-spin`) is removed from the codebase.
- Loading states are visually checked in the app.

## What We're Not Doing

- Introducing skeleton or placeholder UI.
- Changing Button.tsx's built-in spinner, because it already works well.
- Creating a new design-system directory such as `ui/`.
- Customizing animation; keep the existing `animate-spin`.

## Implementation Approach

1. Create a `Spinner` component with the same CVA pattern used by Button/Input.
2. Replace 10 call sites sequentially, including wrapper patterns.
3. Remove unnecessary Loader2 imports.

---

## Phase 1: Create Spinner Component

### Overview

Create a CVA-based `Spinner` component. Provide size variants and wrapper variants so it covers inline use through fullscreen loading.

### Changes Required

#### 1. Create Spinner Component

**File**: `src/components/Spinner.tsx` (new)

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

### Success Criteria

#### Automated Verification

- [x] `npx tsc --noEmit` - no type errors
- [x] `npm run lint` - lint passes

#### Manual Verification

- [x] None for Phase 1; verify after replacements in Phase 2.

---

## Phase 2: Replace All Usages

### Overview

Replace inline spinners in 10 files with `<Spinner />`. Do not change Button.tsx because it owns its built-in spinner.

### Changes Required

#### 1. App.tsx - Fullscreen Loading

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

- Remove the `Loader2` import.

#### 2. ActivityPage.tsx - Page Loading

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

- Remove the `Loader2` import and add the `Spinner` import.

#### 3. ProfilePage.tsx - Page Loading

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

- Remove the `Loader2` import and add the `Spinner` import.

#### 4. CardEditPage.tsx - Page Loading

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

- `text-gray-400` is not an intentional visual distinction, so normalize it to the default primary color.
- Remove `Loader2` from the import list and add `Spinner`.

#### 5. FSRSStudySession.tsx - Page Loading

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

- Remove the `Loader2` import and add the `Spinner` import.

#### 6. BagDetailPage.tsx - Inline Loading

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

- Inline use does not need a wrapper; use size `sm`.
- Remove `Loader2` and add `Spinner`.

#### 7. StudyCard.tsx - Overlay Loading

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

- Remove `Loader2` and add `Spinner`.

#### 8. BagManager.tsx - Remove CSS Border Spinner

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

- Remove the CSS border spinner completely and add the `Spinner` import.

#### 9. BagStats.tsx - Remove CSS Border Spinner

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

- Remove the CSS border spinner completely and add the `Spinner` import.
- Keep an outer div if the `min-h-[400px]` layout is still needed for BagStats.

### Success Criteria

#### Automated Verification

- [x] `npx tsc --noEmit` - no type errors
- [x] `npm run lint` - lint passes
- [x] Confirm direct Loader2 usage remains only in `Spinner.tsx` and `Button.tsx`.
- [x] Confirm `border-b-2.*animate-spin` is removed from the codebase.

#### Manual Verification

- [x] App.tsx: fullscreen spinner renders during initial loading.
- [x] ActivityPage: spinner renders while Activity is loading.
- [x] ProfilePage: spinner renders while Profile is loading.
- [x] CardEditPage: spinner renders while Card Edit is loading.
- [x] FSRSStudySession: spinner renders while the study session is loading.
- [x] BagDetailPage: inline spinner renders for "Load more".
- [x] StudyCard: overlay spinner renders while switching cards.
- [x] BagManager: spinner renders while the bag list is loading.
- [x] BagStats: spinner renders while stats are loading.

**Implementation Note**: Phase 2 can start immediately after Phase 1. After Phase 2, perform a full manual check.

---

## References

- Research document: `thoughts/shared/research/2026-02-07-spinner-unification.md`
- Existing patterns: `src/components/Button.tsx`, `src/components/buttonVariants.ts`
