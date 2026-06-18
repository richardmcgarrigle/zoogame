# zoogame

## Workflow

After completing any task that modifies files, always commit the changes and push to origin before finishing.

Use trunk-based development: commit directly to `main` for small changes. For larger changes, create a short-lived feature branch, keep it in sync with `main`, and merge it via a pull request as soon as it is ready — typically within a day or two. Never let branches live long enough to diverge significantly from `main`.

After any implementation, check existing documentation for gaps or details that no longer reflect the current code, and update it as needed before finishing.

## Use Cases

`docs/USE_CASES.md` contains BDD-style use cases covering every observable behavior in the game. Keep it current:

- When adding a new mechanic, input method, UI element, or game object: add the corresponding scenarios.
- When changing the behavior of an existing mechanic (speed values, thresholds, timing, animation states, physics parameters, etc.): update the affected scenarios to match the new values/behavior.
- When removing a feature: delete its scenarios.
- When renaming a feature or control: update all scenario descriptions that reference it.

Update `docs/USE_CASES.md` in the same commit as the code change — never leave it out of sync.

## Testing

When adding new functionality, write tests that cover the new code. Maintain a minimum of 80% code coverage across the codebase. Run the test suite after making changes to confirm coverage does not drop below this threshold.

## Agents

Always use `isolation: "worktree"` when spawning agents.
