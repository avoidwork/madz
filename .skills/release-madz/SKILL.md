---
name: release-madz
description: Builds and pushes all Docker images for the madz project by running npm run docker:release:all. Runs the build as a background process with a 30-minute timeout. Reports completion status to the user. NOT retryable — Docker image tags are immutable, so a failed run cannot be re-run against the same version.
license: BSD 3-Clause
compatibility: Requires Node.js 24+, npm, Docker CLI, and git with remote access. Must be run from the project root directory.
metadata:
  agent: coding
---

# Release Madz

> **⚠️ EXECUTION RULE:** Every code block in this skill is a shell command to **execute**. Do not print them as text, explain them, or treat them as examples — run them directly.

> **⚠️ CRITICAL: This skill is NOT retryable.**
> Docker image tags are immutable — once `1.23.0` is pushed, it cannot be overwritten.
> A second run with the same version will fail. You cannot re-run this skill to check
> status or retry a failed run. **The first execution is the only execution.**
>
> **If the build fails, you must NOT re-run this skill against the same tag.** Stop,
> report the failure, and let the user fix the underlying issue, bump the version,
> and run again. Re-running against the same tag will either fail (if the image
> partially pushed) or produce a misleading result. There is no safe way to retry.

Build and push all Docker images for the madz project. This is the final step — the moment of truth.

## 0. Pre-flight Check

Before doing anything, verify the Docker image has not already been pushed. Docker image tags are immutable — a second run with the same version will fail.

```bash
# Extract version reliably using node (avoids matching nested "version" keys)
TAG_VERSION=$(node -e "console.log(require('./package.json').version)")
DOCKER_USER=${DOCKER_USER:-avoidwork}

# Verify Docker is running
docker info >/dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "ERROR: Docker daemon is not running. Start Docker and try again."
  exit 1
fi

# Verify Docker registry authentication — check if config.json exists with auths
if [ ! -f "$HOME/.docker/config.json" ] || ! grep -q '"auths"' "$HOME/.docker/config.json" 2>/dev/null; then
  echo "WARNING: Docker registry authentication not confirmed. Run 'docker login' if push fails."
fi

# Check disk space (Docker builds need ~2GB free)
AVAILABLE_SPACE=$(df -P . | tail -1 | awk '{print $4}')
# Convert from 1K blocks to MB for comparison
AVAILABLE_SPACE_MB=$((AVAILABLE_SPACE / 1024))
if [ "$AVAILABLE_SPACE_MB" -lt 2048 ]; then
  echo "WARNING: Less than 2GB disk space available. Build may fail."
fi

# Check if the image already exists in the registry
# Note: docker manifest inspect requires registry access; may fail if registry is unreachable
if docker manifest inspect "${DOCKER_USER}/madz:${TAG_VERSION}" >/dev/null 2>&1; then
  echo "Image ${DOCKER_USER}/madz:${TAG_VERSION} already exists in registry. Stopping."
  echo "Docker image tags are immutable — bump the version and try again."
  exit 1
else
  echo "Image ${DOCKER_USER}/madz:${TAG_VERSION} not found in registry — proceeding."
fi

# Verify the npm script exists before running
if ! npm run --list 2>/dev/null | grep -q 'docker:release:all'; then
  echo "ERROR: npm script 'docker:release:all' not found in package.json."
  exit 1
fi
```

If the image already exists in the registry, **stop and report** — the release was already pushed. Do not proceed.

Also verify the git tag exists locally (for context, not as the primary check):

```bash
git tag -l "${TAG_VERSION}"
```

If the git tag is missing, warn the user but do not block — the tag may have been pushed separately.

## 1. Run the Build

Run `npm run docker:release:all` as a **background process**. The build takes several minutes and can exceed the default tool timeout, so it must be backgrounded. Use a **30-minute timeout** for the process.

```bash
npm run docker:release:all
```

Start it in the background (e.g., via the process tool with `background: true`), then wait on the process ID. Do not run it in the foreground — it will time out.

## 2. Wait for Completion

Wait for the background process to exit (up to the 30-minute timeout), then check the exit code:

- **exit code 0** — Success. All images built and pushed.
- **non-zero exit code** — Failure. Capture the last 10 lines of output for context.

**Note on retryability:** The warning at the top of this skill says the skill is "NOT retryable" — this means you cannot re-run this skill against the **same tag** (Docker image tags are immutable). If the build fails, you can report the failure and stop. The user must fix the underlying issue, bump the version, and run the skill again with the new version. This step is about **handling the failure of the current run**, not about retrying the same tag. **Do not re-run the build against the same version.**

## 3. Report

Print a final summary using actual variable values:

```
Release complete.
Status: SUCCESS / FAILED
Images built and pushed.
Version: $TAG_VERSION
Docker user: $DOCKER_USER
```

If the build fails, include the last 10 lines of output for context.

## Examples

```
User: release-madz

Agent: Pre-flight check...
  Version: 1.45.1
  Docker daemon: running
  Disk space: 15GB available
  Image exists: NOT_FOUND

Running build (background, 30-min timeout)...
  npm run docker:release:all
  [build output...]

Release complete.
Status: SUCCESS
Images built and pushed.
Version: 1.45.1
Docker user: avoidwork
```

## Gotchas

- **This skill is NOT retryable.** Docker image tags are immutable. Once `1.23.0` is pushed, it cannot be overwritten. A second run with the same version will fail. **If the build fails, do not re-run this skill against the same tag** — fix the underlying issue, bump the version, and run again. There is no safe retry.
- **Run the build in the background with a 30-minute timeout.** The build takes several minutes and will exceed the default tool timeout if run in the foreground. Start it as a background process and wait on the PID.
- **Always check disk space.** Docker builds need ~2GB free. If disk space is insufficient, the build will fail partway through.
- **Verify Docker is running.** The pre-flight check verifies the Docker daemon is accessible. If it's not, start Docker before proceeding.
- **Registry auth must be configured.** If `docker info` shows unclear login status, the push will fail. Run `docker login` first.

---
