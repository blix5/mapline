# Plan: skeleton loading states for `/sources` and `/`

**Status:** proposal, not implemented. This document describes the change; no application
code has been touched to produce it.

## Goal

Replace the full-screen `LoadingOverlay` (a blocking `#21222C` cover with a logo and a
sliding progress bar) with skeleton placeholders on two routes:

- [`pages/sources.js`](../../nextjs-mapline/pages/sources.js) — the APUSH-period reference list.
- [`pages/index.tsx`](../../nextjs-mapline/pages/index.tsx) — the map + timeline ("history") view.

The owner's framing: shapes that occupy the same positions as the real content, so page
layout is visible and stable from first paint instead of hidden behind an opaque overlay.
The map gets a blank grid while GeoJSON/SVGs load; the timeline gets a grid while events
load in.

## 0. What actually gates paint today (read before designing anything)

This is the part of the brief that doesn't survive contact with the code unchanged, so it's
worth stating precisely before touching layout.

### Both pages use `getStaticProps` — neither has a page-level data fetch

- `/sources` — [`pages/sources.js:24-61`](../../nextjs-mapline/pages/sources.js#L24-L61)
  builds `periods`/`total`/`linked` in `getStaticProps` with `revalidate: 300`. By the time
  `Sources` (line 63) runs, `periods` is a prop, not a promise.
- `/` — [`pages/index.tsx:39-54`](../../nextjs-mapline/pages/index.tsx#L39-L54) does the same
  for `states`/`locations`/`events`, same `revalidate: 300`, same comment about batching the
  three sheet tabs into one request. `Home` (line 98) receives all three as props.

So **the confirmation the task asked for holds**: on both routes, event/state/location data
is present at first render. There is no client-side fetch-and-wait for the page's own
content on either route. A route-transition skeleton (shown by `_app.js` while Next fetches
the destination route's JS chunk + prerendered JSON) is the *only* thing `/sources` will
ever show a skeleton for — real content is already sitting in props the instant the page
component mounts.

`/` is not the same story, and the difference matters for design:

### `/` has a second, genuine, client-only gate: the map's own GeoJSON fetch

- [`pages/index.tsx:104-107`](../../nextjs-mapline/pages/index.tsx#L104-L107):
  ```
  const mapDataReady = useMapDataReady();
  const appReady = mapDataReady && !!width;
  ```
- `useMapDataReady` lives in
  [`libs/map/LambertConformalConicMap.js:60-72`](../../nextjs-mapline/libs/map/LambertConformalConicMap.js#L60-L72).
  It flips true once **any one** of the "medium tier" GeoJSON requests resolves
  (`markReady()` at line 38, called from inside `loadGeoJson`'s `.then`). At `mapScale: 1`
  (the default, `URL_STATE_DEFAULTS.mps`), the mounted components are `MediumProjectionLCC`
  and `MediumTopProjectionLCC` (index.tsx:924-925), which together request `mediumLand`,
  `mediumLake`, and `mediumRiver` (`GEO` map, `LambertConformalConicMap.js:14-16`). The
  comment at lines 49-50 is explicit: *"The first paint shows an empty ocean until the
  medium tier lands (~1.1 MB gzipped, fetched after mount)."* This is a real network wait,
  unrelated to `getStaticProps`, and it's the dominant source of the loading period on `/`.
  Because `markReady` fires on the *first* of the three requests to resolve, `appReady`
  can go true while the lake/river layers are still in flight — the map keeps filling in
  after the overlay is gone today, and will keep doing so after this change (out of scope
  to fix; noted as pre-existing behavior).
- `width` comes from
  [`components/useWindowDimensions.tsx`](../../nextjs-mapline/components/useWindowDimensions.tsx),
  which is `undefined` until the first post-mount effect runs (line 32, `read()` called
  synchronously inside `useEffect`). This resolves within a render pass after mount — not a
  network wait, but it does mean `width` is `undefined` for the very first client render,
  which matters for the timeline math below.

**Consequence for the plan:** `/sources`'s skeleton only needs to cover a route transition
(fast, bounded by chunk-fetch time). `/`'s skeleton needs to cover the same route-transition
window *plus* a real, variable-length data-loading window driven by the map GeoJSON fetch.
These are different lifecycles and are designed separately in §2/§3 below, then wired
together in §5.

### The timeline itself has no async gate at all

`visibleTimelineEvents` ([`pages/index.tsx:698-709`](../../nextjs-mapline/pages/index.tsx#L698-L709))
and the tick-mark memos (`tickYears`, `verticalGridlines`, `yearTicks`,
[`pages/index.tsx:720-778`](../../nextjs-mapline/pages/index.tsx#L720-L778)) are pure
functions of props/state already available at mount — `events` came from `getStaticProps`,
and `startYear`/`endYear`/`timeScale` are constants/defaults. The *only* reason the timeline
currently sits behind the same overlay as the map is that `appReady` gates the entire
`<Layout>` return as one unit (line 891, `<LoadingOverlay visible={!appReady} .../>` sits
above both the map `<section>` and the timeline `<section>`, but doesn't stop either from
mounting underneath it — it just paints over them). One caveat: with `width` `undefined` on
the very first client render, `visibleTimelineEvents`'s `right = timeX + (width * 1.1)` is
`NaN`, so `xFromMeta(meta) < right` is false for every event and nothing renders that one
frame. This resolves itself as soon as `width` is set (see above — same render pass or the
next one, not a network wait), but the grid skeleton must tolerate a frame where `width` is
`undefined` without throwing or producing `NaN` inline styles (§3, §9).

## 1. `/sources`: route-transition skeleton only

### Design

Five sections tall, matching the real period-section shape at
[`pages/sources.js:110-145`](../../nextjs-mapline/pages/sources.js#L110-L145) and
[`styles/sources.module.css`](../../nextjs-mapline/styles/sources.module.css):

- A skeleton `<h1>` block matching `.headingXl` line-height (2rem) sized to ~40% width —
  optional; the real `<h1>` text ("Sources") never changes and the flash is sub-frame, so
  this is a nice-to-have, not required.
- A skeleton `.intro` paragraph: 2 lines of muted bars matching `.intro`'s `font-size: 0.95rem;
  line-height: 1.6` (`sources.module.css:1-7`).
- A skeleton `.controls` bar: a rounded rect matching `.filter`'s box (`flex: 0 1 22rem`,
  `border-radius: 0.4rem`, `sources.module.css:28-38`) plus a short trailing bar for `.count`.
- **4 skeleton period sections** (not 9 — see below), each:
  - a `.periodHeading`-shaped row: a label bar + a short range bar + `border-bottom:
    0.1rem solid #434559` (`sources.module.css:64-74`), matching the heading's height so the
    border-bottom sits in the same place as the real one.
  - **6 skeleton `.entry` rows** per section, each reproducing the real grid exactly:
    `grid-template-columns: 6.5rem 1fr auto` (`sources.module.css:94-103`) — a small
    `.chip`-shaped rounded pill in column 1, a `.name`-width bar (vary 40–90% width per row
    so the block doesn't read as a solid stripe) in column 2, a `.date`-shaped short bar in
    column 3. Same `border-bottom: 0.05rem solid rgba(255,255,255,0.06)` and `padding: 0.3rem
    0` as the real row, so row height matches exactly.

**Why 4 sections × 6 rows, not "however many periods/entries really exist":** the skeleton
is never going to be replaced in place by counting up real rows — see the swap mechanism
below — so matching the real per-period entry count is not a layout-shift concern here the
way it would be for a true data-loading skeleton. 4×6 is sized to fill roughly one viewport
at typical desktop height without the page needing to scroll to see the skeleton do
something, which is what makes it read as "the sources page" rather than an abstract loader.

### Layout-shift avoidance

Because `/sources` has no data-loading phase (§0), the skeleton is never morphed into real
content — it is **fully unmounted and replaced** when `Sources` mounts with its real props,
the same way the current `LoadingOverlay` is fully hidden (via opacity, not unmounted, but
functionally the same swap point: `routeChangeComplete`). There is no scenario where the
skeleton's row count needs to match the real row count, because the two are never on screen
performing a transition into one another — one is torn down as the other mounts. This is the
key simplification `/sources` gets that `/` doesn't.

The only layout-shift risk is between the skeleton's box model and the real page's — solved
by reusing the *exact* class dimensions above (grid-template-columns, padding, border widths,
font-size/line-height) rather than approximating them, and by giving the skeleton container
the same `max-width: 46rem` / `padding-top: 2rem` as `.page` (`sources.module.css:12-15`).

## 2. `/`: page-shell skeleton (chrome first)

The overall chrome — header, map pane, draggable divider, timeline pane — should be visible
immediately, before `appReady`.

- **Header**: already unconditional. `Layout` (`components/layout.tsx`) renders `.header`
  (`layout.module.css:57-69`) and the nav for every `page` value, `/` included — nothing
  about it depends on `appReady`. No change needed here; it already renders under the
  overlay today and will simply become visible once the overlay is gone.
- **Map pane**: `<section id="map" className={mapStyles.map} ... style={{height:
  `${(height - 64) * borderY}px`}}>` (`pages/index.tsx:895`). `.map` already has an
  unconditional `background-color: #4B5B96` (`map.module.css:1-11`) — the "ocean" blue is
  painted by CSS regardless of data state. **This is the trap**: simply deleting the overlay
  makes the map pane flash solid ocean-blue with nothing on it (no grid, no coastline) for
  the length of the GeoJSON fetch, which is worse than the current overlay, not better. §3
  covers the grid that needs to sit on top of that blue while `mapDataReady` is false.
  - Note `height` comes from the same `useWindowDimensions` as `width` — `(height - 64) *
    borderY` is `NaN` while `height` is `undefined`. The skeleton grid must not depend on
    `height`/`width` for its own sizing in a way that produces `NaN` inline styles during
    that one frame (use CSS `%`/`inset: 0` inside the already-sized `<section>`, not
    JS-computed pixel dimensions).
- **Draggable divider**: `pages/index.tsx:1136-1141`, positioned via `top: ((height - 64) *
  borderY)`, same `height`-dependency caveat as above. No visual placeholder needed — it's a
  10px invisible drag handle, not content.
- **Timeline pane**: `<section id="timeline" className={timelineStyles.timeline} ...>`
  (`pages/index.tsx:1186`). `.timeline` already has `background-color: #242530`
  (`timeline.module.css:10`), close to the app's muted tone (`#333443`), so an empty
  timeline section doesn't read as broken the way the map does — but per §0, the timeline
  has no data-loading gate at all, so this section should just be allowed to render for
  real (ticks + events) as soon as `width` is defined, without a skeleton delaying it. See
  §3 for why a grid is still specified for it.

## 3. Map: blank grid while GeoJSON/SVGs load

### What it looks like

A graticule-style grid — evenly spaced hairlines forming a lat/long-like lattice — filling
the map `<section>` while `mapDataReady` is false, painted above the `#4B5B96` ocean
background and below the real map layers so the handoff is a pure z-index swap, not a
DOM replacement.

- New component, e.g. `components/map/MapGridSkeleton.tsx`, rendered as a sibling to the
  `<DraggableCore>` map layer inside the `#map` section, conditioned on `!mapDataReady`.
- Implementation: an absolutely positioned `<svg>` (or a CSS `repeating-linear-gradient`
  background on a `<div>`) sized to `100%`/`100%` of the `#map` section — **not** to
  `mapLimX`/`mapLimY` (8000×7000, the real projection canvas) — because the grid is a
  viewport-relative placeholder, not a projected map layer; it doesn't need to pan/zoom with
  `mapX`/`mapY`/`mapScale` the way the real `LowProjectionLCC`/`MediumProjectionLCC`
  components do. Keeping it viewport-sized also sidesteps the `NaN`-dimension risk from §2.
- Two `repeating-linear-gradient`s (one horizontal, one vertical) or a `<pattern>`-based SVG,
  line spacing ~48–64px, `stroke`/`gradient` color `#333443` (the app's muted token, already
  used for `.barFill`'s track at `loading.module.css:35`) at low opacity (~0.35) against the
  `#4B5B96` ocean, so it reads as "grid" rather than "noise" but doesn't fight the real
  coastline once it fades in.
- Optionally repeat the compass image (`mapStyles.compass`, already unconditionally rendered
  at `pages/index.tsx:897-898`) as the one piece of real chrome visible over the grid — it
  already renders regardless of `appReady`, so no change needed, just confirm it stays above
  the new grid layer's z-index.

### Sizing to the projection viewport

The grid must match the *visible* map pane, which is `{ width, height: (height - 64) *
borderY }` in `#map`'s own coordinate space (`pages/index.tsx:895`). Render the skeleton
`<svg>`/`<div>` at `width: 100%; height: 100%` of `#map` (which is already sized by that
inline style) rather than trying to independently compute dimensions — this makes it
automatically track `borderY` (the draggable divider) and window resizes for free, and
avoids duplicating the `(height - 64) * borderY` arithmetic in a second place.

### Hand-off without a flash

- Mount the grid unconditionally while `!mapDataReady`; the moment `mapDataReady` flips
  (§0 — driven by `markReady()` in `LambertConformalConicMap.js:53-58`), start a
  `transition: opacity 0.4s ease` fade-out on the grid layer while the real
  `MediumProjectionLCC`/`MediumTopProjectionLCC` (already fetching in parallel, since
  `useGeoJson` calls start on mount regardless of the skeleton) fade or simply appear
  underneath. This mirrors the existing pattern in `styles/loading.module.css:16-21` — fade
  only on the way *out*, instant on the way in — and the existing per-layer `transition:
  opacity 0.5s linear` already used for `MediumTopProjectionLCC` etc.
  (`pages/index.tsx:920,925,927,930,934`), so the new fade timing (0.4s) sits inside the
  family of durations already in this file rather than introducing a new one.
- Because `mapDataReady` can go true before all three medium-tier requests resolve (§0), the
  grid should fade out on the *first* of `mapDataReady`, not wait for a fully-painted map —
  matching current behavior (the overlay already comes down at the same point today) rather
  than trying to "improve" the readiness signal as part of this change.

## 4. Timeline: grid while events "load in"

Per §0, events are already present at mount — there's no fetch to wait for. What actually
needs a grid, briefly, is the one render where `width` is `undefined` and
`visibleTimelineEvents` computes to `[]` (§0's `NaN` case). Two options, pick one during
implementation:

- **Option A (recommended, simpler):** do nothing special — let `visibleTimelineEvents`
  resolve to `[]` for that one frame, and let `verticalGridlines`/`yearTicks`
  (`pages/index.tsx:726-778`) render on schedule, since neither of those depends on `width`
  at all (only `tickYears`/`timeScale`/`startYear`, all synchronous). This *already*
  produces exactly the "grid while events load in" look the owner asked for, with zero new
  code: axis and year gridlines are visible, event cards pop in one render later. Confirm
  with React DevTools / a slow-3G CPU throttle that this is in fact imperceptible (§9).
- **Option B:** if Option A is visibly janky in testing (e.g., on very low-end devices where
  the gap between renders is not sub-frame), add a lightweight category-lane skeleton: for
  each of the category lanes derived from `categoryToIndex` (imported at
  `pages/index.tsx:33`), draw a single muted horizontal band the height of one lane (`65 *
  2`px, matching the `y` spacing formula at `pages/index.tsx:410`) so the lane structure is
  visible before the first event card mounts. Gate it on `!width` specifically (not
  `!appReady` — the timeline doesn't care about map readiness), so it disappears the instant
  `width` resolves, independent of the map's grid in §3.

Either way, the timeline's horizontal/vertical gridlines at `pages/index.tsx:1277-1296`
already render unconditionally today and should continue to — no change needed to them.

## 5. Route-transition skeleton vs. in-page skeleton: the handoff

This is the structural piece the brief's §1 nuance forces: `/sources`'s skeleton (§1) can
only ever be shown by code that runs *before* the `Sources` component exists — i.e.
`pages/_app.js` — because the destination page hasn't mounted yet during a pending
navigation. `/`'s skeleton has two phases with two different owners:

1. **Route-transition phase** (owned by `_app.js`, same window as today's overlay): from
   `routeChangeStart` to `routeChangeComplete`
   ([`pages/_app.js:13-28`](../../nextjs-mapline/pages/_app.js#L13-L28)). `Home` doesn't
   exist yet, so `_app.js` must render *some* placeholder for the destination route.
2. **In-page phase** (owned by `Home` itself): from mount until `appReady` flips
   (`pages/index.tsx:107`) — this is where `mapDataReady`'s real network wait lives, and
   only `Home` has access to that state.

Mirror the existing hand-off contract stated in `LoadingOverlay.tsx`'s own comment (lines
7-9: *"Rendered in two places: `_app` shows it the moment a route change starts, and the
timeline page keeps it up until the map's first data tier has landed. They are the same
markup, so the hand-off between them is invisible."*) — same idea, but now the "same markup"
needs to be route-aware:

- `_app.js` already tracks `navigatingTo` and picks a `label` based on it (lines 31-33). Add
  a skeleton *selection*, not just a label, keyed the same way:
  ```
  const skeleton =
    navigatingTo == null ? null :
    navigatingTo.split('?')[0] === '/sources' ? <SourcesSkeleton /> :
    navigatingTo.split('?')[0] === '/' ? <HistoryShellSkeleton /> :
    <SourcesSkeleton />; // fallback for /about or any other route
  ```
  (`/about` isn't in scope per the task, but `_app.js` fires for every route — give it a
  reasonable fallback rather than leaving it undefined; reusing whichever skeleton is
  cheapest, e.g. `SourcesSkeleton`, is fine since `/about` is out of scope for this pass.)
- `HistoryShellSkeleton` is the §2 shell (header is real/shared via `Layout`, so this
  component is really just the map-grid + timeline-grid pair from §3/§4, laid out with the
  same `borderY` default split so there's no jump when `Home` mounts and takes over with the
  real `borderY` from the URL).
- Once `Home` mounts, it takes over rendering its *own* map-grid/timeline-grid (conditioned
  on `!mapDataReady` / `!width` respectively, per §3/§4) using the same
  `MapGridSkeleton`/timeline-grid components `_app.js` used for the transition — literally
  the same components, imported in both places, so there is no visual seam between "shown by
  `_app.js`" and "shown by `Home`" the way the current `LoadingOverlay` achieves it by being
  literally the same component in both places.

## 6. File-by-file changes

| File | Change |
|---|---|
| [`components/LoadingOverlay.tsx`](../../nextjs-mapline/components/LoadingOverlay.tsx) | **Delete.** Both call sites (below) are replaced. |
| [`styles/loading.module.css`](../../nextjs-mapline/styles/loading.module.css) | **Delete**, *except*: port the `prefers-reduced-motion` pattern (lines 61-67) and the "instant show / faded hide" comment pattern (lines 11-21) into the new skeleton CSS modules — don't literally keep this file around for one narrower case; nothing in this plan needs a full-screen cover anymore. |
| `pages/_app.js` | Replace `<LoadingOverlay visible={navigatingTo !== null} label={label} />` (line 37) with the route-keyed skeleton selection from §5. Keep the `routeChangeStart`/`routeChangeComplete` router-event wiring (lines 13-28) as-is — only the rendered placeholder changes, not the trigger logic. Drop the now-unused `label` computation (lines 31-33) unless a skeleton wants to reuse it for an `aria-label`. |
| `pages/sources.js` | Nothing — the skeleton for this route is owned entirely by `_app.js` (§1, §5); `Sources` itself never renders a loading state because its data is always present by the time it mounts (§0). |
| `pages/index.tsx` | Replace `<LoadingOverlay visible={!appReady} label="Loading map data" />` (line 891) with: nothing at that call site (the shell/chrome now renders unconditionally, §2), plus two new conditionally-rendered components inside the existing JSX — a `MapGridSkeleton` sibling inside `#map` gated on `!mapDataReady` (near line 916, before the real projection layers at 917-937), and, if Option B from §4 is chosen, a timeline lane skeleton gated on `!width` inside `#timeline` (near line 1190). |
| New: `components/map/MapGridSkeleton.tsx` + a small CSS module (or inline styles, consistent with the rest of `map.module.css`'s usage) | §3. |
| New (only if §4 Option B): `components/timeline/TimelineGridSkeleton.tsx` | §4. |
| New: `components/sources/SourcesSkeleton.tsx` + `styles/sourcesSkeleton.module.css` (or extend `sources.module.css` with skeleton-prefixed classes) | §1. |
| New: `components/HistoryShellSkeleton.tsx` | Thin wrapper composing `MapGridSkeleton` (+ `TimelineGridSkeleton` if used) inside the same section layout as `Home`'s real shell, for `_app.js`'s route-transition phase (§5). |

## 7. Motion

Consulted the project's `impeccable` skill (`animate` command) for this section; its
guidance: motion should explain state/continuity, not decorate, and for a continuous loading
indicator (not a one-off entrance) the relevant duration band is the "routine state change"
one (150–300ms) for hand-offs, with natural deceleration
(`cubic-bezier(0.16, 1, 0.3, 1)`) rather than bounce/elastic curves; nonessential loops must
stop when the surface they're on is hidden.

Concretely, reusing the loading language already established in this codebase
(`loading.module.css`'s `slide` keyframe, lines 39-51):

- **Skeleton rows/blocks (`/sources`)**: an opacity pulse, not a sliding shimmer — cheaper to
  apply across dozens of small elements (5 sections × 6 rows × 3 cells) than a per-element
  gradient sweep, and reads cleanly on the app's flat dark palette:
  ```css
  @keyframes skeletonPulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.9; }
  }
  .skeletonBlock {
    background-color: #333443; /* the app's muted token */
    border-radius: 0.3rem;
    animation: skeletonPulse 1.4s ease-in-out infinite;
  }
  ```
  1.4s sits close to the existing `.barFill` cadence (1.1s) without being identical — this is
  a different shape of loading state (many small blocks vs. one bar) and doesn't need to
  match exactly, just stay in the same tempo family.
- **Map grid**: static, not animated — a graticule is chrome, not a busy/pending indicator;
  its "motion" is entirely the fade-out at hand-off (§3), which is a one-shot `opacity`
  transition, not a loop. This also avoids an animated grid competing visually with whatever
  shimmer is happening on `/sources` at the same time as the compass image and other static
  map chrome.
- **Timeline lane skeleton (if Option B)**: same `skeletonPulse` treatment as the sources
  rows, for consistency, on the lane bands only.
- **Hand-off fades**: `opacity 0.4s ease` for grid→real-map and skeleton→real-content
  swaps, matching `loading.module.css:20`'s existing `0.4s ease` hide transition — same
  number, same easing, reused rather than reinvented.
- **`prefers-reduced-motion`**: every new keyframe animation must be neutralized the same way
  `loading.module.css:62-67` already does it for `.barFill` — hold the block at a static
  mid-opacity (e.g. `0.7`) instead of animating:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .skeletonBlock { animation: none; opacity: 0.7; }
  }
  ```
  `global.css:101-110` already sets a blanket `animation-duration: 0.01ms !important` etc.
  under reduced motion for `*`/`*::before`/`*::after`, which technically already neutralizes
  any new `@keyframes` without per-component overrides — but `loading.module.css` doesn't
  rely on that global rule alone (it also sets an explicit `.barFill` override), so match
  that belt-and-suspenders precedent for the new skeleton classes too, rather than assuming
  the global rule is sufficient on its own.

## 8. Visual tokens

Confirmed against [`styles/global.css`](../../nextjs-mapline/styles/global.css) and
[`styles/loading.module.css`](../../nextjs-mapline/styles/loading.module.css) rather than
assumed:

- Background: `#21222C` (`global.css:71`, `loading.module.css:10`).
- Foreground/text: `#E9EAF3` (`loading.module.css:43,54`; also used throughout
  `sources.module.css`).
- Muted/track: `#333443` (`loading.module.css:35`) — this is the right token for skeleton
  block fills; it's already used specifically as a "not-yet-content" color (the progress
  bar's track).
- A second muted tone, `#434559`, appears as border/divider color in both
  `sources.module.css` (`.filter` border, `.periodHeading` border-bottom, lines 31/73) and
  `timeline.module.css` (`.numberLine` background, line 99) — use it for skeleton borders/
  dividers (e.g. the skeleton `.periodHeading`'s border-bottom) rather than introducing a
  third gray.
- Font: `'Futura', 'Avenir', 'Century Gothic', ...` stack defined once on `html, body`
  (`global.css:57-72`) via the self-hosted `@font-face` rules at the top of the same file
  (`global.css:9-55`, `local()` first so macOS's system Futura wins with nothing downloaded,
  `.woff2`/`.ttf` fallback from `public/futura/`). Skeleton text-shaped blocks don't render
  text, so this mostly matters for making sure skeleton row *heights* match real text
  line-heights (already covered per-component in §1/§2 by copying the real CSS module's
  `font-size`/`line-height` rather than eyeballing block heights).
- Map ocean blue `#4B5B96` (`map.module.css:10`) — the backdrop the map grid skeleton sits
  on top of; not a token to reuse elsewhere, just context for why the grid needs
  low-opacity `#333443` rather than pure white/gray (contrast against a mid-blue, not
  against `#21222C`).

## 9. Risks and open questions

- **Layout shift**: addressed per-section above (§1 exact grid/box reuse for `/sources`; §2
  chrome already unconditional for `/`; §3 grid sized to the already-sized `#map` section
  rather than independently computed). The one remaining risk is the `HistoryShellSkeleton`
  (§5) using a *default* `borderY` (`URL_STATE_DEFAULTS.div = 0.6`,
  `pages/index.tsx:61`) for the map/timeline split during the route-transition phase, while
  the real `Home` may restore a different `borderY` from the URL query string
  (`pages/index.tsx:177-193`) once it mounts — this would produce a one-frame jump in the
  divider position on hand-off for any user who previously dragged the divider and has `div`
  in their URL. Worth deciding during implementation whether to read `div` from
  `window.location.search` inside `_app.js` too (cheap, no React state needed, just a
  `URLSearchParams` read) so the skeleton's split matches before `Home` ever mounts.
- **Flash on fast loads**: for `/sources`, if the destination chunk is already cached
  (client-side nav after first load, or a warm Next.js dev/prod cache),
  `routeChangeStart`→`routeChangeComplete` can be a handful of milliseconds — showing a
  skeleton at all in that window is a flash, not a loading state. Recommend a short mount
  delay (~120–150ms, a `setTimeout` gating skeleton visibility, cleared on
  `routeChangeComplete`) before the skeleton actually paints, same pattern as the classic
  "don't show a spinner for sub-200ms loads" rule. For `/`, the `mapDataReady` wait is a real
  network fetch (~1.1MB gzipped) and is very unlikely to resolve inside a threshold window on
  a cold load, but on a warm cache (`geoResolved` already populated from a previous mount
  this session, `LambertConformalConicMap.js:26`) it can also resolve instantly — same
  delay-gate logic applies there.
- **Accessibility**: `LoadingOverlay` used `role="status"` + `aria-live="polite"` +
  `aria-hidden`/`aria-live` toggling (`LoadingOverlay.tsx:12-17`). The replacement skeletons
  should carry `aria-busy="true"` on their container while active (screen readers shouldn't
  be walking dozens of decorative skeleton blocks as if they were content — give the
  skeleton container `aria-hidden="true"` instead of trying to make individual blocks
  meaningful, and put a single `role="status"` + visually-hidden text like "Loading sources…"
  / "Loading map data…" alongside it, reusing the existing `.srOnly` utility at
  `styles/utils.module.css` rather than inventing a new one). This mirrors the outgoing
  overlay's intent (announce loading state once, don't spam individual shapes) while dropping
  the parts that don't apply to skeleton content (there's no numeric progress to convey).
- **SSR/hydration mismatches**: `Home`'s skeleton conditions (`!mapDataReady`, `!width`) are
  both `false`/`true` deterministically on the server (module-level `firstTierResolved` starts
  `false`, `width` starts `undefined` per `useWindowDimensions`'s initial state) and only
  change client-side after mount — so SSR and first client render agree (skeleton visible),
  and the flip to real content only happens after hydration completes, same as `appReady`
  works today. No new mismatch risk from this refactor as long as the new skeleton components
  don't read `window`/`navigator` (e.g. `matchMedia` for reduced motion) outside of `useEffect`
  — reduced-motion should stay a pure-CSS media query (as `loading.module.css` and
  `global.css` already do it) rather than a JS `matchMedia` check like the one used elsewhere
  in this file for scroll behavior (`pages/index.tsx:78-81`, `prefersReducedMotion()`), to
  avoid a `window`-not-defined SSR issue that the scroll-motion helper avoids by only being
  called inside event handlers, never during render.
- **`_app.js` skeleton weight**: `HistoryShellSkeleton` (§5) will be imported into `_app.js`,
  which runs on every route. Confirm the new components are cheap to import (no D3, no heavy
  deps) — they should be, since they're pure CSS/SVG grids, but worth a bundle-size sanity
  check during implementation given `_app.js` is on the critical path for every page load.
- **Open question**: should `/about` (in `NAV`, `components/layout.tsx:16-20`, but out of
  scope per this task) get a skeleton too, or fall back to a plain instant swap (no skeleton,
  no overlay) now that `LoadingOverlay` is deleted? §5 proposes reusing `SourcesSkeleton` as a
  generic fallback, but that's a placeholder decision for this plan, not a considered design
  for that route — flag to the owner before implementing.
