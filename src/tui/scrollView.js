import React, { useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Box, useBoxMetrics } from "ink";

/**
 * Minimal scroll container built on Ink 8's native overflow/contentOffset primitives.
 *
 * Replaces `ink-scroll-view`, whose per-item measurement and automatic
 * content-height tracking proved unreliable for this app. This component does
 * NOT try to auto-scroll or auto-measure children — the caller drives scrolling
 * imperatively via the exposed methods (scrollBy, scrollToBottom, etc.), which
 * is how the conversation panel already works.
 *
 * @param {Object} props
 * @param {number} [props.height] - Viewport height in rows
 * @param {Function} [props.onContentHeightChange] - Called when content height changes
 * @param {Function} [props.onScroll] - Called with the new scroll offset
 * @param {React.ReactNode} props.children - Scrollable content
 * @returns {React.ReactElement}
 */
export const ScrollView = forwardRef(function ScrollView(
	{ height, onContentHeightChange, onScroll, children, ...boxProps },
	ref,
) {
	const viewportRef = useRef(null);
	const contentRef = useRef(null);
	const [scrollOffset, setScrollOffset] = useState(0);
	const viewportMetrics = useBoxMetrics(viewportRef);
	const contentMetrics = useBoxMetrics(contentRef);

	const viewportHeight = viewportMetrics.clientHeight || height || 0;
	const contentHeight = contentMetrics.clientHeight || 0;

	const getBottomOffset = useCallback(
		() => Math.max(0, contentHeight - viewportHeight),
		[contentHeight, viewportHeight],
	);

	const scrollTo = useCallback(
		(offset) => {
			const clamped = Math.max(0, Math.min(offset, getBottomOffset()));
			setScrollOffset(clamped);
			onScroll?.(clamped);
		},
		[getBottomOffset, onScroll],
	);

	useImperativeHandle(
		ref,
		() => ({
			scrollTo,
			scrollBy: (delta) => scrollTo(scrollOffset + delta),
			scrollToTop: () => scrollTo(0),
			scrollToBottom: () => scrollTo(getBottomOffset()),
			getScrollOffset: () => scrollOffset,
			getContentHeight: () => contentHeight,
			getViewportHeight: () => viewportHeight,
			getBottomOffset,
			// Ink 8's useBoxMetrics re-measures automatically on layout changes,
			// so these are no-ops kept for API compatibility.
			remeasure: () => {},
			remeasureItem: () => {},
		}),
		[scrollTo, scrollOffset, getBottomOffset, contentHeight, viewportHeight],
	);

	// Notify the caller when content height changes (e.g., a new message added).
	const prevContentHeightRef = useRef(0);
	React.useEffect(() => {
		if (contentHeight !== prevContentHeightRef.current) {
			onContentHeightChange?.(contentHeight, prevContentHeightRef.current);
			prevContentHeightRef.current = contentHeight;
		}
	}, [contentHeight, onContentHeightChange]);

	return React.createElement(
		Box,
		{ ref: viewportRef, height, overflow: "hidden", ...boxProps },
		React.createElement(
			Box,
			{ ref: contentRef, flexDirection: "column", width: "100%", contentOffsetY: scrollOffset },
			children,
		),
	);
});
