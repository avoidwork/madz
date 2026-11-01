# Spec Delta

## Purpose

Guarantees that the npm cache directory in the built container image is owned by the
non-root `madz` user, so the `madz` user can read and write the cache without `EACCES`,
and that the build fails loudly if that ownership invariant is ever violated.

## ADDED Requirements

### Requirement: npm cache directory is owned by the madz user
The Dockerfile runtime stage SHALL ensure the npm cache directory (`/home/madz/.npm`) is
owned by `madz:node` after all global npm installs complete, so the `madz` user can read
and write the cache without `EACCES`.

#### Scenario: Global npm installs do not leave the cache root-owned
- **WHEN** the runtime stage runs `npm install -g` commands (e.g. `yarn`, `pnpm`,
  `@fission-ai/openspec`) as root
- **THEN** the npm cache directory `/home/madz/.npm` is owned by `madz:node` in the
  resulting image

#### Scenario: madz user can use the cache
- **WHEN** the `madz` user runs an npm command that reads or writes the cache
- **THEN** the command does not fail with `EACCES` on `/home/madz/.npm`

### Requirement: npm cache path is pinned
The Dockerfile runtime stage SHALL pin the npm cache location via
`ENV NPM_CONFIG_CACHE=/home/madz/.npm` so the cache path is explicit and stable rather
than implicitly derived from `HOME`.

#### Scenario: Cache path is explicit
- **WHEN** the runtime stage is built
- **THEN** `NPM_CONFIG_CACHE` is set to `/home/madz/.npm`

### Requirement: Build fails if the cache is not owned by madz
The Dockerfile runtime stage SHALL include a build-time assertion that fails the build if
the npm cache directory is not owned by `madz`, so the ownership regression cannot ship.

#### Scenario: Assertion passes when ownership is correct
- **WHEN** the runtime stage is built and `/home/madz/.npm` is owned by `madz`
- **THEN** the build-time assertion passes and the build succeeds

#### Scenario: Assertion fails when ownership is wrong
- **WHEN** the runtime stage is built and `/home/madz/.npm` is not owned by `madz`
- **THEN** the build-time assertion fails and the build is aborted
