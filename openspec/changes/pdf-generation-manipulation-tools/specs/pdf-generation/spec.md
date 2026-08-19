## ADDED Requirements

### Requirement: Generate PDF from HTML
The system SHALL generate a PDF file from an HTML string input, supporting custom page options (size, margin, orientation).

#### Scenario: Generate PDF from HTML string
- **WHEN** the user provides an HTML string and an output file path
- **THEN** the system generates a valid PDF file at the specified path using headless Chromium rendering

#### Scenario: Generate PDF from HTML with custom page options
- **WHEN** the user provides an HTML string, output path, and page options (format, margin, orientation)
- **THEN** the system generates a PDF with the specified page configuration

#### Scenario: Generate PDF from HTML with headers and footers
- **WHEN** the user provides an HTML string, output path, and header/footer templates
- **THEN** the system generates a PDF with the specified headers and footers on each page

### Requirement: Puppeteer Fallback
The system SHALL support a PUPPETEER_SKIP_CHROMIUM_DOWNLOAD environment variable that allows puppeteer to use a system-installed Chromium instead of the bundled one.

#### Scenario: Use system Chromium when bundled download is skipped
- **WHEN** the PUPPETEER_SKIP_CHROMIUM_DOWNLOAD environment variable is set and no bundled Chromium is available
- **THEN** puppeteer uses the system-installed Chromium for PDF generation

#### Scenario: Fail gracefully when no Chromium is available
- **WHEN** the PUPPETEER_SKIP_CHROMIUM_DOWNLOAD environment variable is set and no Chromium (bundled or system) is available
- **THEN** the system returns a clear error message indicating that Chromium is required for PDF generation

### Requirement: Generate PDF from Markdown
The system SHALL generate a PDF file from a markdown string input by first rendering it to HTML, then converting to PDF.

#### Scenario: Generate PDF from Markdown string
- **WHEN** the user provides a markdown string and an output file path
- **THEN** the system renders the markdown to HTML and generates a valid PDF file at the specified path

#### Scenario: Generate PDF from Markdown with custom styles
- **WHEN** the user provides a markdown string, output path, and custom CSS styles
- **THEN** the system applies the CSS styles during markdown-to-HTML rendering and generates the PDF

### Requirement: Merge PDFs
The system SHALL merge multiple PDF files into a single PDF file.

#### Scenario: Merge two PDFs
- **WHEN** the user provides two or more PDF file paths and an output path
- **THEN** the system creates a single PDF containing all pages from the input PDFs in order

#### Scenario: Merge PDFs from base64 content
- **WHEN** the user provides two or more base64-encoded PDF strings and an output path
- **THEN** the system decodes the base64 content, merges the PDFs, and writes the result to the output path

#### Scenario: Merge PDFs returning base64 output
- **WHEN** the user provides PDF file paths or base64 content and requests base64 output
- **THEN** the system returns the merged PDF as a base64-encoded string

### Requirement: Split PDFs
The system SHALL split a PDF file into multiple PDFs by page range or individual pages.

#### Scenario: Split PDF by page range
- **WHEN** the user provides a PDF file path, a page range (e.g., "1-3"), and an output path pattern
- **THEN** the system extracts the specified pages and creates a new PDF file

#### Scenario: Split PDF by individual pages
- **WHEN** the user provides a PDF file path and an output path pattern
- **THEN** the system creates one PDF file per page in the source document

#### Scenario: Split PDF returning base64 output
- **WHEN** the user provides a PDF and requests base64 output with page indices
- **THEN** the system returns an array of base64-encoded PDFs, one per requested page or range

### Requirement: Add Watermark
The system SHALL add a text or image watermark to one or all pages of a PDF.

#### Scenario: Add text watermark to all pages
- **WHEN** the user provides a PDF, a watermark text string, and positioning options
- **THEN** the system overlays the text watermark on every page with the specified opacity and rotation

#### Scenario: Add text watermark to specific pages
- **WHEN** the user provides a PDF, a watermark text string, and a page list
- **THEN** the system overlays the text watermark only on the specified pages

#### Scenario: Add image watermark
- **WHEN** the user provides a PDF, an image file path or base64 content, and positioning options
- **THEN** the system embeds the image as a watermark on the specified pages

### Requirement: Embed Signature
The system SHALL embed a signature (image or text) into a PDF at a specified location.

#### Scenario: Embed image signature
- **WHEN** the user provides a PDF, a signature image (path or base64), and page/position coordinates
- **THEN** the system embeds the signature image at the specified location on the PDF

#### Scenario: Embed text signature
- **WHEN** the user provides a PDF, a text signature string, font options, and page/position coordinates
- **THEN** the system renders the text signature at the specified location on the PDF

### Requirement: Add Annotations
The system SHALL add annotations (highlights, notes, stamps) to specific pages and locations in a PDF.

#### Scenario: Add text note annotation
- **WHEN** the user provides a PDF, a note text, and page/position coordinates
- **THEN** the system adds a sticky-note annotation at the specified location

#### Scenario: Add highlight annotation
- **WHEN** the user provides a PDF, a page number, and a rectangular region
- **THEN** the system adds a highlight annotation over the specified region

#### Scenario: Add multiple annotations
- **WHEN** the user provides a PDF and an array of annotation definitions (type, content, position, page)
- **THEN** the system adds all annotations to the PDF and returns the modified file