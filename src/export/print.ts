/**
 * PDF through the browser's print dialog. The file name offered by «Сохранить как PDF» is the document title,
 * so it is set right before printing. Margins and browser headers are removed by `@page { margin: 0 }` (kp.css).
 */
export function printKp(fileName: string): void {
  document.title = fileName;
  window.print();
}
