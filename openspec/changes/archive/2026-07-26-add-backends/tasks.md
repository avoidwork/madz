## 1. Create srcBackend module

- [x] 1.1 Create src/agent/backends/srcBackend.js with createSrcBackend function
- [x] 1.2 Use FilesystemBackend from "deepagents" with rootDir = join(cwd, "src/") and virtualMode: true
- [x] 1.3 Accept optional cwd parameter, default to process.cwd()

## 2. Create promptsBackend module

- [x] 2.1 Create src/agent/backends/promptsBackend.js with createPromptsBackend function
- [x] 2.2 Use FilesystemBackend from "deepagents" with rootDir = join(cwd, "prompts/") and virtualMode: true
- [x] 2.3 Accept optional cwd parameter, default to process.cwd()

## 3. Create tmpBackend module

- [x] 3.1 Create src/agent/backends/tmpBackend.js with createTmpBackend function
- [x] 3.2 Use FilesystemBackend from "deepagents" with rootDir = join(cwd, "tmp/") and virtualMode: true
- [x] 3.3 Accept optional cwd parameter, default to process.cwd()

## 4. Create workspaceBackend module

- [x] 4.1 Create src/agent/backends/workspaceBackend.js with createWorkspaceBackend function
- [x] 4.2 Use FilesystemBackend from "deepagents" with rootDir = join(cwd, "workspace/") and virtualMode: true
- [x] 4.3 Accept optional cwd parameter, default to process.cwd()

## 5. Wire backends into deepAgents.js

- [x] 5.1 Import createSrcBackend, createPromptsBackend, createTmpBackend, createWorkspaceBackend from backends/*.js
- [x] 5.2 Create backend instances: srcBackend, promptsBackend, tmpBackend, workspaceBackend
- [x] 5.3 Add routes to CompositeBackend: "/src", "/prompts", "/tmp", "/workspace"
- [x] 5.4 Preserve existing coreBackend and contextBackend routes

## 6. Verify

- [x] 6.1 Run `npm run test` to confirm all tests pass
- [x] 6.2 Run `npm run lint` to confirm no lint errors
- [x] 6.3 Verify backend files export creates functions
- [x] 6.4 Verify CompositeBackend includes all backends
