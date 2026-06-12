import {
	saveProfile,
	processOnboardingInput,
	getAttribute,
	sanitizeProfileData,
} from "../memory/profile.js";

/**
 * Phase constants for the onboarding state machine.
 */
export const PHASES = Object.freeze({
	INIT: "INIT",
	ATTRACTOR: "ATTRACTOR",
	COLLECT: "COLLECT",
	SAVE: "SAVE",
	TRANSCEND: "TRANSCEND",
});

const ATTRACTOR_EXPLANATION =
	'This app can learn about you to give more personalized responses. Reply to start, "skip" to skip all questions, "cancel" to exit, or "exit" to quit the app completely.';

/**
 * Create a new onboarding state machine instance.
 * @param {Array} attributes - Profile attributes from ATTRIBUTES array
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.profilePath] - Path to save profile (default: memory/context/profile.md)
 * @returns {Onboarding}
 */
export function createOnboarding(attributes, options = {}) {
	return new Onboarding(attributes, options);
}

/**
 * Onboarding state machine that manages the conversational flow.
 */
export class Onboarding {
	#attributes;
	#phase;
	#index;
	#profileData;
	#profilePath;
	#started;
	#onSave;

	/**
	 * Create a new onboarding state machine.
	 * @param {Array} attributes - Profile attributes
	 * @param {Object} [options] - Configuration options
	 * @param {Function} [options.onSave] - Callback invoked after saveProfile() succeeds
	 */
	constructor(attributes, options = {}) {
		this.#attributes = attributes;
		this.#phase = PHASES.INIT;
		this.#index = 0;
		this.#profileData = {};
		this.#profilePath = options.profilePath || "memory/context/profile.md";
		this.#started = false;
		this.#onSave = options.onSave || null;
	}

	/**
	 * Get the current phase.
	 * @returns {string}
	 */
	getPhase() {
		return this.#phase;
	}

	/**
	 * Check if the onboarding flow has started.
	 * @returns {boolean}
	 */
	isStarted() {
		return this.#started;
	}

	/**
	 * Get the current attribute prompt and the number of remaining questions.
	 * @returns {{ prompt: string, current: number, total: number } | null}
	 */
	getCurrentPrompt() {
		if (!this.#attributes) return null;
		if (this.#phase === PHASES.ATTRACTOR) {
			return { prompt: ATTRACTOR_EXPLANATION, current: 0, total: this.#attributes.length };
		}
		if (this.#phase === PHASES.COLLECT) {
			const attr = getAttribute(this.#index);
			if (!attr) return null;
			return { prompt: attr.prompt, current: this.#index + 1, total: this.#attributes.length };
		}
		return null;
	}

	/**
	 * Process a user response and update state machine phase.
	 * Returns the next action: "nextPrompt", "save", "exit", or "skip".
	 * @param {string} userInput - The user's text input
	 * @returns {{ action: string, prompt?: string, current?: number, total?: number }}
	 */
	processResponse(userInput) {
		if (this.#phase === PHASES.INIT) {
			// Any input starts the onboarding
			this.#started = true;
			// Check for skip/cancel/exit from init
			const ctrl = processOnboardingInput(userInput);
			if (ctrl === "exit") {
				return { action: "exit" };
			}
			if (ctrl === "cancel" || ctrl === "skip") {
				this.#phase = PHASES.SAVE;
				return { action: "save" };
			}
			this.#phase = PHASES.ATTRACTOR;
			return { action: "nextPrompt" };
		}

		if (this.#phase === PHASES.ATTRACTOR) {
			const ctrl = processOnboardingInput(userInput);
			if (ctrl === "exit") {
				return { action: "exit" };
			}
			if (ctrl === "cancel") {
				this.#phase = PHASES.SAVE;
				return { action: "save" };
			}
			if (ctrl === "skip") {
				this.#phase = PHASES.SAVE;
				return { action: "save" };
			}
			// Normal response = proceed to COLLECT
			this.#phase = PHASES.COLLECT;
			return { action: "nextPrompt" };
		}

		if (this.#phase === PHASES.COLLECT) {
			// Only process skip/cancel control words if the input is a control
			const ctrl = processOnboardingInput(userInput);
			if (ctrl === "exit") {
				// In COLLECT, exit is treated as cancel
				this.#phase = PHASES.SAVE;
				return { action: "save" };
			}
			if (ctrl === "cancel") {
				this.#phase = PHASES.SAVE;
				return { action: "save" };
			}
			if (ctrl === "skip") {
				// Skip current attribute, move to next
				this.#index++;
				return this.#advanceOrSave();
			}
			// Normal response = save current attribute value
			if (userInput && userInput.trim()) {
				const attr = getAttribute(this.#index);
				if (attr) {
					this.#profileData[attr.key] = userInput.trim();
				}
			}
			this.#index++;
			return this.#advanceOrSave();
		}

		// SAVE or TRANSCEND phases - no processing needed
		if (this.#phase === PHASES.SAVE) {
			return { action: "done" };
		}

		return { action: "done" };
	}

	/**
	 * Attempt to advance to next attribute or transition to SAVE.
	 * @returns {{ action: string, prompt?: string, current?: number, total?: number }}
	 */
	#advanceOrSave() {
		if (this.#index >= this.#attributes.length) {
			this.#phase = PHASES.SAVE;
			return { action: "save" };
		}
		return { action: "nextPrompt" };
	}

	/**
	 * Execute the SAVE phase: persist profile data to disk.
	 * @returns {boolean} Whether save succeeded
	 */
	save() {
		if (this.#phase !== PHASES.SAVE) {
			return false;
		}
		const sanitized = sanitizeProfileData(this.#profileData);
		saveProfile(sanitized, this.#profilePath);
		// Invoke the onSave callback if provided (e.g., auto-schedule)
		if (this.#onSave) {
			this.#onSave();
		}
		this.#phase = PHASES.TRANSCEND;
		return true;
	}

	/**
	 * Check whether the onboarding flow is complete.
	 * @returns {boolean}
	 */
	isComplete() {
		return this.#phase === PHASES.TRANSCEND;
	}

	/**
	 * Get the collected profile data.
	 * @returns {Object}
	 */
	getProfileData() {
		return { ...this.#profileData };
	}
}
