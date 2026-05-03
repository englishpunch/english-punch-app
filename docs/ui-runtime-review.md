# UI Runtime Review

## Purpose

UI work cannot be reviewed from code diffs alone. Layout, pointer geometry,
keyboard focus, overlays, scroll, z-index, localization, and responsive behavior
are runtime properties. For frontend UI changes, inspect the component as an
interactive system, not only as JSX and CSS.

This workflow is about functional interaction quality, not subjective visual
taste.

## When This Applies

Use this workflow whenever a change affects:

- layout, sizing, spacing, overflow, scrolling, or responsive behavior
- pointer interaction: hover, click, drag, selection, hit areas
- keyboard interaction: focus, tab order, shortcuts, enter/space handling
- state rendering: loading, empty, disabled, selected, active, error, stale
- overlays: tooltip, popover, menu, dialog, portal, z-index, collision handling
- dense controls: heatmaps, grids, swatches, icon toolbars, timelines

## Before Editing: UI Impact Map

For non-trivial UI changes, identify the affected surfaces before editing:

- Visual surface: what the user sees.
- Interaction surface: what receives pointer, click, keyboard focus, hover,
  drag, or touch.
- State surface: loading, empty, selected, disabled, active, error, optimistic,
  stale.
- Overlay surface: tooltip, popover, menu, modal, portal, z-index, collision,
  pointer blocking.
- Layout surface: responsive width, overflow, scroll, long text, localization.

If two surfaces are intentionally different, state why. For example, a small
visual square may use a larger click target, but hover feedback, tooltip trigger,
and keyboard focus must all be reviewed against that intended target geometry.

## Candidate Pass

Frontend UI work often has no single obvious "resolved" state from code alone.
Before settling on an implementation for non-trivial UI behavior, compare
concrete candidates instead of treating the first plausible patch as done.

For each candidate:

- Name the approach and the smallest code change it requires.
- State what runtime behavior would prove it works.
- Test it in the browser against that behavior.
- Keep the least complex candidate that passes the runtime check.
- If a candidate fails, record the observed failure briefly so the same path is
  not retried by assumption.

When a library primitive is involved, inspect its public API before adding CSS or
custom event logic. Prefer a built-in primitive option when it passes the same
runtime check.

## Implementation Rules

- Do not infer runtime behavior from class names alone when the change affects
  interaction, layout, or overlays.
- Keep visual feedback, pointer target, focus target, and overlay trigger aligned
  unless there is a deliberate reason to separate them.
- Informational overlays must not block exploration of adjacent controls. If the
  overlay is not interactive, it should not capture pointer events.
- Interactive overlay content must be reachable by keyboard and must not be
  implemented as a tooltip. Use a popover, menu, dialog, or another appropriate
  pattern.
- Dense controls need explicit review for adjacent targets, viewport edges, and
  pointer movement between cells/items.
- Prefer proven primitives such as Radix for tooltip/popover/menu/dialog
  behavior instead of custom positioning logic.

## Runtime Pass

When the change affects UI behavior or layout, run a runtime pass. Prefer
Playwright for acceptance checks of user interaction flows such as hover, click,
keyboard navigation, drag, tooltip, popover, and dense controls. Use Chrome
DevTools for inspection and debugging: DOM, computed styles, console, network,
accessibility snapshots, and hit-testing. The default runtime target for this app
is desktop viewport only. Check mobile or narrow responsive viewports only when
the user asks for it or when the change directly affects mobile/responsive
behavior.

Prefer an interactive browser session for iterative UI work:

- Reuse an already-running dev server and browser session when possible.
- Do not rely on one-off screenshots alone for pointer, focus, or overlay
  behavior.
- Use the browser to move the pointer, tab through focusable elements, inspect
  bounding boxes, and check viewport edges.
- If Playwright MCP or equivalent browser automation is not available, say so
  instead of implying that runtime behavior was checked.

Check at least:

- Mouse: hover, click, moving between neighboring targets, outside click.
- Keyboard: tab order, focus-visible state, enter/space activation, escape for
  dismissible overlays.
- State: loading, empty, populated, selected/active, disabled/error when
  relevant.
- Overlay: placement, viewport collision, scroll behavior, z-index, pointer
  blocking, dismissal.
- Layout: desktop width, long text, localized text, overflow, no incoherent
  overlap.

For dense UI, also check:

- first and last item in a row/column
- top and bottom edge items
- pointer movement from one target to the next
- whether an open overlay obscures the next target the user is likely to inspect

## Reporting

In the final response for UI work, include one of:

- Runtime checked: briefly say what was checked.
- Not runtime checked: explicitly say it was not checked and why.

Automated tests are optional and should be added only when the behavior is
important enough to preserve in CI. The default expectation is not "test every
obvious UI rule"; it is "do a runtime review for UI changes that cannot be
validated from code alone."

## References

- [WAI-ARIA Tooltip Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/)
- [WCAG 1.4.13: Content on Hover or Focus](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html)
- [Microsoft Tooltip and Infotip Guidelines](https://learn.microsoft.com/en-us/windows/win32/uxguide/ctrl-tooltips-and-infotips)
- [zeroheight Design System Checklist](https://help.zeroheight.com/hc/en-us/articles/36474209315227-Design-system-checklists-Vetting-components-and-patterns)
- [Visa Design System: States](https://design.visa.com/base-elements/states/usage/)
