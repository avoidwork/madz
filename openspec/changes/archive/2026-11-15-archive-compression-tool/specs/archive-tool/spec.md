# Spec Delta

## Purpose

Provides general-purpose archive operations — creating, extracting, and listing zip, tar, and gzip archives — with sandbox allowlist enforcement and path-traversal protection.

## ADDED Requirements

### Requirement: Archive creation
The system SHALL create a zip, tar, or gzip archive from a set of source paths, writing the result to a destination path within the sandbox allowlist.

#### Scenario: Create a zip archive
- **WHEN** a user requests to create a zip archive from source files to a destination path
- **THEN** the system produces a valid zip archive at the destination containing the source files

#### Scenario: Create a tar archive
- **WHEN** a user requests to create a tar archive from source files to a destination path
- **THEN** the system produces a valid tar archive at the destination containing the source files

#### Scenario: Create a gzip archive
- **WHEN** a user requests to create a gzip archive from a source file to a destination path
- **THEN** the system produces a valid gzip archive at the destination containing the source file

### Requirement: Archive extraction
The system SHALL extract a zip, tar, or gzip archive to a destination directory within the sandbox allowlist, protecting against path traversal.

#### Scenario: Extract a zip archive
- **WHEN** a user requests to extract a zip archive to a destination directory
- **THEN** the system writes the archive contents to the destination directory

#### Scenario: Extract a tar archive
- **WHEN** a user requests to extract a tar archive to a destination directory
- **THEN** the system writes the archive contents to the destination directory

#### Scenario: Extract a gzip archive
- **WHEN** a user requests to extract a gzip archive to a destination directory
- **THEN** the system writes the decompressed contents to the destination directory

#### Scenario: Path traversal is blocked
- **WHEN** an archive contains an entry that would escape the destination directory
- **THEN** the system rejects the entry and does not write outside the sandbox allowlist

### Requirement: Archive listing
The system SHALL list the entries contained in a zip, tar, or gzip archive.

#### Scenario: List a zip archive
- **WHEN** a user requests to list the entries of a zip archive
- **THEN** the system returns the names of the entries contained in the archive

#### Scenario: List a tar archive
- **WHEN** a user requests to list the entries of a tar archive
- **THEN** the system returns the names of the entries contained in the archive

#### Scenario: List a gzip archive
- **WHEN** a user requests to list the entries of a gzip archive
- **THEN** the system returns the name of the contained file

### Requirement: Input validation
The system SHALL validate all archive tool input against a Zod schema before processing, rejecting unsupported operations, formats, and invalid paths.

#### Scenario: Unsupported operation is rejected
- **WHEN** a user requests an operation other than create, extract, or list
- **THEN** the system returns an error indicating the operation is unsupported

#### Scenario: Unsupported format is rejected
- **WHEN** a user requests a format other than zip, tar, or gzip
- **THEN** the system returns an error indicating the format is unsupported

#### Scenario: Path outside allowlist is rejected
- **WHEN** a user provides a source or destination path outside the sandbox allowlist
- **THEN** the system returns an access-denied error
