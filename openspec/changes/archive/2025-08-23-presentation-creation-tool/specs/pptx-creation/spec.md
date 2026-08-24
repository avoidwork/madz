## ADDED Requirements

### Requirement: Create presentation from structured content
The system SHALL create a PowerPoint presentation (.pptx) from structured input containing slides with titles, content, and formatting.

#### Scenario: Create presentation with title slide
- **WHEN** a presentation input with a title slide is provided
- **THEN** the system generates a .pptx file with a title slide containing the specified title and subtitle

#### Scenario: Create presentation with content slide
- **WHEN** a presentation input with a content slide is provided
- **THEN** the system generates a .pptx file with a content slide containing bullet points

#### Scenario: Create presentation with multiple slides
- **WHEN** a presentation input with multiple slides is provided
- **THEN** the system generates a .pptx file with all specified slides in order

#### Scenario: Create presentation with empty slides array
- **WHEN** a presentation input with an empty slides array is provided
- **THEN** the system generates a .pptx file with one default blank slide

### Requirement: Support slide layouts
The system SHALL support the following slide layouts: title, content, two-column, comparison, quote, and image-only.

#### Scenario: Create slide with title layout
- **WHEN** a slide with layout "title" is provided
- **THEN** the system creates a slide with a large title area and optional subtitle

#### Scenario: Create slide with content layout
- **WHEN** a slide with layout "content" is provided
- **THEN** the system creates a slide with a title and bullet point content area

#### Scenario: Create slide with two-column layout
- **WHEN** a slide with layout "two-column" is provided
- **THEN** the system creates a slide with two side-by-side content columns

#### Scenario: Create slide with comparison layout
- **WHEN** a slide with layout "comparison" is provided
- **THEN** the system creates a slide with two columns for comparing items

#### Scenario: Create slide with quote layout
- **WHEN** a slide with layout "quote" is provided
- **THEN** the system creates a slide with centered quote text and optional attribution

#### Scenario: Create slide with image-only layout
- **WHEN** a slide with layout "image-only" is provided
- **THEN** the system creates a slide with a full-slide image

#### Scenario: Create slide with unknown layout
- **WHEN** a slide with an unknown layout name is provided
- **THEN** the system defaults to the "content" layout

### Requirement: Apply text formatting
The system SHALL apply text formatting including font family, font size, font color, bold, italic, and alignment.

#### Scenario: Apply bold formatting
- **WHEN** a text element with bold=true is provided
- **THEN** the system renders the text in bold

#### Scenario: Apply italic formatting
- **WHEN** a text element with italic=true is provided
- **THEN** the system renders the text in italic

#### Scenario: Apply custom font color
- **WHEN** a text element with a hex color code is provided
- **THEN** the system renders the text in the specified color

#### Scenario: Apply custom font size
- **WHEN** a text element with a font size is provided
- **THEN** the system renders the text at the specified size

#### Scenario: Apply text alignment
- **WHEN** a text element with an alignment is provided
- **THEN** the system aligns the text as specified (left, center, right)

#### Scenario: Apply custom font family
- **WHEN** a text element with a font family is provided
- **THEN** the system renders the text using the specified font

### Requirement: Embed images in slides
The system SHALL embed images from file paths into slides with MIME validation.

#### Scenario: Embed PNG image
- **WHEN** a slide with a valid PNG image path is provided
- **THEN** the system embeds the image on the slide

#### Scenario: Embed JPEG image
- **WHEN** a slide with a valid JPEG image path is provided
- **THEN** the system embeds the image on the slide

#### Scenario: Reject unsupported image format
- **WHEN** a slide with an unsupported image file extension is provided
- **THEN** the system throws an error listing supported formats

#### Scenario: Reject non-image file with valid extension
- **WHEN** a slide with a file that has a valid image extension but invalid content is provided
- **THEN** the system throws an error indicating the file is not a valid image

#### Scenario: Embed image with custom position
- **WHEN** a slide with an image and custom x/y position is provided
- **THEN** the system places the image at the specified position

#### Scenario: Embed image with custom dimensions
- **WHEN** a slide with an image and custom width/height is provided
- **THEN** the system resizes the image to the specified dimensions

### Requirement: Render tables on slides
The system SHALL render tabular data on slides.

#### Scenario: Render simple table
- **WHEN** a slide with a table is provided
- **THEN** the system renders the table with rows and columns

#### Scenario: Render table with header row
- **WHEN** a slide with a table that has a header row is provided
- **THEN** the system renders the header row with bold formatting

#### Scenario: Render empty table
- **WHEN** a slide with an empty table is provided
- **THEN** the system renders an empty table structure

### Requirement: Load presentation from template
The system SHALL load an existing .pptx file as a template and apply new content to it.

#### Scenario: Load template and add slides
- **WHEN** a template path and new content are provided
- **THEN** the system loads the template and appends new slides

#### Scenario: Load invalid template file
- **WHEN** a template path pointing to a non-.pptx file is provided
- **THEN** the system throws an error indicating the file is not a valid PPTX

#### Scenario: Load template from outside write directory
- **WHEN** a template path outside the allowed write directory is provided
- **THEN** the system throws an error indicating the path is not allowed

### Requirement: Validate output path
The system SHALL validate that the output path is within the allowed write directory.

#### Scenario: Valid output path
- **WHEN** an output path within the allowed directory is provided
- **THEN** the system proceeds with file creation

#### Scenario: Output path outside write directory
- **WHEN** an output path outside the allowed directory is provided
- **THEN** the system throws an error indicating the path is not allowed

#### Scenario: Output path with directory traversal
- **WHEN** an output path containing "../" is provided
- **THEN** the system throws an error indicating the path is not allowed

### Requirement: Generate valid PPTX file
The system SHALL generate a valid .pptx file that can be opened by standard presentation software.

#### Scenario: Generate valid PPTX file
- **WHEN** a valid presentation input is provided
- **THEN** the system generates a .pptx file that is a valid ZIP archive with correct PPTX structure

#### Scenario: Generated file has correct extension
- **WHEN** a presentation is generated with a .pptx extension
- **THEN** the generated file has the .pptx extension

### Requirement: Handle text overflow
The system SHALL handle text that exceeds slide boundaries by shrinking text to fit.

#### Scenario: Shrink text to fit slide
- **WHEN** a text element exceeds the available slide space
- **THEN** the system shrinks the font size to fit the text within the slide boundaries

#### Scenario: Default font fallback
- **WHEN** a specified font family is not available in pptxgenjs
- **THEN** the system falls back to a default font (Arial)
