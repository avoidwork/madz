## 1. Implement the Dockerfile symlink

- [x] 1.1 Locate the runtime stage (the second `FROM node:26-slim` block) in the Dockerfile
- [x] 1.2 Add `RUN ln -s /tmp /large_tool_results` after the permissions block (`RUN chown -R madz:node /app /home/madz`)

## 2. Verify the change

- [x] 2.1 Confirm the symlink line is present in the Dockerfile runtime stage after the permissions block
- [x] 2.2 Run `npm run docker:build` to confirm the image builds cleanly
- [x] 2.3 Verify the symlink resolves to `/tmp` (`readlink /large_tool_results`) and writes land in `/tmp`
