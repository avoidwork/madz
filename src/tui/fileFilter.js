/**
 * File filter utilities for TUI file path autocomplete.
 * Provides fuzzy text filtering with case-insensitive substring matching
 * and prefix scoring for relevance ranking.
 */

/**
 * Score a file path against a search query.
 * Higher scores indicate better matches.
 * Prefix matches score higher than mid-string matches.
 * @param {string} filePath - File path to score
 * @param {string} query - Search query
 * @returns {number} Score (higher is better)
 */
export function scoreFile(filePath, query) {
	const lowerPath = filePath.toLowerCase();
	const lowerQuery = query.toLowerCase();

	// No match
	if (!lowerPath.includes(lowerQuery)) {
		return -1;
	}

	let score = 1;

	// Check for prefix match (query matches start of path or a path segment)
	const segments = filePath.split("/");
	const lastSegment = segments[segments.length - 1];

	// Exact prefix match at start of full path
	if (lowerPath.startsWith(lowerQuery)) {
		return 100;
	}

	// Prefix match at start of any segment
	for (const segment of segments) {
		if (segment.toLowerCase().startsWith(lowerQuery)) {
			score += 50;
			break;
		}
	}

	// Prefix match on last segment (filename)
	if (lastSegment.toLowerCase().startsWith(lowerQuery)) {
		score += 30;
	}

	// Exact substring match
	const idx = lowerPath.indexOf(lowerQuery);
	if (idx === 0) {
		score += 20;
	} else if (idx > 0 && filePath[idx - 1] === "/") {
		// Match at start of a path segment
		score += 15;
	} else {
		// Mid-string match
		score += 5;
	}

	// Bonus for shorter paths (more specific matches)
	score += Math.max(0, 10 - filePath.length / 10);

	return score;
}

/**
 * Filter and sort file paths by relevance to a query.
 * @param {string[]} files - Array of file paths
 * @param {string} query - Search query
 * @param {number} [maxResults] - Maximum number of results to return
 * @returns {string[]} Filtered and sorted file paths
 */
export function filterFiles(files, query, maxResults = 500) {
	if (!query || query.length === 0) {
		return files.slice(0, maxResults);
	}

	const scored = files
		.map((file) => ({ file, score: scoreFile(file, query) }))
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, maxResults)
		.map((entry) => entry.file);

	return scored;
}

/**
 * Fuzzy match files against a query — convenience wrapper around filterFiles.
 * @param {string[]} files - Array of file paths
 * @param {string} query - Search query
 * @returns {string[]} Filtered file paths
 */
export function fuzzyMatch(files, query) {
	return filterFiles(files, query);
}
