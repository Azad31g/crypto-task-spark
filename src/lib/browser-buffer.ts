import { Buffer } from "buffer/";

type BufferGlobal = {
  Buffer?: typeof Buffer;
};

/**
 * MetaMask Connect's browser MWP transport calls the global `Buffer.from`.
 * Its bundled shim can be removed by downstream tree-shaking, so install the
 * same browser implementation explicitly before importing the SDK runtime.
 */
export function ensureBrowserBuffer(target?: BufferGlobal): typeof Buffer {
  const browserGlobal = target ?? (globalThis as unknown as BufferGlobal);
  if (!browserGlobal.Buffer) browserGlobal.Buffer = Buffer;
  return browserGlobal.Buffer;
}
