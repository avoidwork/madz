/**
 * Statistical operations for spreadsheet data.
 * @module spreadsheet/stats
 */

/**
 * Calculate the mean (average) of an array of numbers.
 * @param {number[]} data - Array of numeric values
 * @returns {number} The arithmetic mean
 * @throws {Error} If data is empty
 */
export function mean(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("mean() requires a non-empty array of numbers");
  }
  const nums = data.map(safeNumber).filter((v) => !isNaN(v));
  if (nums.length === 0) return 0;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

/**
 * Calculate the median of an array of numbers.
 * @param {number[]} data - Array of numeric values
 * @returns {number} The median value
 * @throws {Error} If data is empty
 */
export function median(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("median() requires a non-empty array of numbers");
  }
  const nums = data.map(safeNumber).filter((v) => !isNaN(v)).sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

/**
 * Calculate the mode(s) of an array of values.
 * @param {*}[] data - Array of values
 * @returns {*[]} Array of mode values (may be empty if all values are unique)
 */
export function mode(data) {
  if (!data || !Array.isArray(data) || data.length === 0) return [];
  const freq = new Map();
  for (const v of data) {
    const key = String(v);
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  const maxFreq = Math.max(...freq.values());
  if (maxFreq <= 1) return [];
  return [...freq.entries()]
    .filter(([, count]) => count === maxFreq)
    .map(([key]) => {
      // Try to preserve numeric type
      const num = Number(key);
      return isNaN(num) ? key : num;
    });
}

/**
 * Calculate the sample standard deviation.
 * @param {number[]} data - Array of numeric values
 * @returns {number} Sample standard deviation
 * @throws {Error} If data has fewer than 2 elements
 */
export function stddev(data) {
  if (!data || !Array.isArray(data) || data.length < 2) {
    throw new Error("stddev() requires at least 2 numbers");
  }
  const nums = data.map(safeNumber).filter((v) => !isNaN(v));
  if (nums.length < 2) throw new Error("stddev() requires at least 2 numbers");
  const m = nums.reduce((sum, v) => sum + v, 0) / nums.length;
  const variance = nums.reduce((sum, v) => sum + (v - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate the population standard deviation.
 * @param {number[]} data - Array of numeric values
 * @returns {number} Population standard deviation
 */
export function populationStddev(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("populationStddev() requires a non-empty array of numbers");
  }
  const nums = data.map(safeNumber).filter((v) => !isNaN(v));
  if (nums.length === 0) return 0;
  const m = nums.reduce((sum, v) => sum + v, 0) / nums.length;
  const variance = nums.reduce((sum, v) => sum + (v - m) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

/**
 * Calculate the variance (sample).
 * @param {number[]} data - Array of numeric values
 * @returns {number} Sample variance
 * @throws {Error} If data has fewer than 2 elements
 */
export function variance(data) {
  if (!data || !Array.isArray(data) || data.length < 2) {
    throw new Error("variance() requires at least 2 numbers");
  }
  const nums = data.map(safeNumber).filter((v) => !isNaN(v));
  if (nums.length < 2) throw new Error("variance() requires at least 2 numbers");
  const m = nums.reduce((sum, v) => sum + v, 0) / nums.length;
  return nums.reduce((sum, v) => sum + (v - m) ** 2, 0) / (nums.length - 1);
}

/**
 * Calculate the population variance.
 * @param {number[]} data - Array of numeric values
 * @returns {number} Population variance
 */
export function populationVariance(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("populationVariance() requires a non-empty array of numbers");
  }
  const nums = data.map(safeNumber).filter((v) => !isNaN(v));
  if (nums.length === 0) return 0;
  const m = nums.reduce((sum, v) => sum + v, 0) / nums.length;
  return nums.reduce((sum, v) => sum + (v - m) ** 2, 0) / nums.length;
}

/**
 * Calculate a percentile value.
 * @param {number[]} data - Array of numeric values
 * @param {number} p - Percentile (0-100)
 * @returns {number} The value at the given percentile
 * @throws {Error} If data is empty or p is out of range
 */
export function percentile(data, p) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("percentile() requires a non-empty array of numbers");
  }
  if (p < 0 || p > 100) {
    throw new Error(`percentile() requires p between 0 and 100, got ${p}`);
  }
  const nums = data.map(safeNumber).filter((v) => !isNaN(v)).sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  if (nums.length === 1) return nums[0];

  // Linear interpolation method
  const index = (p / 100) * (nums.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return nums[lower];
  const fraction = index - lower;
  return nums[lower] + fraction * (nums[upper] - nums[lower]);
}

/**
 * Group data by date ranges (month, quarter, year).
 * @param {Object[]} data - Array of objects with a date field
 * @param {string} dateField - Name of the date field (ISO string or Date object)
 * @param {string} range - Date range: "month", "quarter", or "year"
 * @returns {Object[]} Array of { key, items } groups
 * @throws {Error} If data is empty or dateField is invalid
 */
export function groupByDate(data, dateField, range = "month") {
  if (!data || !Array.isArray(data) || data.length === 0) {
    throw new Error("groupByDate() requires a non-empty array of objects");
  }
  if (!dateField || typeof dateField !== "string") {
    throw new Error("groupByDate() requires a valid date field name");
  }
  if (!["month", "quarter", "year"].includes(range)) {
    throw new Error("groupByDate() range must be 'month', 'quarter', or 'year'");
  }

  const groups = new Map();

  for (const item of data) {
    let date;
    if (item[dateField] instanceof Date) {
      date = item[dateField];
    } else if (typeof item[dateField] === "string") {
      date = new Date(item[dateField]);
      if (isNaN(date.getTime())) continue; // skip invalid dates
    } else {
      continue; // skip items without valid dates
    }

    let key;
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed

    if (range === "year") {
      key = `${year}`;
    } else if (range === "quarter") {
      const quarter = Math.floor(month / 3) + 1;
      key = `${year}-Q${quarter}`;
    } else {
      // month
      const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      key = `${monthNames[month]} ${year}`;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  return [...groups.entries()].map(([key, items]) => ({ key, items }));
}

/**
 * Safely convert a value to a number.
 * @param {*} v - Value to convert
 * @returns {number} Numeric value, or 0 if not convertible
 */
function safeNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  if (v instanceof Date) return v.getTime();
  return 0;
}