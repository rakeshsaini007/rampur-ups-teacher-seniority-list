import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TeacherRecord } from '../types';

export interface ExportPdfOptions {
  records: TeacherRecord[];
  mode: 'eligible' | 'excluded';
  title: string;
  subtitle: string;
  filename: string;
}

const NON_ASCII_RE = /[^\x20-\x7E]/;

function renderUnicodeCellImage(
  text: string,
  cellWidthMm: number,
  cellHeightMm: number,
  textColorHex: string
): { dataUrl: string; imgW: number; imgH: number } | null {
  if (typeof document === 'undefined') return null;

  const scale = 4; // High-DPI rendering for sharp PDF text
  const pxPerMm = 3.78;
  const maxWidthPx = Math.max(40, Math.floor((cellWidthMm - 3) * pxPerMm * scale));
  const boxHeightPx = Math.max(24, Math.floor(cellHeightMm * pxPerMm * scale));

  const canvas = document.createElement('canvas');
  canvas.width = maxWidthPx;
  canvas.height = boxHeightPx;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const fontSizePx = Math.round(7 * 1.33 * scale);
  ctx.font = `500 ${fontSizePx}px "Noto Sans Devanagari", "Public Sans", system-ui, sans-serif`;
  ctx.fillStyle = textColorHex;
  ctx.textBaseline = 'middle';

  // Truncate cleanly if text exceeds cell width
  let drawText = text;
  if (ctx.measureText(drawText).width > maxWidthPx - 4) {
    while (drawText.length > 1 && ctx.measureText(drawText + '…').width > maxWidthPx - 4) {
      drawText = drawText.slice(0, -1);
    }
    drawText += '…';
  }

  ctx.fillText(drawText, 2, boxHeightPx / 2);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    imgW: maxWidthPx / (pxPerMm * scale),
    imgH: boxHeightPx / (pxPerMm * scale),
  };
}

export function exportSeniorityPdf({
  records,
  mode,
  title,
  subtitle,
  filename,
}: ExportPdfOptions): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Page 1 header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 10, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(subtitle, 10, 17.5);

  const head = [
    [
      mode === 'eligible' ? 'Rank' : 'Row',
      'S.No.',
      'Teacher Name',
      'Desig.',
      'EHRMS',
      'School Name',
      'Block',
      'First Joining',
      'DOB',
      'UPS TET',
      mode === 'eligible' ? 'Remarks / Status' : 'Exclusion Reason',
    ],
  ];

  const body = records.map((rec) => {
    const statusText =
      mode === 'eligible'
        ? rec.remarks || (rec.warnings.length > 0 ? rec.warnings[0] : 'Clear')
        : rec.exclusionReason || '';

    return [
      mode === 'eligible'
        ? String(rec.seniorityRank ?? '')
        : String(rec.sheetRowNumber),
      rec.originalSno || '-',
      rec.teacherName || '-',
      rec.designation || '-',
      rec.ehrmsCode || '-',
      rec.schoolName || '-',
      rec.block || '-',
      rec.joiningDateRampur || 'Missing',
      rec.dob || 'Missing',
      rec.tetUps || 'Blank',
      statusText,
    ];
  });

  // Store original non-ASCII text per cell coordinate so jsPDF won't print garbled glyphs
  const unicodeOverrides = new Map<string, { text: string; color: string }>();

  autoTable(doc, {
    head,
    body,
    startY: 21,
    margin: { top: 14, right: 10, bottom: 14, left: 10 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 1.6,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'right', cellWidth: 11, fontStyle: 'bold' },
      1: { halign: 'right', cellWidth: 11 },
      2: { cellWidth: 38, fontStyle: 'bold' },
      3: { cellWidth: 17 },
      4: { cellWidth: 16 },
      5: { cellWidth: 56 },
      6: { cellWidth: 19 },
      7: { cellWidth: 21 },
      8: { cellWidth: 21 },
      9: { cellWidth: 16 },
      10: { cellWidth: 51 },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return;
      const rawText = Array.isArray(hookData.cell.text)
        ? hookData.cell.text.join(' ')
        : String(hookData.cell.text || '');

      if (hookData.column.index === 10 && rawText !== 'Clear') {
        hookData.cell.styles.textColor = [185, 28, 28];
      }

      if (NON_ASCII_RE.test(rawText)) {
        const key = `${hookData.row.index}:${hookData.column.index}`;
        const color =
          hookData.column.index === 10 ? '#b91c1c' : '#1e293b';
        unicodeOverrides.set(key, { text: rawText, color });
        hookData.cell.text = [''];
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section !== 'body') return;
      const key = `${hookData.row.index}:${hookData.column.index}`;
      const override = unicodeOverrides.get(key);
      if (!override) return;

      const rendered = renderUnicodeCellImage(
        override.text,
        hookData.cell.width,
        hookData.cell.height,
        override.color
      );
      if (rendered) {
        doc.addImage(
          rendered.dataUrl,
          'PNG',
          hookData.cell.x + 1.5,
          hookData.cell.y + (hookData.cell.height - rendered.imgH) / 2,
          rendered.imgW,
          rendered.imgH
        );
      }
    },
    didDrawPage: (hookData) => {
      const pageCount = doc.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Rampur Seniority Register | Generated ${new Date().toLocaleDateString()}`,
        10,
        pageHeight - 6
      );
      doc.text(
        `Page ${hookData.pageNumber} of ${pageCount}`,
        pageWidth - 10,
        pageHeight - 6,
        { align: 'right' }
      );
    },
  });

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
