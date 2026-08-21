# pptx-creation Specification

## Purpose
Generate `.pptx` presentation files from structured content with slide layouts, formatting, images, and charts.

## Requirements

### Requirement: Slide creation with layouts
The system SHALL create .pptx files with slides supporting multiple layouts: title, content, two-column, comparison, quote, and image-only.

#### Scenario: Create a title slide
- **WHEN** a slide with layout "title" is provided with a title and optional subtitle
- **THEN** the system generates a .pptx file with a centered title slide

#### Scenario: Create a content slide
- **WHEN** a slide with layout "content" is provided with a title and bullet points
- **THEN** the system generates a .pptx file with a title and formatted bullet list

#### Scenario: Create a two-column slide
- **WHEN** a slide with layout "two-column" is provided with left and right content
- **THEN** the system generates a .pptx file with two side-by-side content blocks

#### Scenario: Create a comparison slide
- **WHEN** a slide with layout "comparison" is provided with two columns of content
- **THEN** the system generates a .pptx file with a comparison layout (e.g., pros/cons)

#### Scenario: Create a quote slide
- **WHEN** a slide with layout "quote" is provided with quote text and optional attribution
- **THEN** the system generates a .pptx file with centered quote formatting

#### Scenario: Create an image-only slide
- **WHEN** a slide with layout "image-only" is provided with an image path
- **THEN** the system generates a .pptx file with the image filling the slide

### Requirement: Font styling and formatting
The system SHALL support font styling including font family, size, color, bold, italic, and alignment.

#### Scenario: Apply custom font styling
- **WHEN** font options (family, size, color, bold, italic) are specified
- **THEN** the system applies those styles to the slide text

#### Scenario: Apply text alignment
- **WHEN** alignment (left, center, right) is specified
- **THEN** the system aligns the text accordingly

### Requirement: Image embedding with validation
The system SHALL embed images from file paths with MIME whitelist validation.

#### Scenario: Embed a valid PNG image
- **WHEN** a valid PNG image path is provided
- **THEN** the system embeds the image in the slide

#### Scenario: Reject invalid image format
- **WHEN** a file with an unsupported MIME type is provided as an image
- **THEN** the system rejects the image and logs a validation error

#### Scenario: Handle missing image file
- **WHEN** an image path does not exist on disk
- **THEN** the system skips the image and logs a warning

### Requirement: Chart generation
The system SHALL generate basic charts (bar, line, pie) from structured data.

#### Scenario: Create a bar chart
- **WHEN** chart type "bar" and data array are provided
- **THEN** the system generates a bar chart in the slide

#### Scenario: Create a line chart
- **WHEN** chart type "line" and data array are provided
- **THEN** the system generates a line chart in the slide

#### Scenario: Create a pie chart
- **WHEN** chart type "pie" and data array are provided
- **THEN** the system generates a pie chart in the slide

### Requirement: Template support
The system SHALL support cloning an existing PPTX template as the base for new content.

#### Scenario: Clone template master slides
- **WHEN** a templatePath is provided
- **THEN** the system uses the template's master slides as the base layout

#### Scenario: Validate template file
- **WHEN** a templatePath is provided that is not a valid PPTX
- **THEN** the system rejects the template and logs a validation error

### Requirement: Output file generation
The system SHALL write the generated .pptx file to the specified output path.

#### Scenario: Write to valid output path
- **WHEN** a valid output path within the allowed write directory is provided
- **THEN** the system writes the .pptx file and returns the file path

#### Scenario: Reject output path outside allowed directory
- **WHEN** an output path outside the allowed write directory is provided
- **THEN** the system rejects the path and logs a security error