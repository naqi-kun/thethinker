---
name: handoff
description: Write a handoff document that summarizes the current Claude Code session so another agent or teammate can continue the work without losing context. Use when a conversation gets long, when switching machines, or when passing work to a teammate (Naqi, Nabihah, Ilman, Aizat, Cyril).
---

# Handoff

Long sessions lose context, and teammates can't read your chat history. This skill writes a compact
handoff document so the next person — or the next agent session — can continue cleanly.

## When to use

- The current conversation is getting long and you want a fresh session.
- You're stopping for the day and someone else may pick up the task.
- You're moving work between machines or between teammates.

## Steps

1. **Ask what the next session is for** (if not already told). The handoff should be tailored to the
   next goal, not a generic dump.

2. **Write the handoff** to `docs/handoffs/<branch-or-task>.md` (create the folder if needed). Use the
   branch name or task ID, e.g. `docs/handoffs/KAN-21-setup-ai-workflow.md`, so it's easy to find.

3. **Use this structure:**

   ```markdown
   # Handoff — <task / KAN ticket>

   ## Goal
   What we're trying to achieve, in one or two sentences.

   ## Done so far
   - Bullet list of what's already completed (reference files/commits, don't re-paste them).

   ## Current state
   - Branch: <branch name>
   - What works, what's half-done, what's untested.

   ## Next steps
   1. The very next thing to do.
   2. Then this.

   ## Suggested skills
   Which of our skills the next agent should use (e.g. `pre-mr-check` before the MR,
   `check-ddd-boundaries` after backend edits).

   ## Watch out for
   Gotchas, decisions made, things that look wrong but aren't.
   ```

4. **Reference, don't duplicate.** Link to files by path (e.g. `backend/internal/domain/wardrobe/`)
   and to the OpenAPI spec instead of pasting large blocks.

5. **Redact secrets.** Never put API keys, passwords, JWT secrets, DB credentials, or personal data in
   the handoff. Reference `.env` keys by name only.

## Notes

- If the handoff is just for your own next session and not for the team, you can write it to your OS
  temp directory instead of `docs/handoffs/` to avoid committing throwaway notes.
- Keep it short. A handoff longer than a screen or two has failed at its job.
