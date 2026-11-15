# api-tool Specification

## Purpose
Defines the behavior of the `api` REST client tool, including its input schema, URL filtering, redirect re-validation, rate limiting, retries, credential handling, and the `download` (stream-to-disk) and `file` (multipart upload) modes.

## Requirements

### Requirement: api tool validates input against a strict Zod schema
The `api` tool SHALL validate its input against a strict Zod schema before making any request, rejecting unknown fields and invalid values with a structured `{ ok: false, error }` result.

#### Scenario: api tool rejects unknown fields
- **WHEN** `api` is called with an input containing a field not in the schema (e.g., `auth`)
- **THEN** the tool returns `{ ok: false, error: <validation message> }` and does not make a request

#### Scenario: api tool rejects invalid URL and method
- **WHEN** `api` is called with an invalid URL or an unsupported method
- **THEN** the tool returns `{ ok: false, error: <validation message> }`

### Requirement: api tool accepts download and file path fields
The `api` tool schema SHALL accept optional `download` and `file` string fields, each holding a file path.

#### Scenario: api tool accepts a download path
- **WHEN** `api` is called with `{ url, download: "/tmp/out.bin" }`
- **THEN** the schema accepts the input and the tool proceeds to stream the response to that path

#### Scenario: api tool accepts a file path
- **WHEN** `api` is called with `{ url, method: "POST", file: "/tmp/in.bin" }`
- **THEN** the schema accepts the input and the tool sends the file as multipart/form-data

### Requirement: api tool streams a download to disk
When `download` is set, the `api` tool SHALL stream the response body to the resolved destination path instead of buffering it in-memory, and SHALL return a structured result including the saved path and status.

#### Scenario: api tool writes the response body to the download path
- **WHEN** `api` is called with `{ url, download: "/tmp/out.bin" }` and the server returns a body
- **THEN** the tool writes the response body to `/tmp/out.bin` and returns `{ ok: true, path: "/tmp/out.bin", status: <status>, ... }`

#### Scenario: api tool bypasses maxBodySize for download
- **WHEN** `api` is called with `{ url, download: "/tmp/out.bin" }` and the response exceeds the configured `maxBodySize`
- **THEN** the tool still streams the body to disk without returning a "too large" error

### Requirement: api tool validates the download destination path against the sandbox allowlist
The `api` tool SHALL validate the `download` destination path against the sandbox allowlist before writing, and SHALL return a structured `{ ok: false, error }` if the path is outside the sandbox scope.

#### Scenario: api tool rejects a download path outside the sandbox
- **WHEN** `api` is called with `{ url, download: "/etc/passwd" }` and `/etc` is not in the sandbox allowlist
- **THEN** the tool returns `{ ok: false, error: <access denied message> }` and does not write the file

### Requirement: api tool sends a local file as multipart/form-data
When `file` is set, the `api` tool SHALL read the local file and send it as a `multipart/form-data` request body, setting the `Content-Type` boundary.

#### Scenario: api tool sends the file as multipart/form-data
- **WHEN** `api` is called with `{ url, method: "POST", file: "/tmp/in.bin" }`
- **THEN** the tool sends a `multipart/form-data` body containing the file, with a `Content-Type` header that includes a boundary

### Requirement: api tool validates the file source path against the sandbox allowlist
The `api` tool SHALL validate the `file` source path against the sandbox allowlist before reading, and SHALL return a structured `{ ok: false, error }` if the path is outside the sandbox scope.

#### Scenario: api tool rejects a file path outside the sandbox
- **WHEN** `api` is called with `{ url, method: "POST", file: "/etc/passwd" }` and `/etc` is not in the sandbox allowlist
- **THEN** the tool returns `{ ok: false, error: <access denied message> }` and does not send the request

### Requirement: api tool enforces mutual exclusivity among body, form, and file
The `api` tool SHALL reject a request that provides more than one of `body`, `form`, or `file`, and SHALL reject a body-carrying mode on a bodyless method.

#### Scenario: api tool rejects body and file together
- **WHEN** `api` is called with `{ url, method: "POST", body: { a: 1 }, file: "/tmp/in.bin" }`
- **THEN** the tool returns `{ ok: false, error: <mutual exclusivity message> }`

#### Scenario: api tool rejects a file on a bodyless method
- **WHEN** `api` is called with `{ url, method: "GET", file: "/tmp/in.bin" }`
- **THEN** the tool returns `{ ok: false, error: <body not allowed message> }`

### Requirement: api tool respects timeout, allowlist, rate limit, redirects, retries, and credentials for download and file modes
The `download` and `file` modes SHALL respect the existing `timeout`, `allowlist`, `rateLimit`, `maxRedirects`, `maxRetries`, and `credential` handling already applied to normal requests.

#### Scenario: api tool applies the timeout to a download
- **WHEN** a `download` request stalls past the configured `timeout`
- **THEN** the tool aborts the stream and returns `{ ok: false, error: <timeout message> }`

#### Scenario: api tool re-validates redirect hops for a download
- **WHEN** a `download` request follows a redirect to a host not on the allowlist
- **THEN** the tool returns `{ ok: false, error: <allowlist message> }` and does not write the file
