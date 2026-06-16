# zoogame

## Workflow

After completing any task that modifies files, always commit the changes and push to origin before finishing.

After any implementation, check existing documentation for gaps or details that no longer reflect the current code, and update it as needed before finishing.

## Parallel Agents

When spawning multiple agents to work in parallel, always use `isolation: "worktree"` on each Agent call. This gives each agent its own checkout so they can edit files simultaneously without conflicts. Each agent works on its own branch; merge the branches when done.

If agents must touch overlapping files, partition work by directory upfront or run them sequentially instead. Agents that only read/explore code (no writes) can run in parallel without isolation.
