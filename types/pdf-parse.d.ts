declare module 'pdf-parse' {
  export interface PdfParseResult {
    text: string;
    numpages?: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  }

  export interface PdfParseOptions {
    max?: number;
    pagerender?: (pageData: unknown) => string;
    version?: string;
  }

  const pdfParse: (
    dataBuffer: Buffer,
    options?: PdfParseOptions,
  ) => Promise<PdfParseResult>;

  export default pdfParse;
}
