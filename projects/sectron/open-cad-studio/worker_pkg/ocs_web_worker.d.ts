/* tslint:disable */
/* eslint-disable */

/**
 * Parse DWG/DXF on a dedicated browser worker and return a compact serialized
 * document. The main wasm instance only deserializes and installs it, so the
 * expensive bit/handle/object decode never occupies the browser UI thread.
 */
export function parse_document(name: string, bytes: Uint8Array, recovery_mode: boolean, initial_error: string, report_stage: Function): Uint8Array;

/**
 * Serialize an already-prepared document to DWG/DXF bytes on the dedicated
 * browser worker, so the expensive writer pass (bit-level DWG encoding /
 * ASCII DXF formatting) never occupies the UI thread. `encoded_document` is
 * the shared `ocs_save` request payload (document + runtime-field sidecar +
 * target extension); the reply is the shared response payload (protocol
 * version + `Result<bytes, error text>`). The main wasm instance only decodes
 * the result — the save-side counterpart of [`parse_document`].
 */
export function serialize_document(encoded_document: Uint8Array, report_stage: Function): Uint8Array;

export function sha256_document(bytes: Uint8Array): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly parse_document: (a: number, b: number, c: any, d: number, e: number, f: number, g: any) => [number, number, number];
    readonly serialize_document: (a: any, b: any) => [number, number, number];
    readonly sha256_document: (a: any) => [number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
