## 1. Setup

- [ ] 1.1 Add pptxgenjs dependency to package.json
- [ ] 1.2 Create src/tools/fileCreate/ directory structure
- [ ] 1.3 Create PptxError class extending AppError

## 2. Zod Schema

- [ ] 2.1 Define PptxInputSchema with zod v4 (outputPath, templatePath, slides array)
- [ ] 2.2 Define SlideSchema with layout, title, content, images, tables
- [ ] 2.3 Define ImageSchema with path, x, y, width, height
- [ ] 2.4 Define TableSchema with rows, headers, styling
- [ ] 2.5 Define TextStyleSchema with font, size, color, bold, italic, alignment

## 3. Core Implementation

- [ ] 3.1 Implement validateImagePath helper (extension whitelist + magic bytes)
- [ ] 3.2 Implement validateOutputPath helper (write directory check + traversal prevention)
- [ ] 3.3 Implement validateTemplatePath helper (validates PPTX structure)
- [ ] 3.4 Implement createTextRun helper for pptxgenjs text runs
- [ ] 3.5 Implement createSlide helper that maps slide schema to pptxgenjs slide
- [ ] 3.6 Implement createPptx main function (creates presentation, adds slides, saves)
- [ ] 3.7 Implement template loading via pptxgenjs API
- [ ] 3.8 Implement text overflow handling (shrink-to-fit)
- [ ] 3.9 Implement font fallback (Arial default)

## 4. Tool Registration

- [ ] 4.1 Register createPptx tool in src/tools/index.js with filesystem:write capability
- [ ] 4.2 Export schema alongside implementation

## 5. Tests

- [ ] 5.1 Create tests/unit/tools/pptx.test.js
- [ ] 5.2 Test: create presentation with title slide
- [ ] 5.3 Test: create presentation with content slide
- [ ] 5.4 Test: create presentation with multiple slides
- [ ] 5.5 Test: create presentation with empty slides array
- [ ] 5.6 Test: all slide layouts (title, content, two-column, comparison, quote, image-only)
- [ ] 5.7 Test: text formatting (bold, italic, color, size, alignment, font family)
- [ ] 5.8 Test: embed PNG image
- [ ] 5.9 Test: embed JPEG image
- [ ] 5.10 Test: reject unsupported image format
- [ ] 5.11 Test: reject non-image file with valid extension
- [ ] 5.12 Test: render table with header row
- [ ] 5.13 Test: load template and add slides
- [ ] 5.14 Test: load invalid template file
- [ ] 5.15 Test: validate output path (valid, outside directory, traversal)
- [ ] 5.16 Test: generate valid PPTX file (ZIP structure validation)

## 6. Verification

- [ ] 6.1 Run npm run test
- [ ] 6.2 Run npm run lint
- [ ] 6.3 Run npm run coverage
