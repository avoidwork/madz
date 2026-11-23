# Spec Delta

## Purpose

Defines how the madz CLI parses the message prompt from command-line arguments, so that both the `--message` flag form and the positional form are honored and the conversation receives the intended prompt.

## ADDED Requirements

### Requirement: CLI honors the --message flag
The CLI SHALL read the message prompt from the `--message` option when it is supplied, so that `node index.js --message "..."` processes the supplied message rather than falling back to the default greeting.

#### Scenario: Message supplied via --message flag
- **WHEN** the CLI is invoked with `--message "what is today's date?"`
- **THEN** the message passed to the conversation is `"what is today's date?"`

### Requirement: CLI honors positional message arguments
The CLI SHALL read the message prompt from positional arguments when no `--message` option is supplied, joining positional words into a single message.

#### Scenario: Message supplied as positional argument
- **WHEN** the CLI is invoked with `"what is today's date?"` as a positional argument
- **THEN** the message passed to the conversation is `"what is today's date?"`

### Requirement: CLI falls back to default greeting when no message supplied
The CLI SHALL treat the message as undefined when neither the `--message` option nor positional arguments are supplied, so the default greeting is used.

#### Scenario: No message supplied
- **WHEN** the CLI is invoked with no message argument
- **THEN** the parsed message is undefined and the default greeting is used
