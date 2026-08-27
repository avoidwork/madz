## ADDED Requirements

### Requirement: Merge PDFs
The system SHALL merge multiple PDF files into a single PDF file using pdf-lib.

#### Scenario: Merge two PDFs by file path
- **WHEN** the user provides two or more PDF file paths and an output path
- **THEN** the system creates a single PDF containing all pages from the input PDFs in order

#### Scenario: Merge PDFs from base64 content
- **WHEN** the user provides two or more base64-encoded PDF strings and an output path
- **THEN** the system decodes the base64 content, merges the PDFs, and writes the result to the output path

#### Scenario: Merge PDFs returning base64 output
- **WHEN** the user provides PDF file paths or base64 content and requests base64 output
- **THEN** the system returns the merged PDF as a base64-encoded string

### Requirement: Split PDFs
The system SHALL split a PDF file into multiple PDFs by page range or individual pages using pdf-lib.

#### Scenario: Split PDF by page range
- **WHEN** the user provides a PDF file path, a page range (e.g., "1-3"), and an output path
- **THEN** the system extracts the specified pages and creates a new PDF file

#### Scenario: Split PDF by individual pages
- **WHEN** the user provides a PDF file path and an output path pattern
- **THEN** the system creates one PDF file per page in the source document

#### Scenario: Split PDF returning base64 output
- **WHEN** the user provides a PDF and requests base64 output with page indices
- **THEN** the system returns an array of base64-encoded PDFs, one per requested page or range

### Requirement: Add Watermark
The system SHALL add a text or image watermark to one or all pages of a PDF using pdf-lib.

#### Scenario: Add text watermark to all pages
- **WHEN** the user provides a PDF, a watermark text string, and positioning options (opacity, rotation, position)
- **THEN** the system overlays the text watermark on every page with the specified opacity and rotation

#### Scenario: Add text watermark to specific pages
- **WHEN** the user provides a PDF, a watermark text string, and a page list
- **THEN** the system overlays the text watermark only on the specified pages

#### Scenario: Add image watermark
- **WHEN** the user provides a PDF, an image file path or base64 content, and positioning options
- **THEN** the system embeds the image as a watermark on the specified pages

### Requirement: Embed Signature
The system SHALL embed a signature (image or text) into a PDF at a specified location using pdf-lib.

#### Scenario: Embed image signature
- **WHEN** the user provides a PDF, a signature image (path or base64), and page/position coordinates
- **THEN** the system embeds the signature image at the specified location on the PDF

#### Scenario: Embed text signature
- **WHEN** the user provides a PDF, a text signature string, font options, and page/position coordinates
- **THEN** the system renders the text signature at the specified location on the PDF

### Requirement: Add Annotations
The system SHALL add annotations (highlights, notes, stamps) to specific pages and locations in a PDF using pdf-lib.

#### Scenario: Add text note annotation
- **WHEN** the user provides a PDF, a note text, and page/position coordinates
- **THEN** the system adds a sticky-note annotation at the specified location

#### Scenario: Add highlight annotation
- **WHEN** the user provides a PDF, a page number, and a rectangular region
- **THEN** the system adds a highlight annotation over the specified region

#### Scenario: Add multiple annotations
- **WHEN** the user provides a PDF and an array of annotation definitions (type, content, position, page)
- **THEN** the system adds all annotations to the PDF and returns the modified file

### Requirement: Input/Output Format
The system SHALL accept file paths or base64-encoded content as input for all PDF manipulation operations.

#### Scenario: Accept file path input
- **WHEN** the user provides a file path to a PDF
- **THEN** the system reads the file and processes it

#### Scenario: Accept base64 input
- **WHEN** the user provides a base64-encoded PDF string
- **THEN** the system decodes the base64 string and processes the PDF

#### Scenario: Return file path output
- **WHEN** the user specifies an output file path
- **THEN** the system writes the result to the specified file

#### Scenario: Return base64 output
- **WHEN** the user requests base64 output
- **THEN** the system encodes the result as a base64 string and returns it

### Requirement: File Size Limits
The system SHALL enforce a configurable maximum file size (default 50MB) for all PDF manipulation operations to prevent memory exhaustion.

#### Scenario: Reject PDF exceeding max file size
- **WHEN** the user provides a PDF that exceeds the configured maximum file size (default 50MB)
- **THEN** the system returns an error indicating the file exceeds the maximum allowed size

#### Scenario: Process PDF within max file size
- **WHEN** the user provides a PDF that is within the configured maximum file size
- **THEN** the system processes the PDF normally

#### Scenario: Use custom max file size
- **WHEN** the user specifies a custom max file size limit
- **THEN** the system uses the custom limit instead of the default 50MB