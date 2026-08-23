/**
 * @packageDocumentation Per-function typed client.
 *
 * Each property on the proxy returned by `createFunctionsApi` is a
 * `FunctionClient` whose `invoke()` signature is derived from the schema
 * entry for that function name.
 */
import { ApiClient } from '@microsoft/rayfin-lib';
/**
 * Response from a function invocation.
 */
export interface FunctionInvocationResponse<TOutput = any> {
    /** The name of the function that was invoked. */
    functionName: string;
    /** A unique identifier for this invocation. */
    invocationId: string;
    /** Status of the function invocation (Success, Failed, etc.) */
    status: string;
    /**
     * The output from the function.
     * When the raw response contains a JSON-encoded string, `invoke()` auto-parses it
     * so the caller receives `TOutput` directly.
     */
    output: TOutput;
    /** Any errors that occurred during the function invocation. */
    errors: Array<string | Record<string, any>>;
}
/**
 * Options that can be supplied to a single `invoke()` call.
 */
export interface InvokeOptions {
    /** Extra headers to attach to the request. */
    headers?: Record<string, string>;
}
/**
 * A strongly-typed client for a single function.
 *
 * @typeParam TInput - The parameter object the function expects (`void` when none).
 * @typeParam TOutput - The type returned by the function.
 */
export declare class FunctionClient<TInput = any, TOutput = any> {
    private apiClient;
    private functionName;
    constructor(apiClient: ApiClient, functionName: string);
    /**
     * Invoke the function and return its typed output.
     *
     * @param args - When the function accepts input, pass
     *   `[params, options?]` — `params` are the input parameters declared
     *   by the function schema, `options` are optional per-call settings
     *   (extra headers, etc.). When the function takes no input, pass
     *   `[options?]` instead.
     * @returns The function's success-path output, typed as `TOutput`.
     *
     * Failure modes throw — a non-empty `errors` array or a non-success
     * status on the wire response is surfaced as {@link FunctionsError}.
     * Network and unknown errors are wrapped in {@link NetworkError} and
     * {@link FunctionsError} respectively. By the time this method
     * resolves, the caller can use the value without defending against
     * `undefined`.
     *
     * The server-side `invocationId` from the underlying envelope is
     * emitted via `console.debug` (along with the function name) so the
     * value is available in the browser/Node console for correlation
     * without polluting the public return type.
     *
     * @throws {@link FunctionsError} - If the function invocation fails.
     * @throws `NetworkError` - For network-related issues.
     * @throws `SdkError` - For any other unexpected SDK errors.
     *
     * @example
     * ```typescript
     * const greeting = await client.functions.helloWorld.invoke({
     *   firstName: 'Ada',
     *   lastName: 'Lovelace',
     * });
     * console.log(greeting); // typed as string
     * ```
     */
    invoke(...args: TInput extends void | Record<string, never> ? [options?: InvokeOptions] : [params: TInput, options?: InvokeOptions]): Promise<TOutput>;
}
//# sourceMappingURL=FunctionClient.d.ts.map