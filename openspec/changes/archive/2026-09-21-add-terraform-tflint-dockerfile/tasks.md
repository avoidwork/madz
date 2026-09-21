## 1. Dockerfile Implementation

- [x] 1.1 Add `ARG TARGETARCH` to the runtime stage for architecture resolution
- [x] 1.2 Add a `RUN` block that downloads and installs terraform (pinned to 1.16.3) into `/usr/local/bin`
- [x] 1.3 Add a `RUN` block that downloads and installs tflint (pinned to 0.64.0) into `/usr/local/bin`
- [x] 1.4 Resolve architecture via `TARGETARCH` with a `uname -m` fallback, mapping `x86_64`→`amd64` and `aarch64`→`arm64`
- [x] 1.5 Fail the build on unsupported architectures rather than installing a wrong-arch binary

## 2. Verification

- [x] 2.1 Build the image on amd64 and verify `terraform version` returns v1.16.3
- [x] 2.2 Verify `tflint --version` returns 0.64.0 in the built image
- [x] 2.3 Build the image on arm64 via buildx and confirm `TARGETARCH` resolves to `arm64`
