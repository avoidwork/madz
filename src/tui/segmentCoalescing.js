/**
 * Shared segment coalescing rules for streaming message content.
 *
 * Both the main conversation panel (`messageList.js`) and the SUBAGENTS panel
 * (`subagentStore.js`) fold streaming segments into ordered blocks. This module
 * is the single source of truth for how those segments merge, so the two panels
 * render the same stream identically. It is pure (no React, no ink) so it can be
 * imported by the subagent store without pulling in the component tree.
 */

/**
 * Determine whether a new message chunk begins a fresh block rather than
 * continuing the previous message segment.
 *
 * A chunk is treated as a boundary (new block) when it starts a new sentence
 * (the previous content ends with sentence-ending punctuation and the chunk
 * begins with a capital letter) or when it begins a block-level data structure
 * (fenced code, heading, list item, numbered item, blockquote, or horizontal
 * rule). Otherwise it is a mid-sequence continuation and should coalesce.
 *
 * Whitespace is trimmed only for the decision — streaming LLMs often emit
 * tokens with leading/trailing spaces for formatting. The stored content is
 * preserved as-is; we just make a smarter call about whether this chunk starts
 * a new sentence or data structure.
 *
 * @param {string} prevContent - The accumulated content of the prior message segment
 * @param {string} newContent - The incoming message chunk
 * @returns {boolean} True if the chunk should start a new block
 */
export function isMessageBoundary(prevContent, newContent) {
	const prev = prevContent.trimEnd();
	const next = newContent.trimStart();
	if ((prev.endsWith(".") || prev.endsWith("?") || prev.endsWith("!")) && /^[A-Z]/.test(next)) {
		return true;
	}
	// Numbered-list markers are restricted to 1-3 digits so a 4-digit year
	// (e.g. "2024. The answer...") is not mistaken for a list boundary.
	if (/^\s*(```|#{1,6}\s|[-*+]\s|\d{1,3}\.\s|>\s|---)/.test(newContent)) {
		return true;
	}
	return false;
}

/**
 * Coalesce an incoming segment into an existing ordered segment array.
 *
 * This is the single source of truth for how streaming segments merge. It is a
 * pure function so the coalescing rules can be unit-tested in isolation and
 * reused by both the message list and the subagent store.
 *
 * Rules by incoming segment type:
 * - `reasoning` — coalesces with the last reasoning segment even if a message
 *   or tool interleaved, splitting only on a grammatical sentence boundary.
 * - `tool` — always pushes a new segment (each renders with its own header).
 * - `message` — coalesces with the immediately-previous message segment
 *   (continuous streaming); if a tool or reasoning segment interleaved, walks
 *   backwards to the last message segment and coalesces only when the new
 *   chunk is a mid-sequence continuation (not a sentence or data boundary).
 *
 * @param {Array<{type: string, content: string, name?: string}>} existing - Existing ordered segments
 * @param {{type: string, content: string, name?: string}} newSeg - The incoming segment to merge
 * @returns {Array<{type: string, content: string, name?: string}>} A new merged segments array
 */
export function coalesceSegment(existing, newSeg) {
	const merged = existing.map((s) => ({ ...s }));
	if (newSeg.type === "reasoning") {
		// Reasoning coalesces with the last reasoning segment even if a message
		// or tool interleaved between chunks — otherwise continuous reasoning
		// gets split into separate reasoning blocks. Search backwards for the
		// last reasoning segment.
		let lastReasoning = null;
		for (let i = merged.length - 1; i >= 0; i--) {
			if (merged[i].type === "reasoning") {
				lastReasoning = merged[i];
				break;
			}
		}
		// Grammatical sentence boundary: a period followed by a capital letter
		// starts a new block; otherwise coalesce. Trim whitespace for the
		// decision only — streaming LLMs emit tokens with formatting spaces.
		const prevReasoning = lastReasoning ? lastReasoning.content.trimEnd() : "";
		const nextReasoning = newSeg.content.trimStart();
		if (
			lastReasoning &&
			(prevReasoning.endsWith(".") || prevReasoning.endsWith("?") || prevReasoning.endsWith("!")) &&
			/^[A-Z]/.test(nextReasoning)
		) {
			merged.push({ ...newSeg });
		} else if (lastReasoning) {
			lastReasoning.content += newSeg.content;
		} else {
			merged.push({ ...newSeg });
		}
	} else if (newSeg.type === "tool") {
		// Each tool message gets its own segment so it renders as its own block
		// with its own name header. No coalescing.
		merged.push({ ...newSeg });
	} else {
		// Message segments. If the immediately-previous segment is also a
		// message, coalesce unconditionally — this is the continuous streaming
		// case where a single response arrives as many small chunks. If a tool
		// or reasoning segment interleaved, walk backwards to find the last
		// message segment and coalesce only when the new chunk is a mid-sequence
		// continuation (not a sentence or data boundary).
		const lastSeg = merged[merged.length - 1];
		if (lastSeg && lastSeg.type === "message") {
			lastSeg.content += newSeg.content;
		} else {
			let lastMessage = null;
			for (let i = merged.length - 1; i >= 0; i--) {
				if (merged[i].type === "message") {
					lastMessage = merged[i];
					break;
				}
			}
			if (lastMessage && !isMessageBoundary(lastMessage.content, newSeg.content)) {
				lastMessage.content += newSeg.content;
			} else {
				merged.push({ ...newSeg });
			}
		}
	}
	return merged;
}
