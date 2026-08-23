/**
 * @packageDocumentation Functions API for invoking serverless functions.
 *
 * The single public surface is `client.functions.<name>.invoke(...)` where
 * `<name>` is constrained by the `FunctionsSchema` type parameter passed to
 * `RayfinClient`.
 *
 * ```ts
 * const res = await client.functions.helloWorld.invoke({ firstName: 'Ada' });
 * ```
 */
import { ApiClient, SdkError } from '@microsoft/rayfin-lib';
import { FunctionClient } from './FunctionClient.js';
import type { FunctionsSchema } from './FunctionsSchema.js';
export { FunctionClient } from './FunctionClient.js';
export type { FunctionInvocationResponse, InvokeOptions, } from './FunctionClient.js';
/**
 * Functions error specific to the Rayfin SDK.
 */
export declare class FunctionsError extends SdkError {
    constructor(message: string, code?: string);
}
/**
 * Mapped type that produces one `FunctionClient` property per schema entry.
 *
 * `client.functions` resolves to this type — every key in `TSchema` becomes
 * a strongly-typed per-function client whose `invoke()` signature matches
 * the schema entry.
 */
export type TypedFunctionClients<TSchema extends FunctionsSchema> = {
    [K in keyof TSchema & string]: FunctionClient<TSchema[K]['input'], TSchema[K]['output']>;
};
/**
 * Create a typed `client.functions` proxy that lazily instantiates and caches
 * a {@link FunctionClient} per schema-defined function name.
 *
 * ```ts
 * const fns = createFunctionsApi<MyFunctionsSchema>(apiClient);
 * const res = await fns.helloWorld.invoke({ firstName: 'Ada' });
 * ```
 */
export declare function createFunctionsApi<TSchema extends FunctionsSchema = FunctionsSchema>(apiClient: ApiClient): TypedFunctionClients<TSchema>;
//# sourceMappingURL=Functions.d.ts.map