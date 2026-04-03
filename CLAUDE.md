# Weave — Integration Diagram Studio
**by Widgemo**

## What this is
A single-page HTML app for diagramming integration event flows between systems.
It supports two modes: Timeline (timestamp-based) and Flow (causal/trigger-based).
Deployed as a GitHub Pages site.

## Tech stack
- Vanilla JS (ES5-compatible, no framework, no bundler)
- Hand-rolled SVG rendering (no D3 or charting libraries)
- CSS custom properties for theming (dark/light mode)
- Single `index.html` entry point for GitHub Pages

## Architecture (after refactor)
- `index.html` — shell, layout HTML, CSS custom properties
- `css/styles.css` — all styles
- `js/state.js` — app state: events, systems, actors, sysOrder, appMode
- `js/ui.js` — sidebar, forms, tabs, toast, theme toggle
- `js/render.js` — SVG rendering dispatcher and shared helpers
- `js/render-flow.js` — Flow mode diagram rendering
- `js/render-timeline.js` — Timeline mode diagram rendering
- `js/import-export.js` — JSON import/export

## Key data structures
- `events[]` — array of event objects `{_id, desc, system, actor, timestamp, interactions[], mode}`
- `interactions[]` — `{target, nature (push|pull|process), delay, order, label, triggerEventId}`
- `sysOrder{}` — `{systemName: orderNumber}` for lane ordering
- `systemsRegistry[]` — `{name, desc, order}`
- `actorsRegistry[]` — `{name, desc}`

## Diagram rendering rules
- Push: arrow from source → target
- Pull: arrow from target → source (arrives at source event)
- Process: dashed line, NO arrowhead
- Arrowheads use SVG markers with unique IDs per render (`arr-push-{rid}`)
- Lines clip to box/circle edges so arrowheads sit on the card border

## Important constraints
- Must remain deployable as static GitHub Pages (no server, no build step)
- All files are loaded via relative paths — no CDN JS dependencies
- Google Fonts CDN is acceptable (CSS only, graceful degradation)
- Do not introduce npm, webpack, or any build toolchain
- Maintain dark/light mode support throughout (CSS vars + svgColors() fn)
- SVG colors are set via JS (not CSS) because SVG attributes can't use CSS vars
