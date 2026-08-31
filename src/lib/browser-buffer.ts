import { Buffer } from "buffer/";

type BufferGlobal = {
  Buffer?: typeof Buffer;
};

/**
 * MetaMask Connect's browser MWP transport calls the global `Buffer.from`.
 * Its bundled shim can be removed by downstream tree-shaking, so install the
 * same browser implementation explicitly before importing the SDK runtime.
 */
export function ensureBrowserBuffer(target: BufferGlobal = globalThis): typeof Buffer {
  if (!target.Buffer) target.Buffer = Buffer;
  return target.Buffer;
}
