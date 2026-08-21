## 1. Setup

- [ ] 1.1 Add pptxgenjs dependency to package.json
- [ ] 1.2 Create src/tools/fileCreate/ directory structure
- [ ] 1.3 Review existing fileExtract/pptx.js for patterns to mirror

## 2. Core Tool Implementation

- [ ] 2.1 Create zod input schema for pptx creation (title, slides array with layout/content/images/charts)
- [ ] 2.2 Implement slide creation with layout support (title, content, two-column, comparison, quote, image-only)
- [ ] 2.3 Implement font styling (family, size, color, bold, italic, alignment)
- [ ] 2.4 Implement image embedding with MIME whitelist validation
- [ ] 2.5 Implement basic chart generation (bar, line, pie)
- [ ] 2.6 Implement template cloning from existing PPTX files
- [ ] 2.7 Implement output path validation (security: allowed write directory check)

## 3. Tool Registration

- [ ] 3.1 Register pptx tool in src/tools/index.js with filesystem:write permission
- [ ] 3.2 Ensure tool follows existing factory pattern and permission model

## 4. Testing

- [ ] 4.1 Create tests/unit/tools/fileCreate_pptx.test.js
- [ ] 4.2 Test slide creation with various layouts
- [ ] 4.3 Test font styling and alignment
- [ ] 4.4 Test image embedding (valid PNG, JPEG, GIF, BMP, SVG)
- [ ] 4.5 Test image rejection (invalid MIME type)
- [ ] 4.6 Test chart generation (bar, line, pie)
- [ ] 4.7 Test template cloning
- [ ] 4.8 Test output path security validation
- [ ] 4.9 Test edge cases (empty content, missing image file, invalid template)

## 5. Verification

- [ ] 5.1 Run npm run test
- [ ] 5.2 Run npm run lint
- [ ] 5.3 Run npm run coverage
- [ ] 5.4 Verify application starts (npm start with timeout)