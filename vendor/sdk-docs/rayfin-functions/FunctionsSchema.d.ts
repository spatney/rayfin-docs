/**
 * Maps function names to their input/output type pairs.
 *
 * Users define a concrete type that `satisfies FunctionsSchema` in their
 * `rayfin/functions/src/types.ts` file, then pass it as the third type
 * parameter of `RayfinClient` so that `client.functions.<name>.invoke()`
 * calls are fully type-checked.
 *
 * Use an object type for named params, or `void` for no params.
 *
 * @example
 * ```typescript
 * import type { FunctionsSchema } from '@microsoft/rayfin-functions';
 *
 * export type MyFunctionsSchema = {
 *   helloWorld: { input: { firstName: string; lastName: string }; output: string };
 *   add: { input: { a: number; b: number }; output: number };
 *   noParams: { input: void; output: string };  // use void or {} for no-input functions
 * } satisfies FunctionsSchema;
 * ```
 */
export type FunctionsSchema = Record<string, {
    input: any;
    output: any;
}>;
//# sourceMappingURL=FunctionsSchema.d.ts.map