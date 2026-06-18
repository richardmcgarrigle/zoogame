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

## Refactoring

After committing a change, consider whether any refactoring opportunities are worth acting on. Look at the modified code and its related files:

- Does the change reveal duplication that a shared base class or mixin could eliminate?
- Would extracting a new class clarify responsibilities and make the code easier to extend (Single Responsibility, Open/Closed)?
- Do related classes now share enough behavior that an interface or abstract base makes sense (Liskov, Interface Segregation)?
- Are there dependencies that should be injected rather than hard-coded (Dependency Inversion)?
- Is any class or function now doing too much and ready to be split?

If a refactor is low-risk and self-contained, do it immediately in a follow-up commit. If it is larger, spawn a task chip so it is not forgotten. Never refactor and add features in the same commit.

## Agents

Always use `isolation: "worktree"` when spawning agents.
