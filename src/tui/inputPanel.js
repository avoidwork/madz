import React from "react";
import TextInput from "ink-text-input";

/**
 * Input panel component using ink-text-input for text entry.
 * Handles text input, cursor navigation, @-trigger detection,
 * and cursor position tracking for autocomplete integration.
 * @param {Object} props
 * @param {string} props.value - Current input text value
 * @param {(value: string) => void} props.onChange - Callback when value changes
 * @param {(cursorPos: number) => void} props.onCursorChange - Callback with cursor position
 * @param {(trigger: string) => void} props.onTrigger - Callback when @ is typed
 * @param {() => void} props.onSubmit - Callback when Enter is pressed
 * @param {() => void} props.onFocus - Callback when input gains focus
 * @param {() => void} props.onBlur - Callback when input loses focus
 * @param {boolean} [props.focus] - Whether the input should be focused
 * @returns {React.ReactElement}
 */
export function InputPanel({
	value = "",
	onChange,
	onCursorChange,
	onTrigger,
	onSubmit,
	onFocus,
	onBlur,
	focus = true,
}) {
	const cursorPosRef = { current: value.length };

	return React.createElement(TextInput, {
		value,
		onChange(newValue) {
			const prevLength = value.length;
			const newLength = newValue.length;

			// Detect @ character input
			if (newLength > prevLength) {
				const lastChar = newValue[newLength - 1];
				if (lastChar === "@") {
					onTrigger?.("@");
				}
			}

			// Track cursor position: ink-text-input doesn't expose cursor position
			// directly, so we approximate it by tracking value length changes.
			// When typing at the end, cursor is at the end.
			// When characters are deleted, cursor moves left.
			// For arrow key navigation within text, we track the last known position.
			if (newLength > prevLength) {
				cursorPosRef.current = newLength;
			} else if (newLength < prevLength) {
				cursorPosRef.current = newLength;
			}
			// If length is the same (e.g., arrow key navigation), keep current position

			onCursorChange?.(cursorPosRef.current);
			onChange(newValue);
		},
		onSubmit,
		onFocus,
		onBlur,
		focus,
		showCursor: true,
	});
}
