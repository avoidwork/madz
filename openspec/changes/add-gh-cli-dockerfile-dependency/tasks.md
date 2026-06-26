## 1. Add gh CLI to Dockerfile

- [ ] 1.1 Add `gh` to the `apk add --no-cache` line in the Dockerfile runtime stage (line 22), in alphabetical order between `git` and `file`
- [ ] 1.2 Verify the Dockerfile syntax is valid after the change
- [ ] 1.3 Build the Docker image and verify `gh --version` works inside the container