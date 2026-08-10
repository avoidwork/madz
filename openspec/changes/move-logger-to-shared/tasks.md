## 1. Move logger to shared directory

- [x] 1.1 Create `src/shared/` directory
- [x] 1.2 Move `src/logger.js` → `src/shared/logger.js`

## 2. Update all import paths

- [x] 2.1 Find all files importing from logger.js (grep for logger imports)
- [x] 2.2 Update import paths in each file to reference `src/shared/logger.js`
- [x] 2.3 Update any relative import paths (e.g., `../src/logger.js`) to correct relative paths

## 3. Verify correctness

- [x] 3.1 Confirm no files reference the old `src/logger.js` path
- [x] 3.2 Run `npm run test` to verify all tests pass
- [x] 3.3 Run `npm start` with timeout to verify application starts
