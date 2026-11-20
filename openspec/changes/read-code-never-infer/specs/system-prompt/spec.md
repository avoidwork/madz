# Spec Delta

## ADDED Requirements

### Requirement: Read the code; never infer it directive
The `SYSTEM_PROMPT.md` SHALL include a directive requiring the model to open and read the actual source before making claims about code, config files, schemas, tools, or libraries, and SHALL carve code claims out of the "respond when you have the answer" and "state your assumptions" rules.

#### Scenario: Directive requires reading source before claims about code
- **WHEN** the model is about to state how code, a config file, a schema, a tool, or a library works, or that a file, function, or setting exists
- **THEN** the directive requires the model to open the actual source and read the relevant lines in this session, naming the file and line

#### Scenario: Directive forbids answering from derived sources
- **WHEN** the model is about to answer a question about code
- **THEN** the directive forbids answering from memory, names, error messages, generated schemas, the tool list, or documentation, stating that the schema visible is not the source that produced it

#### Scenario: Directive requires marking unverified statements
- **WHEN** the model cannot read the source for a claim about code
- **THEN** the directive requires the model to say so and mark the statement unverified

#### Scenario: Directive requires running a command before causal claims
- **WHEN** the model is about to call something the cause, fixed, or working
- **THEN** the directive requires the model to run a command or test that shows it, and to say what it checked and what it did not

#### Scenario: Rule 3.2 carve-out for code claims
- **WHEN** `SYSTEM_PROMPT.md` is loaded
- **THEN** rule 3.2 ("respond when you have the answer") states that it does not apply to claims about code, referencing the read-the-code directive

#### Scenario: Rule 4.3 carve-out for code claims
- **WHEN** `SYSTEM_PROMPT.md` is loaded
- **THEN** rule 4.3 ("state your assumptions") does not permit unverified assumptions about code
