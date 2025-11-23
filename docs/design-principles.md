# English Punch – Design Principles

## Purpose

- Keep one clear primary action per screen; keep everything else visibly secondary.
- Reduce cognitive load with a simple hierarchy and predictable states.

## Use Tailwind Defaults First (v4)

- Prefer core utilities instead of custom pixel values: `text-sm`, `text-base`, `text-lg`; `gap-4`, `p-6`, `py-8`; `rounded-md`, `rounded-lg`; `shadow-sm`, `shadow`.
- Palette: use the existing primary palette for CTAs/focus, the gray palette for neutrals, and semantic feedback colors (e.g., red for errors) as defined in the Feedback section. Do not introduce other colors unless a required semantic is missing.
- Lean on default utilities before custom tokens. Reserve the existing primary palette tokens for CTAs; lighten/darken with its built-in scale instead of adding ad-hoc shades.
- Focus styles: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400`.

## Typography

- Headings: `text-3xl font-semibold` for hero, `text-2xl`/`text-xl` for section titles.
- Body: `text-base leading-6` for paragraphs; `text-sm leading-5` for labels and helper text.
- Keep line length around 65–75 characters; always show a visible label (no placeholder-only fields).

## Spacing, Radius, Shadow

- Use the spacing scale: stacks with `space-y-4`, layouts with `gap-4`/`gap-6`; section padding `py-12` + `px-4`.
- Corners: inputs/buttons `rounded-md`; cards `rounded-lg`.
- Elevation: `shadow-sm` for controls, `shadow` for cards; avoid heavier shadows unless needed for depth.

## Layout & Background

- Mobile-first; constrain forms/cards with `max-w-md` and `mx-auto`.
- Single surface: desktop view is the mobile view centered on the screen; do not change layout structure with responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`).
- Comfortable breathing room: `py-16` around primary sections.
- Light backgrounds: `bg-gray-50` or a soft gradient like `bg-gradient-to-br from-gray-50 via-white to-gray-100`.

## Feedback & Interaction States

- Inputs: default `border-gray-300`; error `border-red-500 ring-1 ring-red-500`; disabled `bg-gray-100 text-gray-400 cursor-not-allowed` (never rely on `opacity` alone).
- Loading: page uses skeletons (`animate-pulse bg-gray-100 rounded`); actions use a spinner inside the button and keep button width fixed.
- Empty states: never leave a list blank—center a “No items” message with a clear CTA to add one.

## Motion

- Use `transition-all duration-200 ease-out` for hover/focus. Respect `motion-reduce` by disabling non-essential animation.

## Icons

- Use `lucide-react` icons instead of emoji.

## Accessibility

- Maintain contrast ≥ 4.5:1; keep focus visible on all interactive elements.
- Touch targets ≥ `h-11`/`min-w-[44px]`; logical tab order; announce auth errors with `aria-live`. Never rely on color alone.

## Microcopy & Content

- Action-oriented: buttons are verbs (e.g., “Send Email,” “Create Account”).
- Friendly: avoid jargon; prefer “Try Again” over “Submission Failed.”
- Input hints: place helper text under inputs using `text-xs text-gray-500` for complex formats (e.g., passwords).
