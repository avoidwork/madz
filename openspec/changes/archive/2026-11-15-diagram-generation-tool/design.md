# Design

## Context

See proposal.md - Why. The harness has prompt-based image generation (`generateImage`) but no way to render a structured diagram spec. The new `diagram` tool follows the established tool convention in `src/tools/git/index.js` and `src/tools/archive/index.js`: the export is the tool name itself (`export const diagram = tool(...)`), with `diagramImpl` as the implementation.

## Goals / Non-Goals

**Goals:**
- Render mermaid and graphviz diagram specs to SVG or PNG.
- Enforce the sandbox allowlist on output paths via `validatePath()`.
- Validate all input via a Zod schema.
- Register the tool in `src/tools/index.js` with correct permissions and classifications.

**Non-Goals:**
- Not modifying `generateImage` / `image` — that stays scoped to prompt-based image generation.
- Not adding a hosted/browser-based renderer (no network dependency).

## Decisions

### Decision 1: Tool export convention
Follow the `git`/`archive` convention exactly: `export const diagram = tool((input, options = {}) => diagramImpl(input, options), { name: "diagram", description, schema })`. Do **not** use a `createDiagramTool()` factory.

### Decision 2: Rendering libraries
- **Graphviz** → `@viz-js/viz` (pure WASM, renders DOT to SVG). `viz.render(source, { format: 'svg' })` returns `{ status, output, errors }`. Reliable, no browser needed.
- **Mermaid** → `mermaid` package with a jsdom shim. Mermaid requires a DOM; set up a minimal jsdom environment (window, document, navigator, CSSStyleSheet, getBBox polyfill) before rendering. `mermaid.render(id, source)` returns `{ svg }`.
- **PNG output** → `sharp` converts SVG to PNG via `sharp(Buffer.from(svg)).png().toBuffer()`.

Alternatives considered: `@mermaid-js/mermaid-cli` (rejected — requires a headless browser/Chrome binary, which is not available); `isomorphic-mermaid` (rejected — `CSSStyleSheet is not defined` in this environment); shelling out to `dot`/`mmdc` (rejected — process dependency, no validation).

### Decision 3: Mermaid DOM shim
Set up the jsdom shim lazily, only when mermaid rendering is requested. The shim provides `window`, `document`, `navigator`, `CSSStyleSheet`, `DOMParser`, `SVGElement`, `Element`, `Node`, `getComputedStyle`, `requestAnimationFrame`, and a `getBBox` polyfill on `SVGElement.prototype`. This avoids polluting the global environment for graphviz-only renders.

### Decision 4: Registry wiring
Add `diagram` to `src/tools/index.js`:
- Import from `./diagram/index.js`
- `TOOL_PERMISSIONS`: `diagram: ["filesystem:write"]`
- `TOOL_CLASSIFICATIONS`: `diagram: ["search", "research", "coding", "documentation", "debug"]`
- `TOOLS` map
- `case "diagram"` in `buildToolConfig()`

## Risks / Trade-offs

- [Mermaid rendering fragility] → jsdom shim with getBBox polyfill; validated via integration test. If a mermaid diagram fails to render, return a structured error.
- [SVG→PNG conversion] → `sharp` is a native dependency; verified working in this environment.
- [Large diagrams] → Rendering is in-memory; output written to the allowlisted path.
