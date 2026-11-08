/** Matches a leftover SGR mouse report (ESC already stripped by Ink). */
const LEFTOVER_MOUSE_RE = /^\[<\d+;\d+;\d+[Mm]/;

/**
 * Whether a keypress is printable text that should leave select mode and be
 * delivered to the input. Control/meta chords, navigation keys, Enter, Escape,
 * Tab and leftover mouse reports are rejected so they are never inserted.
 * @param {string} input - Input string from Ink's useInput
 * @param {Object} key - Key flags from Ink's useInput
 * @returns {boolean} True for printable text
 */
export function isPrintableKey(input, key = {}) {
	if (typeof input !== "string" || input.length === 0) return false;
	if (key.ctrl || key.meta || key.escape || key.return || key.tab) return false;
	if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) return false;
	if (key.pageUp || key.pageDown || key.home || key.end) return false;
	if (key.backspace || key.delete) return false;
	if (LEFTOVER_MOUSE_RE.test(input)) return false;
	// eslint-disable-next-line no-control-regex -- rejecting control characters is the purpose
	return !/[\x00-\x1f\x7f]/.test(input);
}

/**
 * Route a navigation key for the current mode. Default mode: Up/Down browse
 * input history, PageUp/PageDown scroll. Select mode: all four scroll.
 * @param {boolean} selectMode - Whether select mode is active
 * @param {Object} key - Key flags from Ink's useInput
 * @returns {{type: "history", direction: "up"|"down"}|{type: "scroll", unit: "line"|"page", direction: -1|1}|null}
 */
export function routeNavKey(selectMode, key = {}) {
	if (key.pageUp) return { type: "scroll", unit: "page", direction: -1 };
	if (key.pageDown) return { type: "scroll", unit: "page", direction: 1 };
	if (key.upArrow) {
		return selectMode
			? { type: "scroll", unit: "line", direction: -1 }
			: { type: "history", direction: "up" };
	}
	if (key.downArrow) {
		return selectMode
			? { type: "scroll", unit: "line", direction: 1 }
			: { type: "history", direction: "down" };
	}
	return null;
}

/**
 * Mouse reporting is on by default and off only in select mode, so the
 * terminal can do native drag-select and copy.
 * @param {boolean} selectMode - Whether select mode is active
 * @returns {boolean} True when mouse reporting should be enabled
 */
export function isMouseEnabled(selectMode) {
	return !selectMode;
}

/**
 * Whether a click should be handled (link open): not in select mode, and only
 * in the conversation view.
 * @param {boolean} selectMode - Whether select mode is active
 * @param {boolean} inConversationView - Whether the conversation view is active
 * @returns {boolean} True when clicks are handled
 */
export function shouldHandleClick(selectMode, inConversationView) {
	return !selectMode && inConversationView;
}
