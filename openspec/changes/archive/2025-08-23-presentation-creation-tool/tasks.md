## 1. Setup

- [x] 1.1 Add pptxgenjs dependency to package.json
- [x] 1.2 Create src/tools/fileCreate/ directory structure
- [x] 1.3 Create PptxError class extending AppError

## 2. Zod Schema

- [x] 2.1 Define PptxInputSchema with zod v4 (outputPath, templatePath, slides array)
- [x] 2.2 Define SlideSchema with layout, title, content, images, tables
- [x] 2.3 Define ImageSchema with path, x, y, width, height
- [x] 2.4 Define TableSchema with rows, headers, styling
- [x] 2.5 Define TextStyleSchema with font, size, color, bold, italic, alignment

## 3. Core Implementation

- [x] 3.1 Implement validateImagePath helper (extension whitelist + magic bytes)
- [x] 3.2 Implement validateOutputPath helper (write directory check + traversal prevention)
- [x] 3.3 Implement validateTemplatePath helper (validates PPTX structure)
- [x] 3.4 Implement createTextRun helper for pptxgenjs text runs
- [x] 3.5 Implement createSlide helper that maps slide schema to pptxgenjs slide
- [x] 3.6 Implement createPptx main function (creates presentation, adds slides, saves)
- [x] 3.7 Implement template loading via pptxgenjs API
- [x] 3.8 Implement text overflow handling (shrink-to-fit)
- [x] 3.9 Implement font fallback (Arial default)

## 4. Tool Registration

- [x] 4.1 Register createPptx tool in src/tools/index.js with filesystem:write capability
- [x] 4.2 Export schema alongside implementation

## 5. Tests

- [x] 5.1 Create tests/unit/tools/pptx.test.js
- [x] 5.2 Test: create presentation with title slide
- [x] 5.3 Test: create presentation with content slide
- [x] 5.4 Test: create presentation with multiple slides
- [x] 5.5 Test: create presentation with empty slides array
- [x] 5.6 Test: all slide layouts (title, content, two-column, comparison, quote, image-only)
- [x] 5.7 Test: text formatting (bold, italic, color, size, alignment, font family)
- [x] 5.8 Test: embed PNG image
- [x] 5.9 Test: embed JPEG image
- [x] 5.10 Test: reject unsupported image format
- [x] 5.11 Test: reject non-image file with valid extension
- [x] 5.12 Test: render table with header row
- [x] 5.13 Test: load template and add slides
- [x] 5.14 Test: load invalid template file
- [x] 5.15 Test: validate output path (valid, outside directory, traversal)
- [x] 5.16 Test: generate valid PPTX file (ZIP structure validation)

## 6. Verification

- [x] 6.1 Run npm run test (1192/1192 passing)
- [x] 6.2 Run npm run lint (0 warnings, 0 errors)
- [x] 6.3 Run npm run coverage (maintained)
