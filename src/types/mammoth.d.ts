/**
 * mammoth ships types for its Node entry point but not for the browser build,
 * which is the one the preview loads (the Node build pulls in `fs`).
 *
 * Only `convertToHtml` is declared, because that is all this app calls. A fuller
 * declaration would be guesswork about an API we do not use.
 */
declare module 'mammoth/mammoth.browser' {
  export function convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<{
    value: string;
    messages: { type: string; message: string }[];
  }>;
}
