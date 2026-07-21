import React from "react";
import TextInput from "ink-text-input";

/**
 * Input panel component using ink-text-input for text entry.
 * Handles text input, cursor navigation, and submission via callbacks.
 * @param {Object} props
 * @param {string} props.value - Current input text value
 * @param {(value: string) => void} props.onChange - Callback when value changes
 * @param {() => void} props.onSubmit - Callback when Enter is pressed
 * @param {() => void} props.onFocus - Callback when input gains focus
 * @param {() => void} props.onBlur - Callback when input loses focus
 * @param {boolean} [props.focus] - Whether the input should be focused
 * @returns {React.ReactElement}
 */
export function InputPanel({ value = "", onChange, onSubmit, onFocus, onBlur, focus = true }) {
	return React.createElement(TextInput, {
		value,
		onChange,
		onSubmit,
		onFocus,
		onBlur,
		focus,
		showCursor: true,
	});
}
