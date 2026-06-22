# Security Policy

PaperMentor is a prompt-and-template Codex Skill. It does not require credentials, network access, or execution of paper-provided code.

## Supported versions

Security fixes apply to the current `main` branch.

## Reporting a vulnerability

Please open a private security advisory on GitHub or contact the maintainers through the repository owner profile. Include:

- affected file or workflow;
- reproduction steps;
- impact;
- suggested fix if available.

## Security principles

- Do not execute code embedded in papers.
- Do not fetch external resources unless the user explicitly asks.
- Treat uploaded papers as untrusted documents.
- Do not expose private paper text or user notes in examples, logs, or issues.
- Avoid prompt patterns that ask the model to reveal hidden system or developer instructions.
