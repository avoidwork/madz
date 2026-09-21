## ADDED Requirements

### Requirement: terraform must be installed in the container image

The Dockerfile SHALL include `terraform` in the runtime stage, ensuring the terraform CLI binary is present in every built container image. The binary SHALL be downloaded from HashiCorp releases for the target architecture (amd64 or arm64).

#### Scenario: terraform is installed in the Dockerfile runtime stage
- **WHEN** the Dockerfile runtime stage is parsed
- **THEN** a `RUN` block downloads and installs terraform into `/usr/local/bin`

#### Scenario: terraform is available in the container
- **WHEN** the container is built and started
- **THEN** `terraform version` executes successfully without "command not found"

#### Scenario: terraform supports the target architecture
- **WHEN** the container is built for amd64 or arm64
- **THEN** the correct architecture binary is downloaded and installed

### Requirement: tflint must be installed in the container image

The Dockerfile SHALL include `tflint` in the runtime stage, ensuring the tflint CLI binary is present in every built container image. The binary SHALL be downloaded from GitHub releases for the target architecture (amd64 or arm64).

#### Scenario: tflint is installed in the Dockerfile runtime stage
- **WHEN** the Dockerfile runtime stage is parsed
- **THEN** a `RUN` block downloads and installs tflint into `/usr/local/bin`

#### Scenario: tflint is available in the container
- **WHEN** the container is built and started
- **THEN** `tflint --version` executes successfully without "command not found"

#### Scenario: tflint supports the target architecture
- **WHEN** the container is built for amd64 or arm64
- **THEN** the correct architecture binary is downloaded and installed

### Requirement: Architecture resolution for terraform and tflint

The Dockerfile SHALL resolve the target architecture using the `TARGETARCH` build argument when set (multiarch buildx builds), falling back to `uname -m` for plain `docker build`. Unsupported architectures SHALL cause the build to fail rather than installing a wrong-architecture binary.

#### Scenario: Multiarch build resolves architecture from TARGETARCH
- **WHEN** the image is built with buildx for `linux/amd64` or `linux/arm64`
- **THEN** `TARGETARCH` is used to select the correct terraform and tflint binary

#### Scenario: Plain docker build resolves architecture from uname
- **WHEN** the image is built with `docker build` (no TARGETARCH set)
- **THEN** `uname -m` is used to select the correct terraform and tflint binary

#### Scenario: Unsupported architecture fails the build
- **WHEN** the image is built for an architecture other than amd64 or arm64
- **THEN** the build fails with an error rather than installing a wrong-architecture binary
