## 1. Setup

- [ ] 1.1 Add pdf-lib and puppeteer dependencies to package.json
- [ ] 1.2 Run npm install to install new dependencies
- [ ] 1.3 Create src/tools/pdf.js module structure with imports and exports

## 2. Core Tool Implementation

- [ ] 2.1 Define zod input schemas for all PDF operations (generate, merge, split, watermark, signature, annotate)
- [ ] 2.2 Implement generatePdfFromHtml function using puppeteer
- [ ] 2.3 Implement generatePdfFromMarkdown function (markdown → HTML → PDF via puppeteer)
- [ ] 2.4 Implement mergePdfs function using pdf-lib
- [ ] 2.5 Implement splitPdf function using pdf-lib
- [ ] 2.6 Implement addWatermark function using pdf-lib (text and image support)
- [ ] 2.7 Implement embedSignature function using pdf-lib (image and text support)
- [ ] 2.8 Implement addAnnotations function using pdf-lib (notes, highlights, stamps)
- [ ] 2.9 Implement helper functions for input/output (file path ↔ base64 conversion)
- [ ] 2.10 Implement error handling with domain-specific error classes

## 3. Tool Registration

- [ ] 3.1 Register the pdf tool in src/tools/index.js with appropriate permissions
- [ ] 3.2 Define permission tiers (filesystem:read, filesystem:write, process:spawn)
- [ ] 3.3 Add JSDoc comments to all public functions with @param and @returns

## 4. Testing

- [ ] 4.1 Create tests/unit/tools_pdf.test.js with unit tests for all PDF operations
- [ ] 4.2 Test generatePdfFromHtml with sample HTML content
- [ ] 4.3 Test generatePdfFromMarkdown with sample markdown content
- [ ] 4.4 Test mergePdfs with sample PDF files
- [ ] 4.5 Test splitPdf with sample PDF files
- [ ] 4.6 Test addWatermark with text and image watermarks
- [ ] 4.7 Test embedSignature with image and text signatures
- [ ] 4.8 Test addAnnotations with notes and highlights
- [ ] 4.9 Test base64 input/output for all operations
- [ ] 4.10 Test error handling for invalid inputs and corrupted files

## 5. Verification

- [ ] 5.1 Run npm run test to verify all tests pass
- [ ] 5.2 Run npm run lint to verify code passes oxlint
- [ ] 5.3 Run npm run coverage to verify coverage is maintained
- [ ] 5.4 Run timeout 10 npm start to verify application starts without crashing

## 6. Documentation

- [ ] 6.1 Update README.md or tool documentation with PDF tool usage examples
- [ ] 6.2 Document base64 vs file path input/output modes
- [ ] 6.3 Note puppeteer Chromium dependency and fallback options