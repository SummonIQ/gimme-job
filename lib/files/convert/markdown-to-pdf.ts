import PDFDocument from 'pdfkit/js/pdfkit.standalone';

export async function convertMarkdownToPdf(markdown: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'LETTER' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const rawLine of markdown.split(/\r?\n/)) {
      writePdfLine(doc, rawLine);
    }

    doc.end();
  });
}

function writePdfLine(doc: PDFKit.PDFDocument, rawLine: string) {
  const line = rawLine.trim();

  if (!line) {
    doc.moveDown(0.35);
    return;
  }

  if (/^---$/.test(line)) {
    doc.addPage();
    return;
  }

  const heading = /^(#{1,6})\s+(.+)$/.exec(line);
  if (heading) {
    const sizeByLevel = [20, 16, 13, 12, 11, 10] as const;
    doc
      .moveDown(0.25)
      .font('Helvetica-Bold')
      .fontSize(sizeByLevel[heading[1].length - 1])
      .text(heading[2])
      .moveDown(0.2);
    return;
  }

  const bullet = /^[-*]\s+(.+)$/.exec(line);
  if (bullet) {
    doc.font('Helvetica').fontSize(10).text(`- ${bullet[1]}`, {
      indent: 12,
    });
    return;
  }

  doc.font('Helvetica').fontSize(10).text(line);
}
