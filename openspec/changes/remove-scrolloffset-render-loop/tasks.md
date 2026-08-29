# Tasks: Remove scrollOffset State to Eliminate Render Loop Flicker

## Task 1: Remove scrollOffset state

Remove the React state variable that tracks scroll position and feeds the render loop.

- [ ] Delete `const [scrollOffset, setScrollOffset] = useState(0)` from MessageList component (line ~54)

## Task 2: Update scrollBy imperative API

Change `scrollBy(delta)` to use the ref-based imperative API instead of state.

- [ ] Replace `setScrollOffset((prev) => Math.max(0, prev + delta))` with `scrollRef.current?.scrollBy?.(delta)` in the imperative API's `scrollBy` method (line ~259)

## Task 3: Remove handleScroll callback

Remove the `onScroll` handler that writes scroll position back to state, breaking the feedback loop.

- [ ] Delete the `handleScroll` function (lines ~404-412)

## Task 4: Clean ScrollView props

Remove the controlled props from the ScrollView component.

- [ ] Remove `scrollOffset` prop from `<ScrollView>` (line ~434)
- [ ] Remove `onScroll={handleScroll}` prop from `<ScrollView>` (line ~436)

## Task 5: Verify tests pass

- [ ] Run `npm run test` and confirm all tests pass
- [ ] Run `npm run coverage` and confirm coverage is maintained
