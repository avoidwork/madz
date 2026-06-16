/**
 * useScroll hook — manages ScrollView ref, terminal resize handling,
 * and keyboard scroll logic.
 */

import { useRef, useEffect, useCallback } from "react";
import { useStdout } from "ink";

/**
 * Hook for scroll management.
 * @param {Object} deps - Dependencies
 * @param {Function} deps.setScrollOffset - Dispatch scroll offset
 * @param {Function} deps.setViewportHeight - Dispatch viewport height
 * @returns {Object} Scroll management object
 */
export function useScroll(deps) {
	const scrollRef = useRef(null);
	const { stdout } = useStdout();

	// Handle terminal resize
	useEffect(() => {
		const resizeHandler = () => {
			if (scrollRef.current && stdout.isTTY && !process.env.CI) {
				scrollRef.current.remeasure();
			}
		};
		stdout.on("resize", resizeHandler);
		return () => {
			stdout.off("resize", resizeHandler);
		};
	}, [stdout]);

	/**
	 * Scroll by delta rows.
	 * @param {number} delta - Positive = down, negative = up
	 */
	const scrollBy = useCallback(
		(delta) => {
			if (scrollRef.current) {
				scrollRef.current.scrollBy(delta);
			}
		},
		[],
	);

	/**
	 * Scroll to bottom.
	 */
	const scrollToBottom = useCallback(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollToBottom();
		}
	}, []);

	/**
	 * Get the current viewport height.
	 * @returns {number}
	 */
	const getViewportHeight = useCallback(() => {
		if (scrollRef.current) {
			return scrollRef.current.getViewportHeight() || 1;
		}
		return 1;
	}, []);

	return {
		scrollRef,
		scrollBy,
		scrollToBottom,
		getViewportHeight,
	};
}
