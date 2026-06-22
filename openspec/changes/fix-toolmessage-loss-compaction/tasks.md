## 1. Fix message rebuild in callReactAgent

- [x] 1.1 Add case for m.role === "tool" in message rebuild logic (lines 190-197) to return new ToolMessage(m.content)

## 2. Fix message rebuild in callReactAgentStreaming

- [x] 2.1 Add case for m.role === "tool" in message rebuild logic (lines 494-501) to return new ToolMessage(m.content)

## 3. Write unit tests

- [x] 3.1 Write test verifying ToolMessage instances are preserved through compaction in callReactAgent
- [x] 3.2 Write test verifying ToolMessage instances are preserved through compaction in callReactAgentStreaming

## 4. Verify

- [x] 4.1 Run existing test suite to ensure no regressions
- [x] 4.2 Run lint to ensure code quality