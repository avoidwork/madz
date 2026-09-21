## Context

The madz container is a polyglot development environment. The runtime stage already installs a broad set of system packages plus infrastructure CLIs (vault, gh). Terraform and tflint are not available in Debian's repos, so they must be installed as prebuilt binaries. The image is built for both amd64 and arm64 via buildx (`docker:release:all`), and also via plain `docker build` (`docker:build`).

## Goals / Non-Goals

**Goals:**
- Install `terraform` and `tflint` in the runtime stage so the agent can plan/apply/lint IaC.
- Support both amd64 and arm64 architectures.
- Keep the install deterministic (pinned versions) and reproducible.

**Non-Goals:**
- No terraform provider plugins or tfstate backend.
- No other HashiCorp tools.
- No change to the multiarch build pipeline itself.

## Decisions

**Decision 1: Download prebuilt binaries instead of apt/package installs.**
Neither terraform nor tflint ships in Debian's repos. HashiCorp publishes terraform on `releases.hashicorp.com`; tflint publishes on GitHub releases. Both provide `linux_amd64` and `linux_arm64` zips. Downloading the exact arch zip and unzipping into `/usr/local/bin` is the standard approach and matches how vault was added previously.

**Decision 2: Resolve architecture via `TARGETARCH` with a `uname -m` fallback.**
Buildx sets `TARGETARCH` automatically per platform (`amd64`/`arm64`) for multiarch builds. Plain `docker build` does not set it, so the fallback `uname -m` maps `x86_64`→`amd64` and `aarch64`→`arm64`. A `case` statement normalizes both and rejects unsupported architectures rather than pulling the wrong binary.

**Decision 3: Pin exact versions.**
`TF_VER="1.16.3"` and `TFLINT_VER="0.64.0"` are pinned in the `RUN` block for reproducibility. This matches the project's pattern of pinning tool versions (e.g., vault was pinned).

**Decision 4: Install into `/usr/local/bin` and `chmod +x`.**
Both binaries land in `/usr/local/bin`, which is on `PATH` for the `madz` user. The zip extraction preserves the executable bit, but `chmod +x` is applied defensively.

## Risks / Trade-offs

- [Unsupported host architecture (e.g., 386, s390x)] → The `case` statement exits with an error rather than silently installing a wrong-arch binary. Only amd64/arm64 are supported, matching the multiarch build matrix.
- [Image size increase] → ~70 MB across both binaries. Acceptable for a dev container; no runtime dependency.
- [Version drift] → Versions are pinned, so the image is reproducible. Updating requires a deliberate change to the `RUN` block.
