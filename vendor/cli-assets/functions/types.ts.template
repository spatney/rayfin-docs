/**
 * Function schema types for RayfinClient.
 *
 * Export a single schema type that maps each function name to its
 * input/output type pair.  Import this from your frontend app when
 * constructing RayfinClient so invocations are fully type-checked.
 *
 * The schema is a closed object type: only the function names listed
 * below are accepted by `client.functions.<name>.invoke(...)`.  This file
 * is regenerated automatically by `rayfin dev functions apply` whenever
 * `udf.func()` registrations change.
 *
 * IMPORTANT: This file must NOT import any Node.js packages — it is
 * resolved by the frontend app's TypeScript compiler.
 */

export type AppFunctionsSchema = {
  helloWorld: {
    input: { firstName: string; lastName: string };
    output: string;
  };
};

