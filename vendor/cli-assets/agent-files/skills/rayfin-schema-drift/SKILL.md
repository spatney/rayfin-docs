---
name: rayfin-schema-drift
description: "Guide a Rayfin user from a blocked schema-drift apply to a verified recovery: locate and explain the actual drift CSV, propose table selections, preview exact entity edits, obtain approval, repair, and verify. Use for schema drift, 409 Conflict on db apply, Nothing was applied, Repairable, Needs manual attention, Skipped, drift CSV, row_id, repair --from, REPAIR_STALE, REPAIR_NOT_REPAIRABLE, REPAIR_DISABLED, REPAIR_NOT_SUPPORTED, REPAIR_NO_SELECTION, REPAIR_CODE_NOT_SAFE, REPAIR_TABLE_NOT_FOUND, SCHEMA_DISCOVERY_EMPTY, or questions about keeping or undoing database changes. Do not stop at a summary of the error."
metadata:
  author: microsoft
  version: "0.2.0"
---

# Rayfin Schema Drift

Help the user finish recovery, not merely understand the error. Translate the report into a concrete recommendation, show the actual CSV, preview the proposed edits, and guide each remaining step. Do the safe investigative work yourself; ask the user only for decisions, access you genuinely lack, and permission for changes.

## Start here: the first useful response

When an apply reports drift:

1. Read the actual output, including the error, table categories, CSV path and documentation link. Inspect the relevant entity files and existing source changes if tools are available.
2. Tell the user that the database differs from Rayfin's recorded schema and the blocked apply applied nothing. If the failure happened inside a full `rayfin up`, do not imply earlier deployment steps were rolled back.
3. Show **the actual drift CSV path**, preferably as a clickable local file link, and explain: "This is a table-by-table decision file. We can mark which repairable tables you want to keep." If no CSV was produced or you cannot access it, say that explicitly; never invent a path.
4. Group the tables into **can adopt**, **needs manual attention**, and **left alone**. Explain the reason and whether each group still blocks apply. Recommend specific tables to preview; do not offer only a generic "How would you like to proceed?"
5. If the user's intent to keep the changes is clear, prepare the selection and run a read-only preview. Otherwise ask one plain-language question: "Do you want to keep these database changes in your app, undo them, or decide table by table?" Use an ordinary chat message when question tools are unavailable or unreliable.

Example for a mixed report (substitute real paths, names and commands; never present these placeholders as discovered values):

> Nothing was applied to the database. The drift CSV is **`<actual CSV path>`**.
>
> - **Todos:** repair can adopt `due_ag1`, `estimate_ag1` and `priority_ag1` into the entity code.
> - **Notes:** `amount_ag1` has decimal precision 38, above Rayfin's limit of 28. That blocks repair of the whole table, including its other changes. We must decide how to preserve its data before proposing a database fix.
> - **Skipped objects:** `ref_ag1` and `audit_ag1` do not block apply and will be left unchanged.
>
> I recommend previewing Todos first. I can copy the CSV, mark only Todos as `repair`, and show you the exact proposed code edits without changing the entity or database. Notes will still need attention before apply can succeed. Shall I prepare that preview?

Always end a pause with the exact decision or action needed. After a command, report its outcome and continue with the next authorized step. If a tool fails or is cancelled, inspect what completed before retrying; never repeat a mutation blindly. Do not claim an operation ran when you only supplied its command.

## Show the CLI output alongside the guidance

For each apply, repair preview and repair, show the user all of the following in the chat response, not only in a tool pane or log file:

1. The exact command that actually ran, in a shell code block. Label suggested commands separately as not yet run.
2. The actual CLI output in a `text` code block, preserving wording, line breaks, tables, warnings and emojis. Remove ANSI control sequences and redact credentials, secrets and sensitive data; do not replace the output with a paraphrase or fabricate missing output.
3. The process exit code outside the output block. If unavailable, say so rather than infer it.
4. **Drift CSV:** the actual path printed by this run, as a clickable local link where supported. Keep it visible outside the output block too. If a decision copy was prepared, show **Original CSV** and **Decision CSV** separately. If no new CSV was generated, say so; never present an old file as this run's output.
5. A brief explanation of the result and the next authorized action or decision. The output supplements the guided workflow; it does not replace the recommendation, approval gate or follow-through.

Prefer the CLI's normal readable output for user-facing commands, with explicit table or CSV selection so repair does not require a picker. Use `--output json` when structured inspection is needed, and display that actual result too. Never rerun a mutating command just to get a prettier transcript. When stdout and stderr were captured separately, label them accurately instead of inventing their interleaving.

Show the full output when practical. For unusually long output, retain the full sanitized log locally, link it, and clearly mark any omitted lines in the displayed excerpt. Always include the error, drift table details, CSV location, proposed edits, left-alone tables and recovery hints when present. Do not claim a truncated tool result is the full output.

## Establish the target and preserve the user's work

- Use the project's installed CLI and existing authentication. Resolve the project root, configured data service and deployment from project files and the failed command. Ask only if the app, workspace, database or environment remains ambiguous. Do not ask an end user for internal rollout flags or a bug-bash setup.
- Prefer version-locked Rayfin MCP docs (`search_docs`, `get_doc`) or `rayfin docs` from the project. This skill must work without access to an internal RFC or source repository.
- Inspect `git status` and the entity diff before changes. Preserve unrelated edits and record the pre-repair state. If there is no source control, offer a local backup of the affected files before repair. Never commit, reset, check out entire files, or overwrite existing backups automatically.
- Diagnose from the supplied report first. `db apply` is **not** a read-only check: when drift is absent it can apply pending model changes. Before rerunning it for a report or CSV, inspect those changes and ensure that apply is authorized.
- Use `rayfin up db ...` for a deployed Fabric app, including when `rayfin dev` uses its default Fabric backend. Use `rayfin dev db ...` only for an already configured, supported local Docker backend. Do not switch the user to Docker, expose internal feature flags, or install another CLI version just to bypass a repair refusal.
- Never show tokens, cookies, connection strings, row data or secrets in chat or diagnostics. CSVs contain schema names and details: keep them local unless the user approves sharing a sanitized copy.

## Recovery workflow

### 1. Locate and explain the CSV

Use the exact path printed by the failed apply. Verify the file exists and belongs to this project and this run; filenames and timestamps alone are not proof. If the path is absent, inspect the supplied logs and matching files in `$RAYFIN_CONFIG_DIR/drift/` or `~/.rayfin/drift/`. Do not pick an unrelated newest file from another app.

If the file cannot be recovered, explain the two options:

- Preview known repairable tables directly with `--table`; a CSV is not required for this route.
- With authorization to rerun apply, use `rayfin up db apply --drift-file "<new path>"` to generate a fresh report when drift is still present. Choose a new filename; do not overwrite an existing decision file. No drift means no CSV is written.

The CSV has `table,category,detail,decision,row_id`. Show a small readable summary of the real rows and explain that selection is **per table, not per column**. One unadoptable change blocks that table's entire repair; other repairable tables can still be selected.

### 2. Prepare the user's decision

Offer all three routes, recommending the one that fits the user's stated intent:

| User intent                                 | Agent action                                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Keep all repairable changes                 | Name the included and excluded tables, then preview with `--all` or a selected CSV. Never imply `--all` fixes unadoptable tables.                                                                |
| Keep selected tables / review in a file     | Copy the actual CSV to a new local decision file, mark only approved repairable rows, then preview with `--from`. Offer to make the edits yourself; do not force the user to edit a spreadsheet. |
| Undo changes / preserve the previous schema | Identify the exact database changes and data at risk; follow the manual-recovery section. Repair adopts database changes; it is not an undo command.                                             |

For a small explicit selection, `--table Todos` is a convenient shortcut. Still show where the CSV is and explain how it can be used. If a user supplies a reviewed CSV, honor its selections; do not replace them with `--all`.

**CSV editing rules:**

- Work on a copy with a unique name. Show the original path and the decision-copy path.
- Set only `decision` to `repair` for approved `repairable` rows; leave other decisions empty. Do not mark unadoptable or skipped rows.
- Preserve the header, row count, row order and every other cell, including full `row_id` values. Never synthesize or shorten a real `row_id`.
- Use a CSV-aware editor/parser, never split lines on commas. Preserve quoting, embedded commas/newlines and encoding. After writing, reparse both files and verify only intended decision cells changed. If the edit cannot be verified, leave the original intact and use explicit `--table` selections instead.
- No rows selected means nothing to do. Explain that result; do not call it a successful repair.
- A CSV is tied to the schema state it describes. After any repair or database change, obtain a current report before preparing further selections. Do not keep retrying a stale copy.
- Automatic files retain the newest 20 per project. Explicit `--drift-file` paths are refused if they already exist unless `--overwrite` is requested; never overwrite a user's reviewed file without approval.

Example commands after filling in the real decision-copy path:

```sh
rayfin up db repair --from "<decision-copy.csv>" --dry-run --output json
rayfin up db repair --from "<decision-copy.csv>" --output json
```

Run the first command for preview. Run the second **only after approval of the preview**, not as an unattended two-command block.

### 3. Preview and obtain informed approval

Use the same selection for preview and repair: exactly one of `--all`, repeated `--table`, or `--from`. Add `--dry-run` to the preview; prefer readable output and add `--output json` only when structured inspection is needed. Display the actual preview output as well as the explanation below. Do not rely on the interactive picker in an agent, CI or redirected terminal.

Show the real preview in understandable terms:

- File and table affected, with the exact added, removed or changed declarations.
- Whether code will lose a field because the database column was already dropped.
- Which tables will remain blocked, and why.
- What will stay untouched: permissions, custom plurals, unrelated properties and user edits.

Explain that repair changes **entity source and Rayfin's schema record**, not the live SQL table. It does not restore lost data, generate new entities for unmanaged tables, or adopt constraint changes. Ask: "Apply these exact changes to `<files>` for `<tables>`?" If the user already explicitly approved these exact previewed edits, do not ask again.

If preview differs from the recommendation or reports unsafe code, stop and revise the plan. A successful preview is not a reservation: another session can change the schema before repair commits.

### 4. Repair and inspect the actual result

Run the approved command without `--dry-run`, keeping its selection and target unchanged. Capture the exit code and full result; record a returned schema version, but do not infer success from a version alone.

Compare the entity diff against the pre-repair state. Only approved changes should have appeared; preserve pre-existing changes. Check permissions, custom plural configuration and unrelated fields are intact. If something unexpected changed, stop before apply and show the difference.

For a partial failure, do not automatically undo files or rerun the whole CSV. Follow the error recovery section below. An error can occur **after** a file was written.

### 5. Resolve remaining blockers and verify

If unadoptable tables remain, show a short checklist and guide their manual recovery. Do not repeatedly run apply while the known blocker is unchanged. Skipped-only objects do not block apply; warn separately if they can affect runtime writes.

Once source edits are reviewed and the user authorizes apply, run the appropriate `db apply`. Never add `--force` or skip detection just to make it pass. If apply is newly blocked by a destructive model migration or another SQL error, explain that distinct failure rather than claiming repair failed.

Report completion with evidence:

- Tables adopted and files changed; manual fixes completed and skipped objects left alone.
- Decision-copy path, repair result and schema version if returned.
- Apply exit code and drift status from actual output (`driftCheckRan` when available).
- A no-write `repair --all --dry-run --output json` check when useful to confirm `no_drift`.
- Any remaining action, with an exact command or decision. Never call the whole app recovered if blockers remain.

A clean apply does not prove zero migration statements were generated unless the command actually exposes that evidence. If the original failure was inside a full deployment, explain whether only database apply was verified or whether the full deployment was resumed with permission.

## Manual recovery: keep data safe

Never prescribe `DROP COLUMN`, `DROP TABLE`, precision reduction or a type conversion merely because a table is unadoptable. Those operations can lose data or break dependencies. "Undo the drift" is not blanket permission to delete data.

1. Establish the intended schema from entity code, the report and known previous definitions. Distinguish a shape the model cannot represent from code the repair tool cannot safely edit.
2. Ask whether affected data must be retained. Propose read-only checks for values, nullability, dependent constraints/indexes and backups before a risky change. Inspect only with authorized database access; otherwise provide the exact checks for the user/DBA to run, with no credentials or sample row data requested in chat.
3. Present the concrete recovery choices and consequences. For `DECIMAL(38,4)`, do not blindly change it to precision 28: check whether values fit and whether the business requires higher precision. Preserving the data outside the managed shape or restoring a previous definition may be more appropriate.
4. Show exact target-specific SQL only after verifying identifiers and definitions. Explain data loss, dependencies and backup needs; ask the user to review it with their DBA and execute approved database changes. Do not execute mutating SQL automatically from this skill.
5. After the user confirms completion, refresh the drift picture safely, preview any remaining repair, review the diff, and apply with authorization.

For source-shape refusals, a semantics-preserving rewrite to the supported plain entity form may enable repair. Propose it separately, preserve all permissions/options/mappings and user edits, then re-run the preview. Do not hand-edit a field merely to bypass a failed repair check. Data-package entities need specific version-supported guidance; do not move files or rewrite package exports automatically.

If a managed table was dropped, preserving its entity is intentional. Restoring the table definition does not restore its rows: discuss backup/data recovery first. Removing an entity is a separate user decision, never automatic repair.

## Interpret the report and explain limits

Detection compares the live database with Rayfin's recorded schema, not directly with the user's current source. A model-only edit cannot necessarily unblock drift, and a clean drift check does not mean the current model equals the database.

| Category                               | Meaning and next step                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Repairable (`repairable`)              | Existing managed entity can be edited to represent the drift. Offer preview and adoption.                                     |
| Needs manual attention (`unadoptable`) | A database invariant or safe-code-edit requirement fails. Explain the specific reason; no partial adoption within this table. |
| Skipped (`out_of_scope`)               | Outside repair's managed scope. Leave it alone; it does not block apply by itself.                                            |

### Supported column adoption

| Live shape                                               | Entity declaration                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `UNIQUEIDENTIFIER`                                       | `@uuid()`                                                                |
| `NVARCHAR(n)` / `NVARCHAR(MAX)`                          | `@text({ max: n })` / `@text()`                                          |
| `INT` / `BIT`                                            | `@int()` / `@boolean()`                                                  |
| `DATETIME2`                                              | `@date()`                                                                |
| `DECIMAL(p,s)`                                           | `@decimal({ precision: p, scale: s })`, within supported precision/scale |
| Nullable                                                 | `optional: true` and the corresponding optional property                 |
| Representable literal default, except date/time defaults | `default:`                                                               |

Repair also removes fields for dropped columns and updates supported size/nullability/default facets. It keeps role/auth decorators, custom plurals, unrelated options, comments and formatting; it does not regenerate whole entity files. Repair never adopts primary-key, foreign-key, unique or check constraint changes.

### Manual-attention and skipped distinctions

- A changed/missing primary key structure, non-UUID `id`, or non-UUID column used by a Rayfin foreign key needs manual attention. A primary-key **name-only** change is ignored by the deployed preflight; do not diagnose it as missing structural enforcement.
- Changed Rayfin-owned `FK_`, `UQ_` or `CK_` constraints (including renaming, disabling and `NOCHECK`) can block. Hand-named constraints outside Rayfin's prefixes are skipped; they may still cause a later SQL migration to fail.
- `IDENTITY`/computed columns, unsupported changes to a managed column, decimal precision above 28, and values/defaults the entity layer cannot represent exactly can block. A new unsupported type such as `BIGINT` can instead be skipped; follow the reported category rather than inferring from its type alone.
- Non-Unicode `VARCHAR` and fixed-width `CHAR`/`NCHAR` cannot be written back as the supported text decorator. Some CLI versions display `VARCHAR` as `NVARCHAR` in the report; do not treat that display as proof the underlying type changed.
- An expression default can be listed as skipped while its new column makes the table unrepairable. Date/time defaults are not adopted; literal date-to-date changes can be ignored, while additions/removals are warned about. Do not promise to adopt these defaults or override the table's outcome.
- Defaults on managed `id` are not compared. A missing database-generated ID default can still break inserts, even without a drift warning.
- New unmanaged tables do not become entities through repair. Objects outside `dbo`, views, procedures, functions, triggers, ordinary indexes, row-level security and extended properties are outside discovery/repair scope. Collation changes are out of scope too.
- A skipped new `NOT NULL` column with no default can break inserts. Warn about that runtime risk without silently removing it or presenting it as an apply blocker.
- Name comparison generally ignores case. A case-only rename may produce no drift; use actual target behavior and version-locked documentation for edge cases.

### Safe source-edit requirements

Repair works on entity files under `rayfin/data`. It can refuse when entities load through a data package's `exports`/`main`, classes extend another class or are duplicated, core imports are namespace/aliased imports, decorator options use variables/spreads/shorthand, mappings are ambiguous, or multiple fields map to one column. New column names must be representable as supported plain ASCII property names. A dropped-table refusal searches for entity-name references under `rayfin/data`, not the entire repository.

Explain the exact refusal from the preview, not a generic "unsupported". Do not remove security decorators or unrelated options to make the code pass.

## Commands and failure recovery

Use the project-local executable in place of `rayfin` below. Fill in and quote actual paths for the user's shell.

| Goal                          | Command for a deployed app                                                 |
| ----------------------------- | -------------------------------------------------------------------------- |
| Preview selected tables       | `rayfin up db repair --table Todos --table Notes --dry-run --output json`  |
| Preview a decision CSV        | `rayfin up db repair --from "<decision-copy.csv>" --dry-run --output json` |
| Adopt the approved selection  | Same preview command without `--dry-run`                                   |
| Preview all repairable tables | `rayfin up db repair --all --dry-run --output json`                        |
| Apply reviewed model changes  | `rayfin up db apply`                                                       |
| Help for repair               | `rayfin up db repair --help`                                               |

Repair may be hidden from parent help. Explicit selection is required without an interactive terminal, with JSON output, or with `--yes`; `--yes` does not mean `--all`. Do not add multiple selection modes together. Older `db apply` JSON output may be missing or mixed with prose; inspect captured streams rather than mislabeling that as schema drift. Repair JSON has `repaired`, `dry_run`, `nothing_to_do` or `error` status; evaluate it together with the process exit code.

| Result                                                                                     | What to do next                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REPAIR_STALE`                                                                             | Stop retrying that plan. It may mean database state changed **or CSV identifying cells were changed**. Inspect the source diff for prior writes, obtain a current report/CSV with authorized apply, reselect and preview. "Run repair again" is not enough for a stale CSV. |
| `REPAIR_NOT_REPAIRABLE` / `REPAIR_CODE_NOT_SAFE`                                           | Show the named table and precise reason. Follow manual/source-shape recovery; do not bypass the check.                                                                                                                                                                      |
| `REPAIR_TABLE_NOT_FOUND`                                                                   | Check the actual table name, current report and whether another repair already finished it. Do not manufacture drift to retry.                                                                                                                                              |
| `REPAIR_NO_SELECTION`                                                                      | Supply approved `--table`, `--all` or `--from`; do not launch an unattended picker.                                                                                                                                                                                         |
| `nothing_to_do` / no rows marked                                                           | No repair occurred. Check whether the selection was empty or drift is already resolved.                                                                                                                                                                                     |
| `nothing_to_do` with `reason: disabled`, `REPAIR_DISABLED`, or schema recovery not enabled | Repair is unavailable for this app. Explain the limitation; use safe database recovery or contact the app administrator. Do not turn on hidden flags or claim success.                                                                                                      |
| `REPAIR_NOT_SUPPORTED`                                                                     | Host does not support repair. Offer version-supported recovery/help; do not force a local downgrade or upgrade.                                                                                                                                                             |
| `SCHEMA_DISCOVERY_EMPTY` / database appears empty                                          | Verify target, permissions and database availability before assuming tables were deleted. Do not drop/recreate the database or use unsupported `--accept-empty-database`.                                                                                                   |
| Missing/altered CSV header or `row_id`                                                     | Keep the original evidence, obtain a fresh generated file, and edit only decisions. Do not fabricate IDs or silently repair corrupted metadata.                                                                                                                             |
| Auth/permission failure, including `INVALID_CALLER`                                        | Verify the account and app permissions. Some deployments enforce app ownership even for workspace admins. Do not switch identities or weaken authorization automatically.                                                                                                   |
| Network, paused database or transient service error                                        | Inspect whether the prior operation wrote files or committed before offering a bounded retry. Report the concrete blocker if it persists.                                                                                                                                   |

### Partial failures and concurrent repair

Repair writes each entity file **before** committing its schema record. A failed commit can leave source edits behind. Inspect the diff and returned per-table results even on nonzero exit; never say "nothing changed" solely because the command failed.

After a partial run, preserve completed work. With `--all`, a retry can process remaining drift, but preview first and check the actual state. With `--from` or selected tables that already completed, obtain a current report and select only remaining tables; the old selection can fail as stale or not found.

After concurrent repairs, do not promise exactly one winner or infer consistency from success messages alone. Inspect both results and both diffs where available. Keep changes that match the accepted schema; reconcile differing edits with the other session while preserving unrelated work. Do not automatically reset or check out whole files. If reconciliation is unclear, stop and explain what must be reviewed before apply.

### A SQL migration error without a drift report

An index, view or constraint can prevent a legitimate migration. Repair cannot fix that dependency error. The failing table's migration is rolled back; do not imply that every other table or earlier deployment step rolled back too. Explain the reported blocking object and propose safe dependency investigation with the user/DBA. Never drop it automatically.

### Skip detection is not recovery

`--force` does not bypass drift. `--skip-drift-check` and `RAYFIN_SKIP_DRIFT_CHECK=1|true` bypass detection for apply; they do not adopt changes, update entity code or enable repair. They can let a migration proceed against an unexpected schema. Never recommend them as the normal fix. If the user explicitly requests emergency bypass, explain the data-loss risk, get approval for the exact apply, and remove the temporary setting afterwards. Verify a subsequent normal run with detection enabled; a skipped success is not proof of recovery.

## Completion and escalation

If blocked, leave the user with a specific action, not an internal debugging assignment. Summarize the target, selected tables, current blockers, safe next command and approval needed. For support, retain the CLI/package version, redacted command/output, exit code, timestamp and any returned activity/request ID; do not invent telemetry or require access to internal dashboards. Runtime/application checks beyond schema recovery need their own authorization.

Use version-locked docs for unknown behavior. If the skill appears not to be active, verify the installed `.agents/skills/rayfin-schema-drift/SKILL.md` and tool availability rather than claiming the workflow was loaded or ran. No skill can guarantee that an IDE resumes a suspended tool call; surface the interruption and resume from observed state.

[Troubleshoot Fabric Apps: database issues](https://learn.microsoft.com/fabric/apps/troubleshooting#database-issues)
