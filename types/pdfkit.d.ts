declare module "pdfkit" {
  import { Readable } from "stream";
  class PDFDocument extends Readable {
    constructor(options?: any);
    fontSize(size: number): this;
    text(text: string, options?: any): this;
    fillColor(color: string): this;
    moveDown(lines?: number): this;
    end(): void;
    on(event: string, callback: (...args: any[]) => void): this;
  }
  export = PDFDocument;
}