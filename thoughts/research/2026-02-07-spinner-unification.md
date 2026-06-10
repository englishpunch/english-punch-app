---
date: 2026-02-07T00:00:00+09:00
researcher: th.kim
git_commit: cc0574a655673059312b9c0077119bb7a53c6704
branch: main
repository: english-punch-app
topic: "Spinner and loading-indicator audit and unification plan"
tags: [research, codebase, spinner, loading, ui-components]
status: complete
last_updated: 2026-02-07
last_updated_by: th.kim
---

# Research: Spinner and Loading Indicator Audit

**Date**: 2026-02-07
**Researcher**: th.kim
**Git Commit**: cc0574a655673059312b9c0077119bb7a53c6704
**Branch**: main
**Repository**: english-punch-app

## Research Question

Audit spinner and loading-indicator usage across the codebase and collect baseline information for unification.

## Summary

The codebase has **no dedicated Spinner component**. Individual pages use the `Loader2` icon from lucide-react or a CSS border spinner inline. Spinners appear in **10 files**, with 4 sizes, 3 color patterns, inconsistent `aria-hidden` usage, and 4 wrapper patterns. The only unified loading pattern is the `loading` prop in the `Button` component.

## Detailed Findings

### 1. Spinner Types: 2

#### 1-1. Loader2 Icon (lucide-react) - 8 Files

```tsx
import { Loader2 } from "lucide-react";
<Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-hidden />
```

Files:

- `src/App.tsx`
- `src/components/ActivityPage.tsx`
- `src/components/ProfilePage.tsx`
- `src/components/CardEditPage.tsx`
- `src/components/BagDetailPage.tsx`
- `src/components/FSRSStudySession.tsx`
- `src/components/StudyCard.tsx`
- `src/components/Button.tsx`

#### 1-2. CSS Border Spinner - 2 Files

```tsx
<div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2"></div>
```

Files:

- `src/components/BagManager.tsx`
- `src/components/BagStats.tsx`

### 2. Size Variants: 4

| Size | Class | Pixels | Usage |
|------|-------|--------|-------|
| XS | `h-4 w-4` | 16px | Button.tsx, BagDetailPage.tsx inline loading |
| SM | `h-6 w-6` | 24px | ActivityPage, ProfilePage, CardEditPage, FSRSStudySession |
| MD | `h-8 w-8` | 32px | BagManager, BagStats CSS border spinner |
| LG | `h-10 w-10` | 40px | App.tsx fullscreen, StudyCard.tsx overlay |

### 3. Color Variants: 3

| Color | Class | Usage |
|-------|-------|-------|
| Primary | `text-primary-600` | App, FSRSStudySession, ProfilePage, ActivityPage, StudyCard |
| Gray 400 | `text-gray-400` | CardEditPage |
| Inherited / none | inherited from parent | BagDetailPage, Button |
| Primary border | `border-primary-500` | BagManager, BagStats CSS spinner |

### 4. Inconsistent aria-hidden Usage

| Has `aria-hidden` | Missing `aria-hidden` |
|---|---|
| App.tsx | CardEditPage.tsx |
| FSRSStudySession.tsx | BagDetailPage.tsx |
| ProfilePage.tsx | StudyCard.tsx |
| ActivityPage.tsx | BagManager.tsx |
| Button.tsx | BagStats.tsx |

### 5. Wrapper Patterns: 4

#### Pattern A: Page-Level Centering, Most Common

```tsx
<div className="flex items-center justify-center py-12">
  <Loader2 className="text-primary-600 h-6 w-6 animate-spin" aria-hidden />
</div>
```

Used by ActivityPage, ProfilePage, CardEditPage, FSRSStudySession, BagManager, and BagStats.

#### Pattern B: Fullscreen Centering

```tsx
<div className="flex min-h-screen items-center justify-center bg-white" data-testid="global-loader">
  <Loader2 className="text-primary-600 h-10 w-10 animate-spin" aria-hidden />
</div>
```

Used by App.tsx.

#### Pattern C: Overlay

```tsx
<div className="bg-opacity-75 absolute inset-0 flex items-center justify-center bg-white">
  <Loader2 className="text-primary-600 h-10 w-10 animate-spin" />
</div>
```

Used by StudyCard.tsx.

#### Pattern D: Inline Next to Text

```tsx
<span className="flex items-center gap-2 text-gray-500">
  <Loader2 className="h-4 w-4 animate-spin" />
  {t("bagDetail.loadingMore")}
</span>
```

Used by BagDetailPage.tsx.

### 6. Button Component's Integrated Loading, Already Solid

`src/components/Button.tsx` provides consistent loading UI through the `loading` prop:

```tsx
<Button loading={isSubmitting} disabled={!canSubmit}>
  {t("common.actions.signIn")}
</Button>
```

Features:

- Automatically sets `aria-busy`, `aria-disabled`, and `data-loading`.
- Reduces content opacity to 10% and shows a spinner overlay.
- Uses a 200ms transition.
- Works with every button variant.

Used by AuthPage, CardForm, BatchCardCreationPage, and BagManager.

## Code References

- `src/App.tsx:14-25` - fullscreen loading, Loader2, h-10 w-10, text-primary-600
- `src/components/ActivityPage.tsx:17-25` - page loading, Loader2, h-6 w-6, text-primary-600
- `src/components/ProfilePage.tsx:10-18` - page loading, Loader2, h-6 w-6, text-primary-600
- `src/components/CardEditPage.tsx:83-90` - page loading, Loader2, h-6 w-6, text-gray-400
- `src/components/FSRSStudySession.tsx:66-74` - page loading, Loader2, h-6 w-6, text-primary-600
- `src/components/BagDetailPage.tsx:475-480` - inline loading, Loader2, h-4 w-4, inherited color
- `src/components/StudyCard.tsx:376-381` - overlay loading, Loader2, h-10 w-10, text-primary-600
- `src/components/Button.tsx:53-60` - built-in button spinner, Loader2, h-4 w-4, inherited color
- `src/components/BagManager.tsx:146-151` - page loading, CSS border spinner, h-8 w-8
- `src/components/BagStats.tsx:118-124` - page loading, CSS border spinner, h-8 w-8

## Architecture Documentation

### Current Patterns

1. **No dedicated Spinner component**: every usage directly inlines Loader2 or CSS border markup.
2. **Convex query loading pattern**: `useQuery` returns `undefined` while loading, and components detect loading with `if (data === undefined)`.
3. **Only Button is unified**: its `loading` prop gives consistent button loading UI.
4. **No skeletons**: every loading state uses a spinner; no skeleton or placeholder UI is used.
5. **Tailwind animate-spin**: the one common element across all spinners.

### Inconsistency Summary

| Item | Variant Count | Notes |
|------|---------------|-------|
| Spinner type | 2 | Loader2 vs CSS border |
| Size | 4 | h-4, h-6, h-8, h-10 |
| Color | 3 | primary-600, gray-400, inherited |
| aria-hidden | 2 | present vs missing |
| Wrapper pattern | 4 | page, fullscreen, overlay, inline |

## Open Questions

- Should unification keep Loader2 or introduce a custom SVG spinner?
- How should the size scale be defined, such as sm/md/lg?
- Should the overlay pattern be part of Spinner, or should it stay separate?
- Is CardEditPage's gray-400 color an intentional design choice?
