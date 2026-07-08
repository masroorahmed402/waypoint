/** Reads the text layer of a PDF, or '' if the file has none / isn't a PDF. */
export async function readPdfText(bytes: Buffer): Promise<string> {
  try {
    // dynamic import avoids pdf-parse's debug-on-require quirk
    const mod: any = await import('pdf-parse');
    const pdf = mod.default ?? mod;
    const data = await pdf(bytes);
    return String(data.text ?? '');
  } catch {
    return '';
  }
}
