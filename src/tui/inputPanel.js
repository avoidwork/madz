import React, { useState, useCallback, useEffect } from "react";
import TextInput from "ink-text-input";
import { useInput } from "ink";
import { searchFiles } from "./autocomplete.js";

/**
 * Input panel component using ink-text-input for text entry.
 * Handles text input, cursor navigation, and submission via callbacks.
 * Supports @-triggered file path autocomplete mode.
 * @param {Object} props
 * @param {string} props.value - Current input text value
 * @param {(value: string) => void} props.onChange - Callback when value changes
 * @param {() => void} props.onSubmit - Callback when Enter is pressed
 * @param {() => void} props.onFocus - Callback when input gains focus
 * @param {() => void} props.onBlur - Callback when input loses focus
 * @param {boolean} [props.focus] - Whether the input should be focused
 * @param {boolean} [props.inAutocomplete] - Whether autocomplete mode is active
 * @param {string} [props.autocompleteQuery] - Current autocomplete query text
 * @param {string[]} [props.autocompleteMatches] - List of matching file paths
 * @param {number} [props.autocompleteSelectedIndex] - Currently selected index in matches
 * @param {(value: string) => void} [props.onAutocompleteSelect] - Callback when a file is selected
 * @param {(results: string[]) => void} [props.onAutocompleteResults] - Callback when search results are available
 * @returns {React.ReactElement}
 */
export function InputPanel({
	value = "",
	onChange,
	onSubmit,
	onFocus,
	onBlur,
	focus = true,
	inAutocomplete = false,
	autocompleteQuery = "",
	autocompleteMatches = [],
	autocompleteSelectedIndex = 0,
	onAutocompleteSelect,
}) {
	const [internalValue, setInternalValue] = useState(value);
	const [isAutocompleteMode, setIsAutocompleteMode] = useState(inAutocomplete);
	const [query, setQuery] = useState(autocompleteQuery);
	const [selectedIndex, setSelectedIndex] = useState(autocompleteSelectedIndex);

	// Sync external state changes
	const prevAutocomplete = React.useRef(inAutocomplete);
	if (prevAutocomplete.current !== inAutocomplete) {
		setIsAutocompleteMode(inAutocomplete);
		if (!inAutocomplete) {
			setQuery("");
			setSelectedIndex(0);
		}
		prevAutocomplete.current = inAutocomplete;
	}

	const prevQuery = React.useRef(autocompleteQuery);
	if (prevQuery.current !== autocompleteQuery) {
		setQuery(autocompleteQuery);
	}

	const prevIndex = React.useRef(autocompleteSelectedIndex);
	if (prevIndex.current !== autocompleteSelectedIndex) {
		setSelectedIndex(autocompleteSelectedIndex);
	}

	// Debounced search when query changes in autocomplete mode
	const searchTimerRef = React.useRef(null);

	useEffect(() => {
		if (!isAutocompleteMode || !query) {
			return;
		}

		// Clear existing timer
		if (searchTimerRef.current) {
			clearTimeout(searchTimerRef.current);
		}

		// Debounce: wait 150ms before searching
		searchTimerRef.current = setTimeout(async () => {
			const results = await searchFiles(query);
			setSelectedIndex(0);
			// Notify parent of search results
			onAutocompleteResults?.(results);
		}, 150);

		return () => {
			if (searchTimerRef.current) {
				clearTimeout(searchTimerRef.current);
			}
		};
	}, [isAutocompleteMode, query]);

	// Detect @ trigger and enter autocomplete mode
	const handleValueChange = useCallback(
		(newValue) => {
			setInternalValue(newValue);
			// Check if the value contains @ and we're not already in autocomplete mode
			if (!isAutocompleteMode && newValue.includes("@")) {
				const atIndex = newValue.lastIndexOf("@");
				const afterAt = newValue.slice(atIndex + 1);
				if (afterAt.length > 0) {
					setIsAutocompleteMode(true);
					setQuery(afterAt);
					setSelectedIndex(0);
					// Notify parent to start search
					onChange(newValue.slice(0, atIndex + 1));
					return;
				}
			}

			// If we're in autocomplete mode and the value no longer has @, exit
			if (isAutocompleteMode && !newValue.includes("@")) {
				setIsAutocompleteMode(false);
				setQuery("");
				setSelectedIndex(0);
			}

			onChange(newValue);
		},
		[isAutocompleteMode, onChange],
	);

	// Handle keyboard input in autocomplete mode via useInput
	useInput(
		useCallback(
			(key) => {
				if (!isAutocompleteMode) return false;

				if (key.name === "up") {
					setSelectedIndex((prev) => (prev <= 0 ? autocompleteMatches.length - 1 : prev - 1));
					return true;
				}

				if (key.name === "down") {
					setSelectedIndex((prev) => (prev >= autocompleteMatches.length - 1 ? 0 : prev + 1));
					return true;
				}

				if (key.name === "enter") {
					if (autocompleteMatches.length > 0 && onAutocompleteSelect) {
						const selectedPath = autocompleteMatches[selectedIndex];
						const atIndex = internalValue.lastIndexOf("@");
						const beforeAt = internalValue.slice(0, atIndex);
						const fullPath = beforeAt + selectedPath;
						setInternalValue(fullPath);
						setIsAutocompleteMode(false);
						setQuery("");
						setSelectedIndex(0);
						onAutocompleteSelect(fullPath);
					}
					return true;
				}

				if (key.name === "escape") {
					setIsAutocompleteMode(false);
					setQuery("");
					setSelectedIndex(0);
					return true;
				}

				return false;
			},
			[isAutocompleteMode, autocompleteMatches, selectedIndex, internalValue, onAutocompleteSelect],
		),
		{ enableSubstitute: true },
	);

	// Wrap the TextInput's onSubmit to handle autocomplete selection first
	const handleOnSubmit = useCallback(() => {
		if (isAutocompleteMode && autocompleteMatches.length > 0 && onAutocompleteSelect) {
			const selectedPath = autocompleteMatches[selectedIndex];
			const atIndex = internalValue.lastIndexOf("@");
			const beforeAt = internalValue.slice(0, atIndex);
			const fullPath = beforeAt + selectedPath;
			setInternalValue(fullPath);
			setIsAutocompleteMode(false);
			setQuery("");
			setSelectedIndex(0);
			onAutocompleteSelect(fullPath);
			// Don't call the parent onSubmit — let the updated value flow through
			return;
		}
		onSubmit?.();
	}, [
		isAutocompleteMode,
		autocompleteMatches,
		selectedIndex,
		internalValue,
		onSubmit,
		onAutocompleteSelect,
	]);

	return React.createElement(TextInput, {
		value: internalValue,
		onChange: handleValueChange,
		onSubmit: handleOnSubmit,
		onFocus,
		onBlur,
		focus,
		showCursor: true,
	});
}
