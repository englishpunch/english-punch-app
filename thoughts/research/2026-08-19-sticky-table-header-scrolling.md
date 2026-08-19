---
date: 2026-08-19
researcher: Codex
topic: "Smooth sticky table headers with horizontal and vertical scrolling"
tags: [research, frontend, css, tables, scrolling, accessibility]
status: complete
---

# Sticky table headers with two-axis scrolling

## Research question

The card table needs horizontal scrolling because Question and Answer have minimum widths. Its current horizontal `overflow-x: auto` wrapper prevents a normal sticky header from following window scrolling, while a JavaScript `scroll` + `requestAnimationFrame` + `translateY` workaround feels laggy. What standards-based architecture gives the table a smooth sticky header in both scroll directions?

## Recommendation

Use **one bounded table container as the scrollport for both axes**:

1. Give the table container a definite or allocated block size and `overflow: auto`.
2. Keep one native `<table>` with one `<thead>`, one `<tbody>`, `<th scope="col">`, and `<td>` elements.
3. Apply `position: sticky; inset-block-start: 0` to the header cells, with an opaque background and a higher `z-index`.
4. Allocate the container's height with a page-level grid or flex layout, leaving the detail controls and the count/Load more row outside the scroll pane.
5. Remove the window `scroll` listener, geometry reads, animation-frame scheduling, and header transform.

This is the same core architecture shown in TanStack Table's official virtualized infinite-scrolling example: a fixed-height `overflow: auto` table container and a native sticky header. This table does not need TanStack's virtualization-specific `display: grid` and absolutely positioned rows; only the bounded scroll-container pattern is relevant here. [TanStack Table example](https://tanstack.com/table/latest/docs/framework/react/examples/virtualized-infinite-scrolling)

The tradeoff is intentional: vertical scrolling moves from the document to the table pane while the list is being browsed. In return, horizontal and vertical movement share one native scrollport, so no cross-scroll-container synchronization is needed.

## Why the current overflow wrapper defeats window-relative sticky

Sticky offsets are calculated against a scrollport, not simply against whichever box is visibly moving. Current MDN platform guidance says a sticky box attaches to the nearest ancestor that creates a scrolling mechanism with `hidden`, `scroll`, or `auto`, even when that ancestor is not the ancestor that is actually scrolling. [MDN `position`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position#sticky)

That is what `TableWrapper` does today. It creates a scrolling ancestor around the table for horizontal overflow, so the header is constrained to the wrapper rather than the window. Because the wrapper has no bounded vertical scrolling area, its scrollport moves through the document with the table; the header therefore moves offscreen with it.

### Why `overflow-y: visible` does not help

The CSS Overflow draft defines `visible` as a non-scrollable value, but when the other axis has a scrollable value, specified `visible` computes to `auto`. Therefore `overflow-x: auto; overflow-y: visible` becomes a dual-axis scroll container in computed behavior. [CSS Overflow 3, section 3.1](https://drafts.csswg.org/css-overflow-3/#overflow-properties)

### Why `overflow-y: clip` did not help in the tested Chrome

There is an important standards transition here:

- The current CSS Overflow editor's draft now says `overflow-x: auto; overflow-y: clip` is a true single-axis scroll container. [CSS Overflow 3, section 3.1](https://drafts.csswg.org/css-overflow-3/#overflow-properties)
- The current CSS Positioned Layout draft now lets sticky positioning choose the nearest scroll container with a _matching scrollable axis_, and it explicitly allows the two axes to use different scrollports. Under that new model, a horizontal-only wrapper could use itself for inline-axis behavior and the window for block-axis sticky behavior. [CSS Positioned Layout 3, section 3.4](https://drafts.csswg.org/css-position-3/#sticky-pos)
- This per-axis wording was merged into the CSSWG drafts on June 30, 2026. The associated standards discussion explicitly says authors currently have JavaScript or scroll-animation fallbacks and requested a way to feature-detect per-axis sticky tracking. [CSSWG draft change #13903](https://github.com/w3c/csswg-drafts/pull/13903), [CSSWG issue #13677](https://github.com/w3c/csswg-drafts/issues/13677)
- The earlier overflow behavior made off-axis `clip` compute to `hidden` when paired with a scrollable axis; the CSSWG issue that proposed genuine single-axis clipping documents that behavior and the resulting programmatic off-axis scrollability. [CSSWG issue #12289](https://github.com/w3c/csswg-drafts/issues/12289)

The failed runtime experiment is therefore consistent with the deployed browser implementing the older, non-axis-aware sticky model. `overflow-y: clip` is a promising future simplification, but it is not a safe production solution here until the app's supported browsers pass a direct runtime/WPT check for per-axis sticky scrollports.

## Why one bounded `overflow: auto` container works

The CSS Positioned Layout specification defines sticky offsets from the nearest scrollport. If the table wrapper is deliberately the scrollport in both axes, there is no ambiguity: horizontal movement keeps the header aligned with the columns, and vertical movement activates `inset-block-start: 0` against the same container. [CSS Positioned Layout 3, section 3.4](https://drafts.csswg.org/css-position-3/#sticky-pos)

The container must have a constrained block size; otherwise it grows to the full table and never develops vertical scrollable overflow. TanStack's official example makes the same requirement explicit with `height: 600px` and `overflow: auto`. [TanStack Table example](https://tanstack.com/table/latest/docs/framework/react/examples/virtualized-infinite-scrolling)

MDN's official table example also combines a bounded scroll area with sticky `<th>` cells. It notes that `overflow: auto` is the part that makes the bounded table scrollable and uses separate borders rather than collapsed borders so the header paints correctly as it separates from the body. [MDN `<table>` example](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#displaying_large_tables_in_small_spaces)

## Sizing the pane against the available viewport

Prefer layout allocation over measuring element positions in JavaScript:

- Give the Bag Detail surface the block size available between the app's top header and fixed bottom navigation.
- Use grid rows such as `auto auto minmax(0, 1fr) auto`: detail heading, search/notice, table pane, and count/Load more. The table pane receives the remaining space and the surrounding app chrome remains outside it.
- Use `minmax(0, 1fr)` and `min-block-size: 0` so intrinsic table content does not force the allocated row to grow instead of overflowing. CSS Grid defines when automatic minimum sizes become content-based and when they resolve to zero; an explicit zero minimum makes the intended shrink-and-scroll behavior unambiguous. [CSS Grid 2, automatic minimum size](https://drafts.csswg.org/css-grid-2/#min-size-auto)
- Use `100dvh` when the surface should track the currently visible viewport, then subtract known app chrome and safe-area insets. Dynamic viewport units account for browser interfaces that expand and retract. The specification also warns that dynamic units can resize during browser-UI changes, so `100svh` is a reasonable stable mobile alternative if runtime testing shows resize jank. [CSS Values 4, viewport variants](https://drafts.csswg.org/css-values-4/#viewport-variants)

For this app, the height calculation should be scoped to Bag Detail rather than changing every route in `MobileShell`. CSS custom properties for the known shell header and bottom-navigation sizes are preferable to repeating unexplained numeric offsets. Optional content such as the search notice should occupy an `auto` grid row, not be included in a hard-coded subtraction.

## Table semantics and accessibility

Keep the table as one native table. W3C WAI guidance says accessible data tables use `<th>` for header cells and `<td>` for data cells; `scope="col"` makes the header relationship explicit. Assistive technologies use those structural relationships while navigating cells. [W3C WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/), [W3C technique H63](https://www.w3.org/WAI/WCAG21/Techniques/html/H63)

Both `<thead>` and `<th>` can participate in current sticky positioning: the CSS Positioned Layout draft applies positioning to table header groups and table cells, and TanStack's official example sticks `<thead>`. [CSS Positioned Layout 3](https://drafts.csswg.org/css-position-3/#position-property), [TanStack Table example](https://tanstack.com/table/latest/docs/framework/react/examples/virtualized-infinite-scrolling)

For this non-virtualized table, prefer sticky on each `<th>` because MDN's native-table example directly documents that pattern and it leaves the row-group/table layout untouched. This is an implementation preference, not a semantic requirement; applying sticky to `<thead>` does not by itself change accessibility. [MDN `<table>` example](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/table#displaying_large_tables_in_small_spaces)

Each sticky cell needs an opaque background so body text does not show through and a `z-index` above body cells. Sticky positioning creates a stacking context, so the layer order should be deliberate. [MDN `position`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position#sticky)

The Answer visibility icon remains a real button inside the real Answer `<th>`, so there is only one focus target and one accessible name. A duplicated visual header makes this substantially harder.

## Why the JavaScript transform can feel laggy

The current implementation handles every window scroll, schedules an animation-frame callback, reads several layout-dependent measurements, and writes a new transform. `requestAnimationFrame` coalesces duplicate callbacks in this implementation, but it does not reduce the fundamental update frequency: MDN notes that animation-frame callbacks and `scroll` events fire at the same rate, and warns against high-rate DOM modifications in scroll handlers because they can cause jank. [MDN `scroll` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/scroll_event#scroll_event_throttling)

This work also competes on the main thread with React development-mode work and browser layout/painting. A callback that is delayed until a later frame visibly places the header behind the user's scroll position. Native sticky removes the app's per-scroll event dispatch, geometry reads, and style mutation; the browser applies the declared sticky constraint as part of its own scrolling/rendering pipeline.

Native sticky is not a universal guarantee of zero paint cost. MDN notes that sticky content can require repaints and suggests `will-change: transform` as a possible layer-promotion optimization when profiling demonstrates repaint jank. Start without that hint, measure the production build, and add it only if native sticky itself still misses frame targets. [MDN sticky performance guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position#performance_accessibility)

## Alternatives and tradeoffs

### 1. Future per-axis sticky scrollports

Keep window vertical scrolling, set the table wrapper to horizontal `auto` and block-axis `clip`, and let the header use different nearest scrollports per axis. This best matches the original page behavior and is now described by the CSS drafts, but the change is too new to rely on in the tested Chrome and lacks a simple shipped feature query. Retest when the app's supported browsers implement the CSSWG per-axis behavior. [CSSWG issue #13677](https://github.com/w3c/csswg-drafts/issues/13677)

### 2. Split or duplicated header

Place a second header outside the table's horizontal overflow wrapper, make it viewport-sticky, and synchronize its `scrollLeft` and column widths with the body. This can retain document vertical scrolling today, but it brings back JavaScript on horizontal scroll and resize, duplicates column sizing, and risks visible drift.

It also creates an accessibility and interaction problem: a purely visual clone should be hidden from assistive technology and cannot safely own the interactive Answer button, while two interactive headers duplicate focus targets and labels. Splitting the header and body into separate tables also loses the native single-table header/data relationship that WAI guidance relies on. [W3C WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/)

Use this only if document-level vertical scrolling is a non-negotiable requirement and the added synchronization and accessibility work is accepted.

### 3. Keep the rAF transform

This preserves document scrolling and one table, but retains high-frequency JavaScript DOM work and the observed lag. It should be a compatibility fallback, not the primary architecture. [MDN `scroll` event](https://developer.mozilla.org/en-US/docs/Web/API/Document/scroll_event#scroll_event_throttling)

### 4. Fixed/portal header overlay

A fixed header rendered in a portal still needs table geometry, horizontal synchronization, visibility bounds at the table's start/end, and special handling for the interactive Answer button. It is effectively the duplicated-header option with more overlay and z-index complexity.

## Illustrative structure

This sketch shows the intended architecture, not a production patch:

```html
<section class="bag-detail-frame">
  <header class="detail-heading">...</header>
  <form class="card-search">...</form>

  <div class="card-table-scroll">
    <table class="card-table">
      <thead>
        <tr>
          <th scope="col">Question</th>
          <th scope="col">
            <span>Answer</span>
            <button type="button" aria-label="Hide answers">...</button>
          </th>
          <th scope="col">Next review</th>
          <th scope="col">Created</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        ...
      </tbody>
    </table>
  </div>

  <footer class="card-table-footer">... Load more ...</footer>
</section>
```

```css
.bag-detail-frame {
  /* Values come from the app shell, including the bottom safe area. */
  block-size: calc(
    100dvh - var(--shell-header-block-size) - var(--bottom-nav-block-size) -
      env(safe-area-inset-bottom)
  );
  min-block-size: 0;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 1rem;
}

.card-table-scroll {
  min-inline-size: 0;
  min-block-size: 0;
  overflow: auto; /* one horizontal + vertical scrollport */
}

.card-table {
  min-inline-size: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.card-table th {
  position: sticky;
  inset-block-start: 0;
  z-index: 1;
  background: var(--table-header-background);
}
```

If the search notice is a separate conditional element, add another `auto` grid row or group the search form and notice into one auto-sized wrapper. Keep the count and Load more controls outside the scrollport so they remain reachable without scrolling to the bottom of a long table.

## Runtime acceptance criteria for implementation

- A long table scrolls vertically inside the bounded table pane; its header remains fixed at the pane's block-start edge.
- Horizontal scrolling moves the header and body columns together with no width drift.
- The document does not gain unintended horizontal overflow.
- The header does not overlap the app shell header or fixed bottom navigation.
- Question and Answer retain their configured minimum widths.
- The Answer icon button remains compact, visible, keyboard-focusable, and toggles every Answer cell at both horizontal scroll extremes.
- Sort buttons still work by mouse and keyboard, and their focus rings are not clipped.
- Header background, border/shadow, and stacking remain coherent over body rows.
- Empty, 30-row, loaded-more, search, and long-localized-header states fit the allocated pane.
- The production build shows no visible header lag during fast wheel, trackpad, scrollbar-thumb, or touch scrolling.
