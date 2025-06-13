declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: any;
    metadata: any;
    version: string;
  }

  function pdf(dataBuffer: Buffer | ArrayBuffer): Promise<PDFData>;
  export = pdf;
} 