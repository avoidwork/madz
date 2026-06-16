/**
 * Scroll hook for TUI.
 * Manages ScrollView ref, terminal resize handling, and keyboard scroll.
 */
import { useRef, useCallback, useEffect } from "react";
import { useStdout } from "ink";

/**
 * Hook that manages scroll state and behavior for the conversation panel.
 * @param {Object} [options]
 * @param {boolean} [options.autoScroll=true] - Whether to auto-scroll on new messages
 * @returns {Object} Scroll management API
 */
export function useScroll(options = {}) {
	const { autoScroll = true } = options;
	const scrollRef = useRef(null);
	const previousMessageCount = useRef(0);
	const previousContentHashRef = useRef(0);
	const { stdout } = useStdout();

	/**
	 * Handle terminal resize by remeasuring content heights.
	 */
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
	 * Scroll to bottom if auto-scroll is enabled and content changed.
	 * @param {number} messageCount - Current message count
	 * @param {boolean} isStreaming - Whether currently streaming
	 * @param {string} streamingContent - Current streaming content length
	 */
	const maybeScrollToBottom = useCallback(
		(messageCount, isStreaming, streamingContentLen) => {
			if (!autoScroll || !scrollRef.current) return;

			const contentHash = messageCount + (isStreaming ? streamingContentLen : 0);
			const shouldScroll =
				messageCount > previousMessageCount.current ||
				(isStreaming && contentHash !== previousContentHashRef.current);

			if (shouldScroll) {
				if (scrollRef.current.remeasure) {
					scrollRef.current.remeasure();
				}
				const scrollHandle = () => {
					if (scrollRef.current && scrollRef.current.scrollToBottom) {
						scrollRef.current.scrollToBottom();
						previousMessageCount.current = messageCount;
					}
				};
				const timer = setTimeout(scrollHandle, 0);
				return () => clearTimeout(timer);
			}

			previousContentHashRef.current = contentHash;
		},
		[autoScroll],
	);

	/**
	 * Scroll up by the specified amount.
	 * @param {number} [amount=1] - Lines to scroll up
	 */
	const scrollUp = useCallback((amount = 1) => {
		if (scrollRef.current && scrollRef.current.scrollBy) {
			scrollRef.current.scrollBy(-amount);
		}
	}, []);

	/**
	 * Scroll down by the specified amount.
	 * @param {number} [amount=1] - Lines to scroll down
	 */
	const scrollDown = useCallback((amount = 1) => {
		if (scrollRef.current && scrollRef.current.scrollBy) {
			scrollRef.current.scrollBy(amount);
		}
	}, []);

	/**
	 * Page up by one viewport.
	 */
	const pageUp = useCallback(() => {
		if (scrollRef.current && scrollRef.current.getViewportHeight) {
			const height = scrollRef.current.getViewportHeight() || 1;
			scrollRef.current.scrollBy(-height);
		}
	}, []);

	/**
	 * Page down by one viewport.
	 */
	const pageDown = useCallback(() => {
		if (scrollRef.current && scrollRef.current.getViewportHeight) {
			const height = scrollRef.current.getViewportHeight() || 1;
			scrollRef.current.scrollBy(height);
		}
	}, []);

	/**
	 * Get the current scroll offset.
	 * @returns {number}
	 */
	const getScrollOffset = useCallback(() => {
		if (scrollRef.current && scrollRef.current.getScrollOffset) {
			return scrollRef.current.getScrollOffset();
		}
		return 0;
	}, []);

	/**
	 * Get the viewport height.
	 * @returns {number}
	 */
	const getViewportHeight = useCallback(() => {
		if (scrollRef.current && scrollRef.current.getViewportHeight) {
			return scrollRef.current.getViewportHeight();
		}
		return 0;
	}, []);

	/**
	 * Re-measure content heights.
	 */
	const remeasure = useCallback(() => {
		if (scrollRef.current && scrollRef.current.remeasure) {
			scrollRef.current.remeasure();
		}
	}, []);

	return {
		scrollRef,
		maybeScrollToBottom,
		scrollUp,
		scrollDown,
		pageUp,
		pageDown,
		getScrollOffset,
		getViewportHeight,
		remeasure,
	};
}
