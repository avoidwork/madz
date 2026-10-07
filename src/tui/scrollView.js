import React, {
	useRef,
	useState,
	forwardRef,
	useImperativeHandle,
	useCallback,
	useEffect,
} from "react";
import { Box, useBoxMetrics } from "ink";

/**
 * Compute the visible range of items for a virtualized list.
 *
 * This is a pure function (no React, no DOM) that, given the per-item heights,
 * the viewport height, the current scroll offset, and an overscan buffer,
 * returns the inclusive index range `[start, end)` of items that should be
 * mounted, along with the cumulative offsets and total content height.
 *
 * The visible range is the set of items whose cumulative offset range overlaps
 * the viewport `[scrollOffset, scrollOffset + viewportHeight)`, expanded by
 * `overscan` items on each side.
 *
 * @param {number[]} heights - Per-item heights in rows
 * @param {number} viewportHeight - Viewport height in rows
 * @param {number} scrollOffset - Current scroll offset in rows
 * @param {number} [overscan=0] - Number of extra items to mount on each side
 * @returns {{start: number, end: number, offsets: number[], totalHeight: number}}
 *   `start`/`end` are the inclusive item index range to mount; `offsets[i]` is the
 *   cumulative start offset of item `i`; `totalHeight` is the sum of all heights.
 */
export function computeVisibleRange(heights, viewportHeight, scrollOffset, overscan = 0) {
	const n = heights.length;
	if (n === 0) return { start: 0, end: 0, offsets: [], totalHeight: 0 };

	// Cumulative start offsets.
	const offsets = Array.from({ length: n });
	let acc = 0;
	for (let i = 0; i < n; i++) {
		offsets[i] = acc;
		acc += heights[i];
	}
	const totalHeight = acc;

	// First item whose end is below the scroll offset (visible start).
	let start = 0;
	while (start < n && offsets[start] + heights[start] <= scrollOffset) start++;

	// Last item whose start is above the viewport bottom (visible end).
	let end = start;
	while (end < n && offsets[end] < scrollOffset + viewportHeight) end++;

	// Expand by overscan on each side.
	start = Math.max(0, start - overscan);
	end = Math.min(n, end + overscan);

	return { start, end, offsets, totalHeight };
}

/**
 * Wrapper that measures a single item's rendered height via `useBoxMetrics`
 * and reports it to the parent through `onMeasure`. This provides the real
 * per-item measurement that replaces the no-op `remeasureItem`.
 *
 * @param {Object} props
 * @param {string} props.id - Item id (used as the height-map key)
 * @param {Function} props.onMeasure - Called with `(id, height)` when the measured height changes
 * @param {React.ReactNode} props.children - The item content
 * @returns {React.ReactElement}
 */
function MeasuredItem({ id, onMeasure, children }) {
	const ref = useRef(null);
	const metrics = useBoxMetrics(ref);
	const height = metrics.clientHeight || 0;

	useEffect(() => {
		if (height > 0) onMeasure(id, height);
	}, [height, id, onMeasure]);

	return React.createElement(Box, { ref, flexDirection: "column", flexShrink: 0 }, children);
}

/**
 * Virtualized scroll container that renders only the visible window of items
 * plus an overscan buffer, instead of mounting every item.
 *
 * Maintains a height map (`id → rows`) using measured heights for mounted
 * items and estimated heights for off-window ones. Computes cumulative offsets
 * and renders only the visible range plus overscan, using spacer boxes for the
 * off-window regions to preserve the scroll position in estimated coordinate
 * space. The height map corrects lazily as items scroll into view.
 *
 * @param {Object} props
 * @param {Array<{id: string}>} props.items - The full list of items to virtualize
 * @param {number} props.height - Viewport height in rows
 * @param {number} [props.overscan=0] - Number of extra items to mount on each side
 * @param {Function} props.estimateHeight - Called with `(item)` to estimate an off-window item's height
 * @param {Function} props.renderItem - Called with `(item, index)` to render an item
 * @param {Function} [props.onContentHeightChange] - Called when total content height changes
 * @param {Function} [props.onScroll] - Called with the new scroll offset
 * @returns {React.ReactElement}
 */
export const VirtualScrollView = React.memo(
	forwardRef(function VirtualScrollView(
		{ items, height, overscan = 0, estimateHeight, renderItem, onContentHeightChange, onScroll },
		ref,
	) {
		const viewportRef = useRef(null);
		const contentRef = useRef(null);
		const [scrollOffset, setScrollOffset] = useState(0);
		const scrollOffsetRef = useRef(0);
		// Height map: id → measured/estimated rows.
		const heightMapRef = useRef(new Map());
		// Force a re-render when the height map changes (e.g., an item is measured).
		const [, setHeightTick] = useState(0);
		const viewportMetrics = useBoxMetrics(viewportRef);

		const viewportHeight = viewportMetrics.clientHeight || height || 0;

		// Build the heights array from the height map, falling back to estimates.
		const heights = items.map((item) => {
			const measured = heightMapRef.current.get(item.id);
			return measured !== undefined ? measured : estimateHeight(item);
		});

		const { start, end, offsets, totalHeight } = computeVisibleRange(
			heights,
			viewportHeight,
			scrollOffset,
			overscan,
		);

		const getBottomOffset = useCallback(
			() => Math.max(0, totalHeight - viewportHeight),
			[totalHeight, viewportHeight],
		);

		const scrollTo = useCallback(
			(offset) => {
				const clamped = Math.max(0, Math.min(offset, getBottomOffset()));
				scrollOffsetRef.current = clamped;
				setScrollOffset(clamped);
				onScroll?.(clamped);
			},
			[getBottomOffset, onScroll],
		);

		// Real per-item measurement: update the height map when an item is measured.
		const onMeasure = useCallback((id, measuredHeight) => {
			const prev = heightMapRef.current.get(id);
			if (prev !== measuredHeight) {
				heightMapRef.current.set(id, measuredHeight);
				setHeightTick((n) => n + 1);
			}
		}, []);

		// Re-anchor to the bottom when the user is at the bottom and the height
		// map changes (e.g., an item grows via streaming).
		const wasAtBottomRef = useRef(true);
		useEffect(() => {
			const bottom = getBottomOffset();
			wasAtBottomRef.current = scrollOffsetRef.current >= bottom - 1;
		}, [totalHeight, viewportHeight, getBottomOffset, scrollOffset]);

		useImperativeHandle(
			ref,
			() => ({
				scrollTo,
				scrollBy: (delta) => scrollTo(scrollOffsetRef.current + delta),
				scrollToTop: () => scrollTo(0),
				scrollToBottom: () => scrollTo(getBottomOffset()),
				getScrollOffset: () => scrollOffsetRef.current,
				getContentHeight: () => totalHeight,
				getViewportHeight: () => viewportHeight,
				getBottomOffset,
				// Force a re-render so mounted items re-measure via useBoxMetrics.
				remeasure: () => setHeightTick((n) => n + 1),
				// Re-measure a specific item by its global index. The MeasuredItem
				// wrapper re-measures via useBoxMetrics on the next render and
				// reports the real height through onMeasure, updating the height map.
				remeasureItem: (index) => {
					if (index >= 0 && index < items.length) {
						setHeightTick((n) => n + 1);
					}
				},
			}),
			[scrollTo, getBottomOffset, totalHeight, viewportHeight, items, estimateHeight],
		);

		// Notify the caller when total content height changes.
		const prevTotalHeightRef = useRef(0);
		useEffect(() => {
			if (totalHeight !== prevTotalHeightRef.current) {
				onContentHeightChange?.(totalHeight, prevTotalHeightRef.current);
				prevTotalHeightRef.current = totalHeight;
			}
		}, [totalHeight, onContentHeightChange]);

		// Render the visible window: top spacer + visible items + bottom spacer.
		const visibleItems = [];
		for (let i = start; i < end; i++) {
			const item = items[i];
			visibleItems.push(
				React.createElement(
					MeasuredItem,
					{ key: item.id, id: item.id, onMeasure },
					renderItem(item, i),
				),
			);
		}

		const topSpacerHeight = offsets[start] || 0;
		const bottomSpacerHeight = Math.max(0, totalHeight - offsets[end]);

		return React.createElement(
			Box,
			{ ref: viewportRef, height, overflow: "hidden", flexDirection: "column" },
			React.createElement(
				Box,
				{
					ref: contentRef,
					flexDirection: "column",
					width: "100%",
					flexShrink: 0,
					contentOffsetY: scrollOffset,
				},
				topSpacerHeight > 0
					? React.createElement(Box, { key: "top-spacer", height: topSpacerHeight, flexShrink: 0 })
					: null,
				...visibleItems,
				bottomSpacerHeight > 0
					? React.createElement(Box, {
							key: "bottom-spacer",
							height: bottomSpacerHeight,
							flexShrink: 0,
						})
					: null,
			),
		);
	}),
);
