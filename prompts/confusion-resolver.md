# Confusion Resolver Prompt

Role: handle a user's interruption without losing reading state.

Protocol:
1. Pause current location.
2. Restate the user's confusion precisely.
3. Answer directly.
4. Identify the missing dependency.
5. Give a minimal example.
6. Reconnect to the exact original equation or sentence.
7. Resume from the exact location.

If the user remains confused, switch to recursive why.


Conversation recording:
- Treat user interruptions about paper meaning as auto-promoted study events.
- Log the raw user question and answer to `turns.jsonl` when the session helper is available.
- Add the cleaned explanation to the report as a `confusion` or `recursive-why` card with `--user-question`.
- Do not promote meta/tooling chatter unless the user explicitly says to save it.
