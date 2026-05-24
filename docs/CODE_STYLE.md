# Code Style Guide

This guide documents the coding conventions used throughout `madz`. It is derived from the actual codebase, not aspirational — when in doubt, **match existing code in the same file or module**.

---

## Table of Contents

- [Naming](#naming)
- [Imports](#imports)
- [Exports](#exports)
- [Classes](#classes)
- [Functions](#functions)
- [Error Handling](#error-handling)
- [Async Code](#async-code)
- [Type Safety](#type-safety)
- [Documentation](#documentation)
- [Files and Directory Structure](#files-and-directory-structure)
- [Testing](#testing)
- [Git Workflow](#git-workflow)

---

## Naming

| Convention | Example | Used For |
|---|---|---|
| `camelCase` | `writeMemoryFile`, `resolvePermissions`, `contextList` | Functions, methods, variables |
| `UPPER_SNAKE_CASE` | `PANELS`, `DEFAULT_PERMS`, `BLOCKED_SCHEMES`, `FRONTMATTER_DELIMITER` | Constants, frozen objects, static config |
| `PascalCase` | `SkillRegistry`, `ScheduleQueue`, `InputPanel` | Classes, React components |
| kebab-case | `pathResolver.js`, `urlFilter.js` | File names |

- **Private fields** use the `#` prefix — no additional prefix (e.g. `#skills` not `#_skills`).
- **Variables that are intentionally unused** in function parameters (e.g., context not needed by a sub-handler) are prefixed with `_` (e.g., `_ctx`, `_scheduler`).

---

## Imports

Order groups from top to bottom:

1. **Node built-ins** (alphabetically sorted)
2. **External packages** (alphabetically sorted)
3. **Local/relative imports** (alphabetically sorted)

```javascript
// 1. Node built-ins
import { join } from "node:path";

// 2. External packages
import { z } from "zod";

// 3. Local relative imports
import { ConfigSchema } from "./schemas.js";
import { loadConfig } from "../config/loader.js";
```

**No wildcard re-exports** (`export * from '...'`). Always use explicit named re-exports.

**Dynamic `await import()`** is used for non-core dependencies (e.g., `js-yaml`, `@opentelemetry/sdk-node`) at the top level of the entry point.

---

## Exports

- **Named exports exclusively**. No `export default` except for React components in `src/tui/app.js`.
- **Barrel `index.js` files** use explicit named re-exports:

  ```javascript
  export { updateIndex, searchIndex, listContextFiles } from "./index.js";
  ```

- **No barrel files for single-file modules**. If a module (e.g., `config/`) only has `loader.js` and `schemas.js`, they import directly — there is no redundant `index.js`.

---

## Classes

- Use `#` private fields and methods for all internal state.

  ```javascript
  export class ScheduleManager {
      #scheduleEntry = new Map();
      #queue;
      #tickId = null;

      constructor(maxConcurrent = 1) {
          this.#queue = new ScheduleQueue(maxConcurrent);
      }

      #clockTick(_scheduler) {
          // ...
      }
  }
  ```

- **No inheritance hierarchies**. All classes are concrete; extend with composition.
- **Constructor-only side effects**. Register commands, initialize data structures, etc. in the constructor. Do not perform network or file I/O in constructors.

---

## Functions

- Always use `async/await`. No `.then()` chaining and no raw `Promise` chains unless wrapping event-based APIs (e.g., child process spawning).
- **Function declaration** form (`function foo() {}`) for both exported and internal functions.
- **Default parameters** for all optional arguments: `(directory = "memory/", limit = 10)`.
- **Destructured parameters** with defaults:

  ```javascript
  function handleTimeout(options = { seconds: 30, gracePeriod: 5 }) {
  ```

- **One responsibility per function**. If a function exceeds ~20 lines or more than 3 levels of nesting, extract a helper.
- **Prefer `const`** at the top level for all bindings. Never `let` at top level.

---

## Error Handling

- Define domain-specific error classes extending `Error` with a custom `name`:

  ```javascript
  const err = new Error("Access denied: path is outside sandbox scope");
  err.name = "AccessDeniedError";
  throw err;
  ```

- Soft-check functions return a result object instead of throwing:

  ```javascript
  // resolvePath returns { allowed: boolean, path?: string }
  // assertPathAllowed wraps resolvePath and throws
  ```

- **Batch failures** collect errors into an array:

  ```javascript
  const errors = [];
  for (const skill of skills) {
      const result = safeParse(skill);
      if (!result.success) errors.push({ name, ...result.error });
  }
  return { errors };
  ```

- **Silent `catch` blocks** are only allowed for defensive file-system operations and MUST include a comment explaining why:

  ```javascript
  } catch {
      // Directory doesn't exist — skip silently
  }
  ```

- **Never swallow exceptions in async boundaries**. Always log or re-throw.

---

## Async Code

- **Use `async/await`** everywhere. Never mix blocking (sync) I/O in async contexts.
- **Wrap event-based APIs** (e.g., `child_process`, timers) in `Promise` if you need to `await` completion:

  ```javascript
  await new Promise((resolve) => {
      child.on("exit", resolve);
  });
  ```

- **No `Promise.race` with timeouts** — use individual `setTimeout` wrappers per module.
- **No blocking I/O** (`readFileSync`, `readdirSync`) inside `async` functions.

---

## Type Safety

There is no TypeScript. Type safety is achieved through:

1. **Zod schemas** for config and skill input validation.
2. **JSDoc `@type`** annotations on exported values.
3. **Null/undefined checks** at call boundaries.

```javascript
// Null-ish check (covers null AND undefined)
if (value == null) return defaultValue;

// Deep comparison for objects
if (metadata && typeof metadata === "object") { ... }
```

---

## Documentation

- **Every public function and class** MUST have a JSDoc comment with `@param` and `@returns`.

  ```javascript
  /**
   * Write a memory file with YAML frontmatter.
   * @param {string} directory - The memory directory to write to
   * @param {string} title - A short title for the entry
   * @param {Object} frontmatter - YAML frontmatter metadata
   * @param {string} body - The markdown body content
   * @returns {string} The path of the created file
   */
  ```

- **Private/internal functions** may have minimal JSDoc (just description, no parameters).
- **Constants** (frozen objects, enums) need no JSDoc if the name is self-explanatory.
- **Complex logic blocks** need inline comments. Don't force JSDoc on private helpers.

---

## Files and Directory Structure

```
src/
├── <module>/            # Single-word lowercase
│   ├── index.js         # Barrel re-export (if >1 submodule exports)
│   ├── loader.js
│   └── schemas.js
tests/
├── unit/                # Mirrors src/ exactly
│   └── module.test.js
└── integration/
    └── full-flow.test.js
```

- **One concept per file**. A file that exports more than two public symbols likely should be split.
- **Barrel `index.js`** re-exports from siblings. It does NOT contain logic — only re-exports.
- **No nested modules**. Do not create `src/module/sub/` — keep everything one level deep.

---

## Testing

- Use **built-in `node:test`**: `import { describe, it } from "node:test";`
- Use **Node's built-in `assert`**: `import assert from "node:assert";`
- **File naming**: mirror source with `.test.js`: `src/memory/writer.js` → `tests/unit/memory.test.js`.
- **Structure**: `describe("module - feature")` → `describe("function")` → `it("behavior")`.
- **No external mocking libraries**. Tests inline-replicate internal logic when the functions are unexported or module-scoped.
- **Assertions**: use `assert.strictEqual`, `assert.deepStrictEqual`, `assert.ok`, `assert.throws`.
- **Each test is self-contained** — no `before`/`after` hooks needed.
- **100% coverage enforced**. Every new line added must be covered.

---

## Git Workflow

- **Branch naming**: `feat/<short-desc>` or `fix/<short-desc>`. Never commit to `main`.
- **Commit messages**: follow [Conventional Commits](https://www.conventionalcommits.org/):

  ```
  feat: add file upload endpoint with whitelist validation
  fix: correct JWT audience claim validation
  test: add unit tests for context window enforcement
  docs: update code style guide
  ```

- **Pre-commit hook** runs (in order):
  1. `oxfmt` — format all changed files (line-length 100)
  2. `oxlint` — lint check
  3. `tsc --noEmit` — type check
  4. `npm run test` — run tests
  5. `npm run coverage` — generate `coverage.txt` (100% enforced)

- **If `coverage.txt` changes** during commit, the commit fails. Fix with:
  ```bash
  git add -A && git commit --amend -C HEAD
  ```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why |
|---|---|
| `export * from '...'` | Obscures the public API surface |
| `console.log()` in production | Use `console.error()` for errors, structured logging where available |
| Silent `catch {}` with no comment | Makes debugging nearly impossible |
| `eval()`, `new Function()` | Security risk — reject input with validation instead |
| Mutating a list while iterating | Use `Array.from()` copy or iterate indices |
| Blocking I/O in `async` functions | Blocks the event loop; use `fs.promises` instead |
| `handleShutdown` catching error but referencing wrong variable | Always match catch parameter name (`err`, not `_err`) |
