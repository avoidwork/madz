/**
 * Pivot table generation and aggregation.
 * @module spreadsheet/pivot
 */

/**
 * Group an array of objects by one or more keys.
 * @param {Object[]} data - Array of objects to group
 * @param {string|string[]} keys - Key field name(s) to group by
 * @returns {Object[]} Array of { key, items } groups
 * @throws {Error} If data is empty or keys are invalid
 */
export function groupBy(data, keys) {
	if (!data || !Array.isArray(data) || data.length === 0) {
		throw new Error("groupBy() requires a non-empty array of objects");
	}

	const keyList = Array.isArray(keys) ? keys : [keys];

	// Validate all keys exist in at least some items
	for (const key of keyList) {
		if (typeof key !== "string") {
			throw new Error(`groupBy() key must be a string, got ${typeof key}`);
		}
	}

	const groups = new Map();

	for (const item of data) {
		const groupKey = keyList.map((k) => item[k] ?? "").join(" | ");
		if (!groups.has(groupKey)) {
			groups.set(groupKey, []);
		}
		groups.get(groupKey).push(item);
	}

	return [...groups.entries()].map(([key, items]) => ({ key, items }));
}

/**
 * Generate a pivot table from data.
 * @param {Object[]} data - Array of objects
 * @param {Object} config - Pivot configuration
 * @param {string|string[]} config.keys - Key field(s) for rows
 * @param {string} config.value - Value field to aggregate
 * @param {string} config.aggregate - Aggregation method: "sum", "count", "avg", "min", "max"
 * @param {string} [config.label] - Label for the aggregated column
 * @returns {Object[]} Pivot table rows with aggregated values
 * @throws {Error} If data is empty or config is invalid
 */
export function pivot(data, config) {
	if (!data || !Array.isArray(data) || data.length === 0) {
		throw new Error("pivot() requires a non-empty array of objects");
	}
	if (!config || !config.keys || !config.value || !config.aggregate) {
		throw new Error("pivot() requires keys, value, and aggregate in config");
	}

	const { keys, value, aggregate, label } = config;
	const keyList = Array.isArray(keys) ? keys : [keys];
	const aggLabel = label || `${aggregate}(${value})`;

	// Validate aggregate function
	const validAggregates = ["sum", "count", "avg", "min", "max"];
	if (!validAggregates.includes(aggregate)) {
		throw new Error(`pivot() aggregate must be one of: ${validAggregates.join(", ")}`);
	}

	// Group data
	const groups = groupBy(data, keyList);

	// Compute aggregations
	return groups.map((group) => {
		const row = {};

		// Add key columns
		if (keyList.length === 1) {
			row[keyList[0]] = group.key;
		} else {
			keyList.forEach((k, i) => {
				row[k] = group.key.split(" | ")[i];
			});
		}

		// Compute aggregation
		const values = group.items
			.map((item) => {
				const v = item[value];
				if (v === null || v === undefined) return NaN;
				const n = Number(v);
				return isNaN(n) ? NaN : n;
			})
			.filter((v) => !isNaN(v));

		row[aggLabel] = computeAggregate(values, aggregate);

		return row;
	});
}

/**
 * Compute a single aggregation value.
 * @param {number[]} values - Array of numeric values
 * @param {string} aggregate - Aggregation method
 * @returns {number} Aggregated result
 */
function computeAggregate(values, aggregate) {
	if (values.length === 0) return 0;

	switch (aggregate) {
		case "sum":
			return values.reduce((sum, v) => sum + v, 0);
		case "count":
			return values.length;
		case "avg":
			return values.reduce((sum, v) => sum + v, 0) / values.length;
		case "min":
			return Math.min(...values);
		case "max":
			return Math.max(...values);

	}
}

/**
 * Filter data by a condition expression.
 * @param {Object[]} data - Array of objects
 * @param {string} field - Field name to filter on
 * @param {string} operator - Comparison operator: "eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"
 * @param {*} value - Value to compare against
 * @returns {Object[]} Filtered array
 * @throws {Error} If parameters are invalid
 */
export function filter(data, field, operator, value) {
	if (!data || !Array.isArray(data) || data.length === 0) {
		throw new Error("filter() requires a non-empty array of objects");
	}
	if (!field || !operator) {
		throw new Error("filter() requires field and operator");
	}

	const validOperators = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"];
	if (!validOperators.includes(operator)) {
		throw new Error(`filter() operator must be one of: ${validOperators.join(", ")}`);
	}

	return data.filter((item) => {
		const fieldValue = item[field];

		switch (operator) {
			case "eq":
				return fieldValue == value; // eslint-disable-line eqeqeq
			case "neq":
				return fieldValue != value; // eslint-disable-line eqeqeq
			case "gt":
				return Number(fieldValue) > Number(value);
			case "gte":
				return Number(fieldValue) >= Number(value);
			case "lt":
				return Number(fieldValue) < Number(value);
			case "lte":
				return Number(fieldValue) <= Number(value);
			case "contains":
				return String(fieldValue).includes(String(value));
			case "in":
				return Array.isArray(value) && value.includes(fieldValue);

		}
	});
}

/**
 * Create a multi-dimensional pivot table (rows × columns).
 * @param {Object[]} data - Array of objects
 * @param {Object} config - Pivot configuration
 * @param {string} config.rowKey - Field for row grouping
 * @param {string} config.colKey - Field for column grouping
 * @param {string} config.value - Value field to aggregate
 * @param {string} config.aggregate - Aggregation method: "sum", "count", "avg", "min", "max"
 * @returns {Object[]} Pivot table with row keys and column values
 */
export function pivotMulti(data, config) {
	if (!data || !Array.isArray(data) || data.length === 0) {
		throw new Error("pivotMulti() requires a non-empty array of objects");
	}
	if (!config || !config.rowKey || !config.colKey || !config.value || !config.aggregate) {
		throw new Error("pivotMulti() requires rowKey, colKey, value, and aggregate");
	}

	const { rowKey, colKey, value, aggregate } = config;

	// Collect all column keys
	const colKeys = [...new Set(data.map((item) => item[colKey] ?? "Unknown"))];

	// Group by row key, then by column key
	const rowGroups = new Map();
	for (const item of data) {
		const rowK = item[rowKey] ?? "Unknown";
		const colK = item[colKey] ?? "Unknown";
		if (!rowGroups.has(rowK)) {
			rowGroups.set(rowK, new Map());
		}
		const colMap = rowGroups.get(rowK);
		if (!colMap.has(colK)) {
			colMap.set(colK, []);
		}
		colMap.get(colK).push(item[value]);
	}

	// Build result
	const result = [];
	for (const [rowK, colMap] of rowGroups) {
		const row = { [rowKey]: rowK };
		for (const colK of colKeys) {
			const values = colMap.get(colK) || [];
			row[colK] = computeAggregate(values, aggregate);
		}
		result.push(row);
	}

	return result;
}
