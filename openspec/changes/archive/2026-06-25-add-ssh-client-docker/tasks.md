## 1. Add SSH Client to Dockerfile

- [ ] 1.1 Add `openssh-client` to the existing `apk add --no-cache` line in the Dockerfile, alongside `openssh-server`
- [ ] 1.2 Verify the Dockerfile syntax is correct (proper line continuation with `\`, no trailing spaces)

## 2. Verify Implementation

- [ ] 2.1 Build the Docker image and confirm `ssh`, `scp`, and `sftp` commands are available
- [ ] 2.2 Verify the Dockerfile change is a single-line diff