## REMOVED Requirements

### Requirement: Vision Analyze Sends Image to Multimodal LLM
**Reason**: Tool `vision_analyze` is removed from the codebase.
**Migration**: N/A — tool no longer exists.

#### Scenario: Vision analyzes image from URL
- **WHEN** `vision_analyze` is called with `url: "https://example.com/chart.png"`
- **THEN** the tool fetches the image (respecting max 4MB size) and returns the LLM's description

#### Scenario: Vision analyzes image from data URI
- **WHEN** `vision_analyze` is called with `dataUri: "data:image/png;base64,..."` (valid base64)
- **THEN** the tool decodes the base64 and returns the LLM's description

#### Scenario: Vision rejects oversized image
- **WHEN** `vision_analyze` is called with a URL that fetches an image over 4MB
- **THEN** the tool returns an error without sending it to the model

### Requirement: Text to Speech Saves Audio File
**Reason**: Tool `text_to_speech` is removed from the codebase.
**Migration**: N/A — tool no longer exists.

#### Scenario: TTS generates speech and saves file
- **WHEN** `text_to_speech` is called with `text: "Hello world"` and `voice: "alloy"`
- **THEN** the tool saves a file to `~/voice-memos/[timestamp]_alloy.mp3` and returns `{ path: "MEDIA:~/voice-memos/..." }`

#### Scenario: TTS requires OPENAI_API_KEY
- **WHEN** `OPENAI_API_KEY` is not set
- **THEN** the tool is not registered in the tools array

### Requirement: Tier 2 Tools Require network:outbound Permission
**Reason**: After removing `vision_analyze`, `image_generate`, `text_to_speech`, and `mixture_of_agents`, the blanket permission requirement is no longer accurate. Remaining tier-2 tools (`web_search`, `web_extract`, `execute_code`, `cronjob`) have their own individual permission requirements documented in their own requirement blocks.
**Migration**: N/A — requirement removed in favor of per-tool permission requirements.

#### Scenario: Web tools register when network:outbound is enabled
- **WHEN** `sandbox.permissions` includes `network:outbound` and `EXA_API_KEY` is set
- **THEN** `web_search` and `web_extract` are registered

#### Scenario: Vision tool registers without network:outbound permission
- **WHEN** `sandbox.permissions` is empty
- **THEN** `vision_analyze` is still registered because it has no permission requirement
