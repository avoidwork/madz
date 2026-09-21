## Why

The madz container is a complete development environment for an orchestrator/coding agent. It already ships polyglot toolchains (Go, Rust, Java, Python) and infrastructure CLIs (vault, gh). Terraform and tflint are missing, so the agent cannot plan, apply, or lint infrastructure-as-code within the container. Adding them closes that gap.

## What Changes

- Add `terraform` (v1.16.3) to the Dockerfile runtime stage as a prebuilt binary.
- Add `tflint` (v0.64.0) to the Dockerfile runtime stage as a prebuilt binary.
- Both are downloaded from their official release sources (HashiCorp releases and GitHub releases) rather than Debian repos, which do not ship them.
- Architecture resolution uses `TARGETARCH` (set by buildx for multiarch builds) with a `uname -m` fallback for plain `docker build`, so amd64 and arm64 both work.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dockerfile-dependencies`: Adds two new requirements — terraform and tflint must be installed in the container image, with architecture-aware download.

## Impact

- `Dockerfile` — runtime stage gains a new `RUN` block that downloads and installs terraform and tflint.
- No application code, dependencies, or runtime behavior changes.
- Image size increases by roughly 70 MB (two binaries) across both architectures.

## Non-goals

- Not adding terraform provider plugins or a tfstate backend.
- Not adding other HashiCorp tools (e.g., packer, nomad, consul).
- Not changing the multiarch build pipeline itself — it already supports amd64 and arm64.
