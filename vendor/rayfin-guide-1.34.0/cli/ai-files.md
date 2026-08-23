---
sidebar_position: 5
---

# Agent files (`rayfin init ai-files`)

A "Rayfin agent file" is a piece of context that AI coding agents — Copilot CLI, GitHub Copilot in VS Code, Claude Code, Cursor, Gemini CLI, Codex, and friends — read on every task to know how to work with your project.

The Rayfin CLI installs three of them in your project and keeps them in sync as the platform evolves:

| File | Purpose | Who reads it |
| --- | --- | --- |
| `AGENTS.md` | Universal cross-agent instructions for your project. Plain English; lives at the project root. | Almost every modern coding agent. |
| `.mcp.json` | Wires up the Rayfin MCP doc-lookup server so the agent can search Rayfin docs at task time. The CLI manages just the `mcpServers.rayfin` key — your other servers are preserved. | GitHub Copilot, VS Code Copilot, Claude Code, Cursor (some flavors). |
| `.agents/skills/rayfin/SKILL.md` | A "Skill" that names Rayfin-specific rules and anti-patterns (decorators, permission rules, MSSQL constraints, deployment flow). | GitHub Copilot CLI, VS Code Copilot, Codex. |

If you are new to coding agents, the short version is: **these three files together teach any agent how to work in a Rayfin project.** You drop them in once, they update with `rayfin-cli`, and you stop having to paste the same Rayfin context into chat over and over.

## Quick start

When you scaffold a project with `npm create @microsoft/rayfin@latest` or `rayfin init`, the CLI installs the agent files automatically as part of the post-scaffold pipeline. You usually do not need to run anything by hand.

To install them in an existing project (or refresh them after upgrading the CLI):

```bash
npx rayfin init ai-files install
```

You will get an interactive checkbox picker the first time. Pass `--non-interactive` (or `--yes`) to accept defaults, or `--enable`/`--disable` to script it.

To see what is installed and whether anything has drifted:

```bash
npx rayfin init ai-files status
```

To preview what `install` would do without touching disk:

```bash
npx rayfin init ai-files install -n --json
```

## What about my other agent config?

The CLI is a careful neighbor:

- `.mcp.json` is merged at the key level. Your other `mcpServers.<name>` entries are preserved on every install.
- `AGENTS.md` is **one-time install**. If you (or your template) already wrote one, the CLI never overwrites it — even with `--force`. Add Rayfin-specific rules to it freely.
- `.agents/skills/rayfin/SKILL.md` carries a `rayfin-managed: true` frontmatter sigil. If you remove that sigil, the CLI stops managing the file. That is the documented opt-out gesture for skills you want to fully customize.

If you have hand-edited a managed file and do not want to lose your changes, the CLI flags it as `user-modified` and preserves your version with a warning. Choose either path:

```bash
# Keep your version, stop managing this item
npx rayfin init ai-files install --disable skill:rayfin

# Throw away your edits, accept the bundled version
npx rayfin init ai-files install --force

# Reset just one item (overwrite mcp; keep your edits to skill)
npx rayfin init ai-files install --force mcp:rayfin
```

## Command reference

### `rayfin init ai-files install`

Installs or refreshes the Rayfin agent files. **Idempotent** — re-running auto-reconciles the project to the bundled content for your current CLI version. Re-running on an up-to-date project is a no-op (no disk writes).

| Flag | Behavior |
| --- | --- |
| `--enable <id>` (repeatable) | Install/keep a specific item by its namespaced id (e.g. `--enable skill:rayfin`). Unknown ids are rejected with a clear error. |
| `--disable <id>` (repeatable) | Stop managing a specific item — record the choice but do not delete the on-disk file. Also accepts orphan ids (items the lockfile remembers but the current CLI no longer ships). |
| `--remove-files` | Modifier for `--disable`. Also removes the on-disk file. Cannot be passed alone. |
| `--force [ids...]` | Overwrite items that have been hand-edited (`user-modified`), restore items that were deleted (`missing`), or rebuild after a malformed `.mcp.json`. Pass with no args to apply to every managed item. Pass one or more namespaced ids (e.g. `--force mcp:rayfin`) to scope force to those items only — others use default behavior. **Never** overwrites `AGENTS.md`. |
| `--json` | Emit a `{status, schemaVersion, dryRun, report}` envelope to stdout instead of human progress lines. Implies non-interactive. |
| `-n, --dry-run` | Classify what install would do and emit the report — no disk writes. Pairs with `--json` for previewability in scripts. |
| `-y, --yes` / `--non-interactive` | Skip the interactive prompt and accept defaults. |

#### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success, no warnings |
| `1` | Hard error (invalid args, unknown id, malformed lockfile, write failure that was not isolated) |
| `3` | Success, but warnings present (`user-modified` items preserved, `unreadable` sibling files, etc.). Distinct from `1` so agent consumers can tell "you should look at this" from "the command failed." |

### `rayfin init ai-files status`

Prints one line per managed item with its current state. Pass `--json` for `{status, schemaVersion, items: ItemStatus[]}` on stdout.

States:

| State | Meaning |
| --- | --- |
| `up-to-date` | On disk; sha matches lockfile and bundled content. Nothing to do. |
| `update-available` | On disk; sha matches lockfile but the CLI now ships different bundled content. Run `install` to refresh. |
| `user-modified` | On disk but the file hash does not match what the CLI last wrote. The CLI assumes you edited it intentionally. `install --force <id>` overwrites just that item; `install --disable <id>` keeps your version and stops managing. |
| `missing` | The CLI installed it once, but the file is gone now. `install --force <id>` re-installs just that item. |
| `not-installed` | The CLI knows about this item but it is not installed in the project yet. Plain `install` installs it. |
| `disabled` | You opted out of managing this item (either via `install --disable <id>` or by removing the `rayfin-managed: true` sigil from a skill frontmatter). `install --enable <id>` re-enables. |
| `orphaned` | The lockfile remembers an item the current CLI no longer ships. `install` cleans it up if it has not been touched, or warns if you have edited it. |
| `unreadable` | The on-disk file exists but is malformed (e.g. invalid JSON in `.mcp.json`). Repair it by hand, or `install --force <id>` to rebuild just that item. |

## How conflicts are resolved

The CLI tracks what it wrote in a project-tracked lockfile at `rayfin/.lockfile.json` so re-runs know what they last installed and don't re-do work. Commit the lockfile so your team shares the same baseline.

When you re-run `install`, the CLI compares the on-disk content against what it last wrote and against the bundled content for your current CLI version. That gives one of the eight states above. The conflict policy is:

| State | Default | With `--force` |
| --- | --- | --- |
| `not-installed` | install | install |
| `up-to-date` | no-op | no-op |
| `update-available` | rewrite | rewrite |
| `user-modified` | warn, preserve user content | overwrite with bundled |
| `missing` | warn | re-install |
| `disabled` (lockfile flag) | skip | skip — `--force` alone will not re-enable; pass `--enable <id>` |
| `disabled` (sigil-removed skill) | skip | skip — pass `--enable <id> --force` to re-stamp the sigil |
| `unreadable` | warn | overwrite (rebuilds from scratch) |
| `orphaned` (clean) | delete (lockfile + disk) | delete |
| `orphaned` (dirty) | warn, preserve | delete |
| `orphaned` + `--disable <id>` | mark disabled, preserve file (does NOT enter cleanup) | mark disabled, preserve file |

`--force` accepts an optional list of ids: `install --force mcp:rayfin` overwrites only `mcp:rayfin` and leaves the other items on default behavior. Useful when you want to refresh one file without losing intentional edits to others.

When `install` warns about a `user-modified`, `missing`, or `unreadable` item, the warning recommends the per-item form (e.g. `rayfin init ai-files install --force skill:rayfin`). Following the warning's instruction will only touch that one item — unrelated user-modified items in the same project are not affected.

## Drift nudge in `rayfin up`

On every `rayfin up` startup, the CLI prints a one-line nudge if any managed item is out of date, modified, missing, unreadable, or newly-shipped. Refresh with `rayfin init ai-files install`. Upgrading `@microsoft/rayfin-cli` to a version that ships identical content does not produce a nudge — the check is content-based, not version-based.

## Scripting and CI

For agent or CI consumers, the structured `--json` output and exit code 3 (warning-only success) are first-class:

```bash
# Check if anything would change without writing
npx rayfin init ai-files install -n --json

# Idempotent install in CI; warnings exit 3, hard errors exit 1
npx rayfin init ai-files install --yes --json

# Inspect current state without writes
npx rayfin init ai-files status --json
```
