import { useEffect } from "react";
import { getBoundingClientRect, useMouse, useOnClick } from "@ink-tools/ink-mouse";

/**
 * Stand-in element whose layout covers the whole terminal. ink-mouse only
 * invokes a handler when the click is inside the registered element's bounds,
 * and those bounds ignore the conversation scroll offset. Registering against
 * this node lets every click through so {@link hitHeader} can do the real,
 * scroll-aware bounds check.
 */
const FULL_SCREEN_NODE = Object.freeze({
	parentNode: null,
	yogaNode: { getComputedLayout: () => ({ left: 0, top: 0, width: 100000, height: 100000 }) },
});

/** Ref-shaped wrapper around {@link FULL_SCREEN_NODE}. */
export const FULL_SCREEN_REF = Object.freeze({ current: FULL_SCREEN_NODE });

/**
 * Test whether a terminal cell lies inside a rectangle (half-open: left/top
 * inclusive, right/bottom exclusive).
 * @param {number} x - Column (1-indexed)
 * @param {number} y - Row (1-indexed)
 * @param {{left: number, top: number, right: number, bottom: number}|undefined} rect - Rectangle
 * @returns {boolean} True when the cell is inside the rectangle
 */
export function isCellInRect(x, y, rect) {
	if (!rect) return false;
	return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
}

/**
 * Shift a layout-space rectangle up by the conversation scroll offset to get
 * its on-screen position.
 * @param {{left: number, top: number, right: number, bottom: number}} rect - Layout rectangle
 * @param {number} [offset=0] - Scroll offset in rows
 * @returns {{left: number, top: number, right: number, bottom: number}} Screen rectangle
 */
export function applyScrollOffset(rect, offset = 0) {
	return { ...rect, top: rect.top - offset, bottom: rect.bottom - offset };
}

/**
 * Find which block header (if any) a click landed on. The click must be inside
 * the visible viewport (when one is known) and inside the header's scroll-
 * adjusted bounds.
 * @param {{x: number, y: number}} click - Click position (1-indexed terminal cell)
 * @param {Array<{kind: string, node: unknown}>} headers - Header entries (extra fields such as `index` are preserved)
 * @param {{offset?: number, viewport?: {left: number, top: number, right: number, bottom: number}}} [scroll] - Scroll info
 * @returns {Object|null} The clicked header entry, or null for no hit
 */
export function findHeader(click, headers, scroll = {}) {
	const { offset = 0, viewport } = scroll;
	if (!click || !Number.isFinite(click.x) || !Number.isFinite(click.y)) return null;
	if (viewport && !isCellInRect(click.x, click.y, viewport)) return null;
	for (const header of headers) {
		const rect = getBoundingClientRect(header.node);
		if (rect && isCellInRect(click.x, click.y, applyScrollOffset(rect, offset))) return header;
	}
	return null;
}

/**
 * Find the kind of the header a click landed on.
 * @param {{x: number, y: number}} click - Click position (1-indexed terminal cell)
 * @param {Array<{kind: string, node: unknown}>} headers - Header entries
 * @param {Object} [scroll] - Scroll info (see {@link findHeader})
 * @returns {string|null} The kind of the clicked header, or null for no hit
 */
export function hitHeader(click, headers, scroll = {}) {
	return findHeader(click, headers, scroll)?.kind ?? null;
}

/**
 * Renderless component that registers a single click handler with the nearest
 * MouseProvider. Rendered only when click-toggling is wired, so bubbles
 * rendered outside a MouseProvider never call ink-mouse hooks.
 * @param {Object} props
 * @param {(event: {x: number, y: number}) => void} props.onClick - Click handler
 * @returns {null}
 */
export function HeaderClickRegistrar({ onClick }) {
	useOnClick(FULL_SCREEN_REF, onClick);
	return null;
}

/**
 * Renderless component that turns mouse reporting on/off together with the
 * existing `useMouseScroll` gating so the two never fight over escape codes.
 * @param {Object} props
 * @param {boolean} props.active - Whether mouse reporting should be on
 * @returns {null}
 */
export function MouseGate({ active }) {
	const { enable, disable, isTracking } = useMouse();
	useEffect(() => {
		if (!isTracking) return;
		if (active) enable();
		else disable();
	}, [active, isTracking, enable, disable]);
	return null;
}
