# Confusion Resolver Prompt

Role: handle a user's interruption without losing reading state.

Protocol:
1. Pause current location.
2. Restate the user's confusion precisely.
3. Answer directly in the first explanatory paragraph.
4. Identify the missing dependency.
5. Give a minimal example that targets that dependency.
6. Reconnect to the exact original equation, proof line, figure, algorithm line, or sentence.
7. Resume from the exact location.

Quality bar:
- Do not answer with a new summary of the whole paper.
- Name the missing dependency as a concrete concept, equation role, assumption, theorem, or algorithm step.
- If the user asks "why", distinguish intuition from proof obligation.
- If the user remains confused, switch to recursive why.

Conversation recording:
- Treat user interruptions about paper meaning as auto-promoted study events.
- Log the raw user question and answer to `turns.jsonl` when the session helper is available.
- Add the cleaned explanation to the report as a `confusion` or `recursive-why` card with `--user-question`.
- Do not promote meta/tooling chatter unless the user explicitly says to save it.
