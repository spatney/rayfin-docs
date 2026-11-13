---
sidebar_position: 5
---

# Bulk import functions

Use a Rayfin function for CSV and bulk imports that must validate rows, write data, or hide implementation details from the browser.
Keep the browser responsible for collecting text and displaying results, and keep parsing, validation, reference lookup, and writes inside the function.

## Frontend contract

Support pasted text even when you also offer a file picker.
Automated reviewers and keyboard-only users can fill a labelled `<textarea>` reliably, while native file pickers may be unavailable.

A good import panel has these elements:

- A visible label tied to the textarea with `htmlFor` and `id`.
- An obvious submit button such as `Import CSV`.
- A persistent result region with `role="status"` for expected outcomes.
- A separate `role="alert"` region for unexpected invocation failures.
- A summary that stays visible after import, such as `4 imported, 2 rejected`.
- A per-row rejection list that includes the CSV row number and a human-readable reason.

Import `AppClient` from your application factory module, where it is declared as `ReturnType<typeof createClient>`.
That factory must register `functionsService<AppFunctionsSchema>()`; adjust the module path below to your app.

```tsx
import { useState } from 'react';
import type { AppClient } from '../services/rayfinClient';
import type { AppFunctionsSchema } from '../rayfin/functions/src/types.js';

type ImportResult =
  AppFunctionsSchema['importTransactionsCsv']['output'];

type CsvImportPanelProps = {
  client: AppClient;
  onImported?: () => void | Promise<void>;
};

export function CsvImportPanel({
  client,
  onImported,
}: CsvImportPanelProps) {
  const [csvText, setCsvText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshImportedData(): Promise<void> {
    setIsRefreshing(true);
    setRefreshError('');
    try {
      await onImported?.();
    } catch {
      setRefreshError(
        'The import succeeded, but refreshing the data failed.',
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleImport(): Promise<void> {
    setIsImporting(true);
    setResult(null);
    setError('');
    setRefreshError('');

    let next: ImportResult;
    try {
      next = await client.functions.importTransactionsCsv.invoke({ csvText });
    } catch {
      setError('The import failed unexpectedly. Try again or contact support.');
      return;
    } finally {
      setIsImporting(false);
    }

    setResult(next);
    if (next.imported > 0) {
      await refreshImportedData();
    }
  }

  return (
    <section aria-labelledby="csv-import-heading">
      <h2 id="csv-import-heading">Import CSV</h2>
      <label htmlFor="csv-import-text">Paste CSV text</label>
      <textarea
        id="csv-import-text"
        value={csvText}
        onChange={(event) => setCsvText(event.target.value)}
        rows={8}
      />
      <button type="button" onClick={handleImport} disabled={isImporting}>
        {isImporting ? 'Importing…' : 'Import CSV'}
      </button>

      <div role="status" aria-live="polite">
        {result ? (
          <>
            <p>
              {result.imported} imported, {result.rejected.length} rejected.
            </p>
            {isRefreshing ? <p>Refreshing imported data…</p> : null}
            {result.rejected.length > 0 ? (
              <ul>
                {result.rejected.map((item) => (
                  <li key={`${item.row}-${item.reason}`}>
                    Row {item.row}: {item.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p>{isImporting ? 'Importing…' : 'No import has run.'}</p>
        )}
      </div>

      {error ? <div role="alert">{error}</div> : null}
      {refreshError ? (
        <div role="alert">
          <p>{refreshError}</p>
          <button
            type="button"
            onClick={refreshImportedData}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Refreshing…' : 'Retry refresh'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
```

Do not hide the result behind a route change, a collapsed drawer, or a toast that disappears.
Refresh any dashboard or table that depends on the imported records after a successful result.

## Function result shape

Return typed, safe data for row-level problems instead of throwing.
Throw only for unexpected infrastructure failures that the caller cannot fix row by row.

```ts
type ImportRejectedRow = {
  row: number;
  reason: string;
};

type ImportResult = {
  imported: number;
  rejected: ImportRejectedRow[];
};
```

Keep the output free of secrets, access tokens, raw provider responses, stack traces, and personally identifiable values that are not already visible in the app.

## Server-side import recipe

Parse and validate on the server, even if the browser performs a preview.
Treat browser checks as convenience only.

1. Bound the input size before parsing.
2. Parse the header row and require the columns your import contract needs.
   Match header names case-insensitively after trimming whitespace and a leading byte-order mark, so `Amount`, `AMOUNT`, and `amount` all map to the same column.
   If a required column is missing, reject the whole import with a clear reason instead of rejecting every row.
3. Parse data rows with row numbers that match the user's CSV editor.
4. Validate every row independently.
5. Resolve or create referenced records idempotently with `ctx.getDataClient()`.
6. Create only valid rows.
7. Return `{ imported, rejected }` for expected row-level outcomes.

```ts
import {
  UserDataFunctions,
  type RayfinContext,
} from '@microsoft/fabric-user-data-functions';
import type { AppSchema } from '../../data/schema.js';

const udf = new UserDataFunctions();
const MAX_CSV_BYTES = 256_000;

type ImportRejectedRow = { row: number; reason: string };
type ImportResult = { imported: number; rejected: ImportRejectedRow[] };
type CsvRecord = { row: number; values: Record<string, string> };

const UNIQUE_VALUE_ERROR =
  'GraphQL errors: A record with the same unique value already exists.';

function isUniqueConstraintViolation(error: unknown): error is Error {
  return error instanceof Error && error.message === UNIQUE_VALUE_ERROR;
}

function expectedRowFailureReason(error: unknown): string | null {
  if (isUniqueConstraintViolation(error)) {
    return 'conflicts with existing data';
  }
  if (!(error instanceof Error) || !('status' in error)) {
    return null;
  }

  const status = (error as Error & { status?: unknown }).status;
  if (status === 400 || status === 422) {
    return 'was rejected by data validation';
  }
  if (status === 403) {
    return 'is not permitted for this caller';
  }
  if (status === 404 || status === 409) {
    return 'references data that is missing or changed';
  }
  return null;
}

udf.func(
  'importTransactionsCsv',
  async (
    csvText: string,
    ctx: RayfinContext<AppSchema>,
  ): Promise<ImportResult> => {
    if (new TextEncoder().encode(csvText).length > MAX_CSV_BYTES) {
      return {
        imported: 0,
        rejected: [{ row: 1, reason: 'CSV is too large' }],
      };
    }

    const parsed = parseCsvWithHeader(csvText);
    const rejected: ImportRejectedRow[] = [];
    let imported = 0;
    const data = ctx.getDataClient();

    for (const record of parsed.records) {
      const validation = validateTransactionRow(record);
      if (!validation.ok) {
        rejected.push({ row: record.row, reason: validation.reason });
        continue;
      }

      try {
        const account = await findOrCreateAccount(data, validation.value.account);
        const category = await findOrCreateCategory(
          data,
          validation.value.category,
        );

        await data.Transaction.create({
          date: validation.value.date,
          description: validation.value.description,
          amount: validation.value.amount,
          account: { id: account.id },
          category: { id: category.id },
        });
        imported += 1;
      } catch (error: unknown) {
        const reason = expectedRowFailureReason(error);
        if (reason) {
          rejected.push({ row: record.row, reason });
          continue;
        }

        throw error;
      }
    }

    return { imported, rejected };
  },
  [],
);
```

The example passes relationship objects only.
If your model exposes scalar foreign keys such as `account_id`, pass either `account_id` or `account: { id }`, never both in the same `create` or `update` call.
Only the allowlisted row-correctable statuses and unique-value conflict become rejections.
Authentication, network, server, and unclassified failures are invocation-level failures and are rethrown.

## Row validation checklist

Reject bad rows with clear reasons.
Do not coerce them into defaults that change the user's data silently.

- Required fields are present and non-empty.
  A missing category should be rejected as `missing category`, not imported as `Uncategorized`.
- Numbers parse and satisfy the domain.
  For expenses, reject zero or negative amounts unless the domain explicitly models refunds or credits.
- Dates match the declared `YYYY-MM-DD` CSV format, represent a real calendar date, and stay within any domain range you enforce.
- Enum-like values are recognized.
- Referenced records are known or can be created by the import contract.
- Duplicate rows are handled intentionally.
- Per-row failures are added to `rejected` and do not stop later valid rows from importing.

```ts
const CSV_DATE_FORMAT = 'YYYY-MM-DD';

function parseCsvDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const yearText = match[1]!;
  const monthText = match[2]!;
  const dayText = match[3]!;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

function validateTransactionRow(record: CsvRecord):
  | {
      ok: true;
      value: {
        account: string;
        category: string;
        date: string;
        description: string;
        amount: number;
      };
    }
  | { ok: false; reason: string } {
  const account = record.values['account']?.trim() ?? '';
  const category = record.values['category']?.trim() ?? '';
  const description = record.values['description']?.trim() ?? '';
  const dateText = record.values['date']?.trim() ?? '';
  const date = parseCsvDate(dateText);
  const amount = Number(record.values['amount']);

  if (!account) return { ok: false, reason: 'missing account' };
  if (!category) return { ok: false, reason: 'missing category' };
  if (!date) {
    return {
      ok: false,
      reason: `invalid date (expected ${CSV_DATE_FORMAT})`,
    };
  }
  if (!Number.isFinite(amount)) {
    return { ok: false, reason: 'invalid amount' };
  }
  if (amount <= 0) {
    return { ok: false, reason: 'amount must be positive' };
  }

  return {
    ok: true,
    value: { account, category, date, description, amount },
  };
}
```

Use a CSV parser that handles quoted values, embedded commas, blank lines, and newline variants.
Keep the parser inside the function or a server-only helper.
The browser should send the pasted text to the function, not pre-sanitized rows that bypass server validation.

## Reference lookup and ownership

Use `ctx.getDataClient()` for Rayfin DB reads and writes.
That client uses the invocation's Rayfin token, so row-level policies run as the caller.
Do not decode `ctx.accessToken` to discover ownership or to build a second data client.

When you resolve or create related records, query by the natural key that is visible to the caller and let the policy scope the result.
If the import contract allows creating missing references, do it idempotently.
Back the natural key with a database uniqueness guarantee; an initial lookup alone does not prevent concurrent imports from creating duplicates.

For a globally shared category name, declare the unique field in the entity model:

```ts
@text({ max: 200 })
name!: string;

@text({ max: 200, unique: true })
normalizedName!: string;
```

For caller- or tenant-scoped categories, create a database composite unique constraint over the scope and normalized name instead of making `name` globally unique.
Normalize the key once, before both lookup and create.
When concurrent calls race, catch only the known unique-constraint error and reread the winning row:

```ts
function normalizeCategoryName(name: string): string {
  return name.trim().normalize('NFKC').toLowerCase();
}

async function findOrCreateCategory(data, name: string) {
  const normalizedName = normalizeCategoryName(name);
  const existing = await data.Category.findFirst({
    normalizedName: { eq: normalizedName },
  });
  if (existing) return existing;

  try {
    return await data.Category.create({ name: name.trim(), normalizedName });
  } catch (error: unknown) {
    if (!isUniqueConstraintViolation(error)) throw error;

    const winner = await data.Category.findFirst({
      normalizedName: { eq: normalizedName },
    });
    if (winner) return winner;
    throw error;
  }
}
```

The exact conflict guard must use the stable error type or code exposed by your data adapter; the guard above matches the current sanitized Rayfin data-client error exactly and does not treat unrelated failures as conflicts.
If your data adapter cannot identify a unique conflict reliably, use a database-side atomic upsert or serialize creation by the scoped natural key.
An in-memory lock is not sufficient when multiple function workers can run.

If your entity policy compares `claims.sub` with an owner field such as `user_id` or `owner_id`, keep the field name and stamping strategy consistent across normal frontend creates and function creates.
Use `ctx.user.id` to stamp that owner field.

```ts
await data.Transaction.create({ owner_id: ctx.user.id, description });
```

`ctx.user.id` is the same caller subject id that Rayfin data policies evaluate as `claims.sub`.
Never decode `ctx.accessToken` for ownership.
Verify a function-created row is readable by the caller before importing many rows.

## Verification before shipping

Static validation is necessary but not sufficient.
`validate:functions` confirms function registrations and generated client types; it does not prove your row-level validation, relationship writes, or dashboard refresh work.
`validate:visual` checks static visual specifications; it does not prove imported data reaches a chart.

Before declaring an import complete:

1. Run the function validator provided by the template, such as `npm run validate:functions`.
2. Run the normal typecheck and build gates for the app.
3. Exercise the actual import path through the UI or the closest documented local or deployed invocation path.
4. Use a fixture with both valid and invalid rows.
5. Confirm the visible `role="status"` result reports the expected imported and rejected counts.
6. Confirm each invalid row shows the expected row number and reason.
7. Confirm imported rows appear in the data view after reload.
8. Confirm any dashboard totals or charts refresh from the persisted data.

A minimal expense-like fixture should include valid rows, a row with an empty category, and a row with a negative amount.
For an app that models refunds explicitly, replace the negative-amount invalid row with a different domain violation and document why refunds are valid.
