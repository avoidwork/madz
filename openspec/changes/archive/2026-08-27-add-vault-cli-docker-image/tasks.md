## 1. Dockerfile Modification

- [x] 1.1 Add `vault` to the `apk add --no-cache` line in the Dockerfile runtime stage (line 20), placing it alphabetically among the existing packages

## 2. Verification

- [x] 2.1 Verify the Dockerfile syntax is valid (no trailing whitespace, proper line continuation)
- [x] 2.2 Confirm `vault` appears in the package list by reading the modified Dockerfile line
