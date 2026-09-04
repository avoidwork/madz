/**
 * Recursive descent parser for spreadsheet formulas.
 * Supports: arithmetic, cell references, ranges, built-in functions,
 * string literals, booleans, and conditional expressions.
 * @param {string} formula - The formula string to parse (without leading '=')
 * @returns {function} A function that evaluates the parsed formula against a cell context
 * @throws {Error} If the formula is invalid or contains unsupported operations
 */
export function parseFormula(formula) {
	if (!formula || typeof formula !== "string") {
		throw new Error("Formula must be a non-empty string");
	}

	// Strip leading '=' if present
	const expr = formula.startsWith("=") ? formula.slice(1) : formula;

	const tokens = tokenize(expr);
	const ast = parseExpression(tokens, { pos: 0 });

	/**
	 * Evaluate the AST against a cell context.
	 * @param {Object} context - Map of cell references to values (e.g., { A1: 10, B2: "hello" })
	 * @param {Object} [options] - Evaluation options
	 * @param {number} [options.maxDepth=50] - Maximum recursion depth to prevent circular references
	 * @returns {*} The evaluated result
	 * @throws {Error} On evaluation errors (division by zero, circular refs, etc.)
	 */
	function evaluate(context, options = {}) {
		const { maxDepth = 50 } = options;
		return evaluateNode(ast, context, { depth: 0, maxDepth, visited: new Set() });
	}

	return { evaluate };
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────────

const TOKEN_TYPES = {
	NUMBER: "NUMBER",
	STRING: "STRING",
	IDENTIFIER: "IDENTIFIER", // cell refs like A1, Sheet1!A1
	OPERATOR: "OPERATOR",
	LPAREN: "LPAREN",
	RPAREN: "RPAREN",
	COMMA: "COMMA",
	COLON: "COLON", // range operator
	EOF: "EOF",
};

function tokenize(input) {
	const tokens = [];
	let pos = 0;

	while (pos < input.length) {
		const ch = input[pos];

		// Skip whitespace
		if (/\s/.test(ch)) {
			pos++;
			continue;
		}

		// Numbers (including decimals)
		if (
			/[0-9]/.test(ch) ||
			(ch === "." && pos + 1 < input.length && /[0-9]/.test(input[pos + 1]))
		) {
			let num = "";
			while (pos < input.length && (/[0-9]/.test(input[pos]) || input[pos] === ".")) {
				num += input[pos++];
			}
			tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(num) });
			continue;
		}

		// Strings (double-quoted)
		if (ch === '"') {
			let str = "";
			pos++; // skip opening quote
			while (pos < input.length && input[pos] !== '"') {
				if (input[pos] === "\\" && pos + 1 < input.length) {
					str += input[pos + 1];
					pos += 2;
				} else {
					str += input[pos++];
				}
			}
			pos++; // skip closing quote
			tokens.push({ type: TOKEN_TYPES.STRING, value: str });
			continue;
		}

		// Operators and punctuation
		if (
			ch === "+" ||
			ch === "-" ||
			ch === "*" ||
			ch === "/" ||
			ch === "^" ||
			ch === "=" ||
			ch === "<" ||
			ch === ">" ||
			ch === "!" ||
			ch === "&" ||
			ch === "|"
		) {
			let op = ch;
			pos++;
			// Handle ==, !=, <=, >=, &&, ||
			if (
				pos < input.length &&
				((op === "=" && input[pos] === "=") ||
					(op === "!" && input[pos] === "=") ||
					(op === "<" && input[pos] === "=") ||
					(op === ">" && input[pos] === "=") ||
					(op === "&" && input[pos] === "&") ||
					(op === "|" && input[pos] === "|"))
			) {
				op += input[pos];
				pos++;
			}
			tokens.push({ type: TOKEN_TYPES.OPERATOR, value: op });
			continue;
		}

		if (ch === "(") {
			tokens.push({ type: TOKEN_TYPES.LPAREN });
			pos++;
			continue;
		}
		if (ch === ")") {
			tokens.push({ type: TOKEN_TYPES.RPAREN });
			pos++;
			continue;
		}
		if (ch === ",") {
			tokens.push({ type: TOKEN_TYPES.COMMA });
			pos++;
			continue;
		}
		if (ch === ":") {
			tokens.push({ type: TOKEN_TYPES.COLON });
			pos++;
			continue;
		}

		// Identifiers (cell references, function names, sheet references)
		if (/[a-zA-Z_]/.test(ch)) {
			let ident = "";
			while (pos < input.length && /[a-zA-Z0-9_]/.test(input[pos])) {
				ident += input[pos++];
			}
			tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: ident });
			continue;
		}

		throw new Error(`Unexpected character: '${ch}' at position ${pos}`);
	}

	tokens.push({ type: TOKEN_TYPES.EOF });
	return tokens;
}

// ─── Parser (Recursive Descent) ───────────────────────────────────────────────────

/**
 * Parse tokens into an AST.
 * Grammar (lowest to highest precedence):
 *   expression   → condition
 *   condition    → or ( "||" or )*
 *   or           → and ( "||" and )*
 *   and          → comparison ( "&&" comparison )*
 *   comparison   → add ( ( "==" | "!=" | "<" | ">" | "<=" | ">=" ) add )*
 *   add          → mul ( ( "+" | "-" ) mul )*
 *   mul          → unary ( ( "*" | "/" ) unary )*
 *   unary        → ( "-" | "!" ) unary | power
 *   power        → primary ( "^" primary )*
 *   primary      → NUMBER | STRING | BOOLEAN | cellRef | functionCall | "(" expression ")"
 */
function parseExpression(tokens, ctx) {
	return parseCondition(tokens, ctx);
}

function parseCondition(tokens, ctx) {
	let left = parseOr(tokens, ctx);
	while (tokens[ctx.pos]?.value === "||") {
		ctx.pos++;
		const right = parseOr(tokens, ctx);
		left = { type: "binaryOp", op: "||", left, right };
	}
	return left;
}

function parseOr(tokens, ctx) {
	let left = parseAnd(tokens, ctx);
	while (tokens[ctx.pos]?.value === "||") {
		ctx.pos++;
		const right = parseAnd(tokens, ctx);
		left = { type: "binaryOp", op: "||", left, right };
	}
	return left;
}

function parseAnd(tokens, ctx) {
	let left = parseComparison(tokens, ctx);
	while (tokens[ctx.pos]?.value === "&&") {
		ctx.pos++;
		const right = parseComparison(tokens, ctx);
		left = { type: "binaryOp", op: "&&", left, right };
	}
	return left;
}

function parseComparison(tokens, ctx) {
	let left = parseAdd(tokens, ctx);
	const cmpOps = ["==", "!=", "<", ">", "<=", ">="];
	while (tokens[ctx.pos]?.type === TOKEN_TYPES.OPERATOR && cmpOps.includes(tokens[ctx.pos].value)) {
		const op = tokens[ctx.pos].value;
		ctx.pos++;
		const right = parseAdd(tokens, ctx);
		left = { type: "binaryOp", op, left, right };
	}
	return left;
}

function parseAdd(tokens, ctx) {
	let left = parseMul(tokens, ctx);
	while (
		tokens[ctx.pos]?.type === TOKEN_TYPES.OPERATOR &&
		["+", "-"].includes(tokens[ctx.pos].value)
	) {
		const op = tokens[ctx.pos].value;
		ctx.pos++;
		const right = parseMul(tokens, ctx);
		left = { type: "binaryOp", op, left, right };
	}
	return left;
}

function parseMul(tokens, ctx) {
	let left = parseUnary(tokens, ctx);
	while (
		tokens[ctx.pos]?.type === TOKEN_TYPES.OPERATOR &&
		["*", "/"].includes(tokens[ctx.pos].value)
	) {
		const op = tokens[ctx.pos].value;
		ctx.pos++;
		const right = parseUnary(tokens, ctx);
		left = { type: "binaryOp", op, left, right };
	}
	return left;
}

function parseUnary(tokens, ctx) {
	if (
		tokens[ctx.pos]?.type === TOKEN_TYPES.OPERATOR &&
		["-", "!"].includes(tokens[ctx.pos].value)
	) {
		const op = tokens[ctx.pos].value;
		ctx.pos++;
		const operand = parseUnary(tokens, ctx);
		return { type: "unaryOp", op, operand };
	}
	return parsePower(tokens, ctx);
}

function parsePower(tokens, ctx) {
	let left = parsePrimary(tokens, ctx);
	while (tokens[ctx.pos]?.value === "^") {
		ctx.pos++;
		const right = parsePrimary(tokens, ctx);
		left = { type: "binaryOp", op: "^", left, right };
	}
	return left;
}

function parsePrimary(tokens, ctx) {
	const token = tokens[ctx.pos];

	// Number literal
	if (token?.type === TOKEN_TYPES.NUMBER) {
		ctx.pos++;
		return { type: "literal", value: token.value };
	}

	// String literal
	if (token?.type === TOKEN_TYPES.STRING) {
		ctx.pos++;
		return { type: "literal", value: token.value };
	}

	// Boolean literals
	if (
		token?.type === TOKEN_TYPES.IDENTIFIER &&
		["TRUE", "FALSE"].includes(token.value.toUpperCase())
	) {
		ctx.pos++;
		return { type: "literal", value: token.value.toUpperCase() === "TRUE" };
	}

	// Parenthesized expression
	if (token?.type === TOKEN_TYPES.LPAREN) {
		ctx.pos++;
		const expr = parseExpression(tokens, ctx);
		if (tokens[ctx.pos]?.type !== TOKEN_TYPES.RPAREN) {
			throw new Error("Expected ')'");
		}
		ctx.pos++;
		return expr;
	}

	// Function call or cell reference
	if (token?.type === TOKEN_TYPES.IDENTIFIER) {
		ctx.pos++;
		// Check for function call
		if (tokens[ctx.pos]?.type === TOKEN_TYPES.LPAREN) {
			return parseFunctionCall(token.value, tokens, ctx);
		}
		// Cell reference or range (e.g., A1, Sheet1!A1, A1:B5)
		return parseCellRef(token.value, tokens, ctx);
	}

	throw new Error(`Unexpected token: ${token?.value ?? "EOF"} at position ${ctx.pos}`);
}

function parseFunctionCall(name, tokens, ctx) {
	ctx.pos++; // skip '('
	const args = [];

	if (tokens[ctx.pos]?.type !== TOKEN_TYPES.RPAREN) {
		args.push(parseExpression(tokens, ctx));
		while (tokens[ctx.pos]?.type === TOKEN_TYPES.COMMA) {
			ctx.pos++;
			args.push(parseExpression(tokens, ctx));
		}
	}

	if (tokens[ctx.pos]?.type !== TOKEN_TYPES.RPAREN) {
		throw new Error(`Expected ')' in function call: ${name}`);
	}
	ctx.pos++; // skip ')'

	return { type: "functionCall", name: name.toUpperCase(), args };
}

function parseCellRef(name, tokens, ctx) {
	let ref = name;
	// Handle Sheet1!A1 format
	if (tokens[ctx.pos]?.value === "!") {
		ctx.pos++;
		ref += "!";
		if (tokens[ctx.pos]?.type === TOKEN_TYPES.IDENTIFIER) {
			ref += tokens[ctx.pos].value;
			ctx.pos++;
		}
	}
	// Handle range A1:B5
	if (tokens[ctx.pos]?.type === TOKEN_TYPES.COLON) {
		ctx.pos++;
		if (tokens[ctx.pos]?.type === TOKEN_TYPES.IDENTIFIER) {
			ref += ":" + tokens[ctx.pos].value;
			ctx.pos++;
		}
	}
	return { type: "cellRef", ref };
}

// ─── Evaluator ────────────────────────────────────────────────────────────────────

const BUILTIN_FUNCTIONS = {
	SUM: (args) => args.reduce((sum, v) => sum + safeNumber(v), 0),
	AVERAGE: (args) => {
		const nums = args.map(safeNumber).filter((v) => !isNaN(v));
		return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
	},
	COUNT: (args) => args.filter((v) => v !== null && v !== undefined && v !== "").length,
	COUNTA: (args) => args.filter((v) => v !== null && v !== undefined && v !== "" && v !== 0).length,
	COUNTBLANK: (args) => args.filter((v) => v === null || v === undefined || v === "").length,
	MIN: (args) => {
		const nums = args.map(safeNumber).filter((v) => !isNaN(v));
		return nums.length ? Math.min(...nums) : 0;
	},
	MAX: (args) => {
		const nums = args.map(safeNumber).filter((v) => !isNaN(v));
		return nums.length ? Math.max(...nums) : 0;
	},
	ROUND: (args) => {
		if (args.length < 1 || args.length > 2) throw new Error("ROUND requires 1-2 arguments");
		const num = safeNumber(args[0]);
		const decimals = args[1] ?? 0;
		return Number(num.toFixed(decimals));
	},
	ABS: (args) => Math.abs(safeNumber(args[0])),
	SQRT: (args) => {
		const num = safeNumber(args[0]);
		if (num < 0) throw new Error("Cannot compute square root of negative number");
		return Math.sqrt(num);
	},
	IF: (args) => {
		if (args.length < 2 || args.length > 3) throw new Error("IF requires 2-3 arguments");
		return evaluateCondition(args[0]) ? args[1] : args[2];
	},
	AND: (args) => args.every((v) => evaluateCondition(v)),
	OR: (args) => args.some((v) => evaluateCondition(v)),
	NOT: (args) => !evaluateCondition(args[0]),
	CEILING: (args) => {
		const num = safeNumber(args[0]);
		const significance = args[1] ?? 1;
		return Math.ceil(num / significance) * significance;
	},
	FLOOR: (args) => {
		const num = safeNumber(args[0]);
		const significance = args[1] ?? 1;
		return Math.floor(num / significance) * significance;
	},
	MOD: (args) => {
		const a = safeNumber(args[0]);
		const b = safeNumber(args[1]);
		if (b === 0) throw new Error("Division by zero in MOD");
		return a % b;
	},
	INT: (args) => Math.floor(safeNumber(args[0])),
	LEN: (args) => String(args[0]).length,
	UPPER: (args) => String(args[0]).toUpperCase(),
	LOWER: (args) => String(args[0]).toLowerCase(),
	TRIM: (args) => String(args[0]).trim(),
	CONCATENATE: (args) => args.map(String).join(""),
	MID: (args) => {
		const str = String(args[0]);
		const start = safeNumber(args[1]) - 1; // 1-indexed
		const len = safeNumber(args[2]);
		return str.substring(start, start + len);
	},
	LEFT: (args) => {
		const str = String(args[0]);
		const n = args.length > 1 ? safeNumber(args[1]) : 1;
		return str.substring(0, n);
	},
	RIGHT: (args) => {
		const str = String(args[0]);
		const n = args.length > 1 ? safeNumber(args[1]) : 1;
		return str.substring(str.length - n);
	},
	FIND: (args) => {
		const search = String(args[0]);
		const str = String(args[1]);
		return str.indexOf(search) + 1; // 1-indexed like Excel
	},
	NOW: () => new Date().toISOString(),
	TODAY: () => new Date().toISOString().split("T")[0],
};

function safeNumber(v) {
	if (typeof v === "number") return v;
	if (typeof v === "string") {
		const n = Number(v);
		return isNaN(n) ? 0 : n;
	}
	return 0;
}

function evaluateCondition(v) {
	if (typeof v === "boolean") return v;
	if (typeof v === "number") return v !== 0;
	if (typeof v === "string") return v.length > 0;
	return v !== null && v !== undefined;
}

function evaluateNode(node, context, options) {
	const { depth, maxDepth, visited } = options;

	if (depth > maxDepth) {
		throw new Error("Maximum recursion depth exceeded — possible circular reference");
	}

	switch (node.type) {
		case "literal":
			return node.value;

		case "cellRef": {
			const ref = node.ref;
			// Check for range
			if (ref.includes(":")) {
				return evaluateRange(ref, context, options);
			}
			// Direct cell reference
			if (visited.has(ref)) {
				throw new Error(`Circular reference detected: ${ref}`);
			}
			visited.add(ref);
			const value = context[ref];
			if (value === undefined || value === null) return 0;
			if (typeof value === "string" && value.length > 0 && !isNaN(Number(value)))
				return Number(value);
			return value;
		}

		case "unaryOp": {
			const operand = evaluateNode(node.operand, context, {
				...options,
				depth: depth + 1,
				visited,
			});
			if (node.op === "-") return -safeNumber(operand);
			if (node.op === "!") return !evaluateCondition(operand);
			return operand;
		}

		case "binaryOp": {
			const left = evaluateNode(node.left, context, {
				...options,
				depth: depth + 1,
				visited,
			});
			const right = evaluateNode(node.right, context, {
				...options,
				depth: depth + 1,
				visited,
			});

			switch (node.op) {
				case "+":
					return safeNumber(left) + safeNumber(right);
				case "-":
					return safeNumber(left) - safeNumber(right);
				case "*":
					return safeNumber(left) * safeNumber(right);
				case "/": {
					if (safeNumber(right) === 0) throw new Error("Division by zero");
					return safeNumber(left) / safeNumber(right);
				}
				case "^":
					return Math.pow(safeNumber(left), safeNumber(right));
				case "==":
					return left == right; // eslint-disable-line eqeqeq
				case "!=":
					return left != right; // eslint-disable-line eqeqeq
				case "<":
					return safeNumber(left) < safeNumber(right);
				case ">":
					return safeNumber(left) > safeNumber(right);
				case "<=":
					return safeNumber(left) <= safeNumber(right);
				case ">=":
					return safeNumber(left) >= safeNumber(right);
				case "&&":
					return evaluateCondition(left) && evaluateCondition(right);
				case "||":
					return evaluateCondition(left) || evaluateCondition(right);
				default:
					return left;
			}
		}

		case "functionCall": {
			const fnName = node.name;
			if (!(fnName in BUILTIN_FUNCTIONS)) {
				throw new Error(`Unknown function: ${fnName}`);
			}

			const evaluatedArgs = node.args.flatMap((arg) => {
				const result = evaluateNode(arg, context, {
					...options,
					depth: depth + 1,
					visited,
				});
				return Array.isArray(result) ? result : [result];
			});

			return BUILTIN_FUNCTIONS[fnName](evaluatedArgs);
		}

		default:
			throw new Error(`Unknown AST node type: ${node.type}`);
	}
}

function evaluateRange(rangeStr, context, options) {
	const [start, end] = rangeStr.split(":");
	if (!start || !end) throw new Error(`Invalid range: ${rangeStr}`);

	const startColMatch = start.match(/^([A-Z]+)/);
	const endColMatch = end.match(/^([A-Z]+)/);
	if (!startColMatch || !endColMatch) throw new Error(`Invalid range: ${rangeStr}`);

	const startCol = startColMatch[1];
	const endCol = endColMatch[1];
	const startRow = parseInt(start.replace(/[^0-9]/g, ""), 10);
	const endRow = parseInt(end.replace(/[^0-9]/g, ""), 10);

	const values = [];
	// Iterate over columns
	const colStart = startCol.charCodeAt(0) - 65;
	const colEnd = endCol.charCodeAt(0) - 65;
	for (let colIdx = colStart; colIdx <= colEnd; colIdx++) {
		const col = String.fromCharCode(65 + colIdx);
		for (let row = startRow; row <= endRow; row++) {
			const ref = `${col}${row}`;
			if (options.visited.has(ref)) {
				throw new Error(`Circular reference detected: ${ref}`);
			}
			options.visited.add(ref);
			if (context[ref] !== undefined && context[ref] !== null) {
				values.push(context[ref]);
			}
		}
	}
	return values;
}
