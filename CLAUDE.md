# zoogame

## Workflow

After completing any task that modifies files, always commit the changes and push to origin before finishing.

After any implementation, check existing documentation for gaps or details that no longer reflect the current code, and update it as needed before finishing.

## Use Cases

`docs/USE_CASES.md` contains BDD-style use cases covering every observable behavior in the game. Keep it current:

- When adding a new mechanic, input method, UI element, or game object: add the corresponding scenarios.
- When changing the behavior of an existing mechanic (speed values, thresholds, timing, animation states, physics parameters, etc.): update the affected scenarios to match the new values/behavior.
- When removing a feature: delete its scenarios.
- When renaming a feature or control: update all scenario descriptions that reference it.

Update `docs/USE_CASES.md` in the same commit as the code change — never leave it out of sync.

## Agents

Always use `isolation: "worktree"` when spawning agents.
