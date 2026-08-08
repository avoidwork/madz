## Root Cause

The table rendering pipeline in `src/tui/markdownText.js` uses a custom delimiter format to mark cell boundaries:

1. `tablecell()` (line 428-431) produces: `<content>^*||*^` — note **two pipes** between the asterisks
2. `tablerow()` (line 424-426) wraps: `*|*|*|<cell_content>*|*|*|\n`
3. `generateTableRow()` (line 188-199) processes the wrapped content:
   - Strips `*|*|*|` prefix/suffix via `replace(/\*[|]+/g, "")`
   - Splits cells via `split(/\^[*]+\|[*^]/)` — this regex matches `^*|*^` (**one pipe**)

The split regex does not match the actual delimiter `^*||*^` (two pipes), so `split()` returns the entire string as a single element. All table columns collapse into one.

## Fix

Change the regex in `generateTableRow()` from:
```js
/\^[*]+\|[*^]/
```
to:
```js
/\^[*]+\|[|]+[*^]/
```

This matches one or more pipes between the asterisks, correctly handling the `^*||*^` delimiter produced by `tablecell()`.

## Verification

- The `replace(/\*[|]+/g, "")` prefix/suffix stripping already works correctly (it uses `[|]+` to match one or more pipes)
- The fix is a single-character regex change: `\|` → `\|[|]+`
- No other code paths are affected
