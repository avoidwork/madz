/**
 * useScroll hook — manages ScrollView ref, resize handling, and keyboard scroll actions.
 */

import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook that manages scroll state and behavior.
 * @param {Function} dispatch - React dispatch function
 * @returns {Object} Scroll hook return value
 */
export function useScroll(dispatch) {
	const scrollRef = useRef(null);

	/**
	 * Handle terminal resize — remeasure ScrollView.
	 */
	useEffect(() => {
		// We need access to stdout for resize events
		// This is handled at the app level via useStdout
		return () => {
			// Cleanup handled by parent
		};
	}, []);

	/**
	 * Scroll to bottom (deferred to allow React commit).
	 */
	const scrollToBottom = useCallback(() => {
		if (scrollRef.current) {
			const handle = () => {
				scrollRef.current?.scrollToBottom();
			};
			setTimeout(handle, 0);
		}
	}, []);

	/**
	 * Scroll by delta rows.
	 * @param {number} delta - Positive = down, negative = up
	 */
	const scrollBy = useCallback((delta) => {
		if (scrollRef.current) {
			scrollRef.current.scrollBy(delta);
		}
	}, []);

	/**
	 * Scroll up by one line.
	 */
	const scrollUp = useCallback(() => {
		scrollBy(-1);
	}, [scrollBy]);

	/**
	 * Scroll down by one line.
	 */
	const scrollDown = useCallback(() => {
		scrollBy(1);
	}, [scrollBy]);

	/**
	 * Scroll up by one page.
	 */
	const pageUp = useCallback(() => {
		if (scrollRef.current) {
			const height = scrollRef.current.getViewportHeight() || 1;
			scrollRef.current.scrollBy(-height);
		}
	}, []);

	/**
	 * Scroll down by one page.
	 */
	const pageDown = useCallback(() => {
		if (scrollRef.current) {
			const height = scrollRef.current.getViewportHeight() || 1;
			scrollRef.current.scrollBy(height);
		}
	}, []);

	/**
	 * Remeasure the ScrollView (call on terminal resize).
	 */
	const remeasure = useCallback(() => {
		if (scrollRef.current && !process.env.CI) {
			scrollRef.current.remeasure();
		}
	}, []);

	return {
		scrollRef,
		scrollToBottom,
		scrollBy,
		scrollUp,
		scrollDown,
		pageUp,
		pageDown,
		remeasure,
	};
}
