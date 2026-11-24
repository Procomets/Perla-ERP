import ExcelJS from 'exceljs';
import { PurchaseOrder } from '../types/po';
import { formatDate } from '../utils/formatters';

export interface POReportExcelParams {
  pos: PurchaseOrder[];
  customerName?: string;
  startDate?: string;
  endDate?: string;
  processCategory?: string;
  status?: string;
}

export class POReportExcelService {
  /**
   * 1. Export with Colour Lines:
   * Generates and downloads an Excel spreadsheet with every colour line detailed.
   * Note: "Customer Code" column is omitted as requested.
   */
  static async exportWithColours(params: POReportExcelParams): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Perla ERP';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('PO With Colour Lines', {
      views: [{ showGridLines: true }]
    });

    // --- 1. Company Header Banner ---
    worksheet.mergeCells('A1:P1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'PERLA TEXTILES PROCESSOR - PURCHASE ORDER DETAILED REPORT (WITH COLOURS)';
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' } // Dark Navy
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    worksheet.mergeCells('A2:P2');
    const subTitleCell = worksheet.getCell('A2');
    subTitleCell.value = 'NO. 107, Industrial Estate, Thirumudivakkam, SIDCO, Chennai - 600 044.';
    subTitleCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF555555' } };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 18;

    // --- 2. Filter Information Rows ---
    const dateRangeStr =
      params.startDate || params.endDate
        ? `${params.startDate ? formatDate(params.startDate) : 'Start'} to ${
            params.endDate ? formatDate(params.endDate) : 'Present'
          }`
        : 'All Available Dates';

    worksheet.mergeCells('A3:E3');
    worksheet.getCell('A3').value = `Customer: ${params.customerName || 'All Customers'}`;
    worksheet.getCell('A3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('F3:I3');
    worksheet.getCell('F3').value = `Date Range: ${dateRangeStr}`;
    worksheet.getCell('F3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('J3:L3');
    worksheet.getCell('J3').value = `Generated On: ${formatDate(new Date().toISOString())}`;
    worksheet.getCell('J3').font = { name: 'Calibri', size: 10 };

    worksheet.mergeCells('M3:P3');
    worksheet.getCell('M3').value = `Total POs: ${params.pos.length}`;
    worksheet.getCell('M3').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E79' } };
    worksheet.getCell('M3').alignment = { horizontal: 'right' };
    worksheet.getRow(3).height = 20;

    worksheet.getRow(4).height = 8; // Spacing row

    // --- 3. Table Column Headers (16 columns, Customer Code omitted) ---
    const headers = [
      'PO Number',
      'Order Date',
      'Customer Name',
      'Cust PO No',
      'Cust PO Date',
      'Process',
      'Style Number',
      'Item Description',
      'Colour Name',
      'Wash / Process',
      'Quantity',
      'Unit',
      'Rate Basis',
      'Rate (₹)',
      'Line Amount (₹)',
      'Status'
    ];

    const headerRow = worksheet.getRow(5);
    headerRow.values = headers;
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });

    // --- 4. Populate Data Rows ---
    let totalQty = 0;
    let totalAmount = 0;
    let currentRowIndex = 6;

    params.pos.forEach((po) => {
      const lines = po.colourLines || po.lines || [];
      const poNum = po.poNumber || 'PO/PENDING';
      const poDate = formatDate(po.orderDate);
      const custName = po.customerCompanyNameSnapshot || po.customerName || '-';
      const custPoNo = po.customerPoNumber || '-';
      const custPoDate = po.customerPoDate ? formatDate(po.customerPoDate) : '-';
      const processCategory = (po.processCategory || 'washing').toUpperCase();
      const styleNo = po.styleNo || po.styleNumber || '-';
      const itemName = po.itemName || '-';
      const statusText = (po.status || 'draft').toUpperCase();

      if (lines.length === 0) {
        const row = worksheet.getRow(currentRowIndex);
        const poQty = Number(po.totalQuantity) || 0;
        const poAmt = Number(po.totalAmount) || 0;
        totalQty += poQty;
        totalAmount += poAmt;

        row.values = [
          poNum,
          poDate,
          custName,
          custPoNo,
          custPoDate,
          processCategory,
          styleNo,
          itemName,
          '-',
          '-',
          poQty,
          'PCS',
          '/ Pc',
          0,
          poAmt,
          statusText
        ];

        formatWithColoursDataRow(row, false, true);
        currentRowIndex++;
      } else {
        const startRow = currentRowIndex;
        const endRow = currentRowIndex + lines.length - 1;

        lines.forEach((line, idx) => {
          const row = worksheet.getRow(currentRowIndex);
          const lineQty = Number(line.quantity) || 0;
          const lineRate = Number(line.rate) || 0;
          const lineAmt = Number(line.amount ?? line.lineAmount ?? (lineQty * lineRate)) || 0;

          totalQty += lineQty;
          totalAmount += lineAmt;

          // Only the first row of each PO contains PO & style header info
          // Non-repeating format (no Customer Code)
          row.values = [
            idx === 0 ? poNum : '',
            idx === 0 ? poDate : '',
            idx === 0 ? custName : '',
            idx === 0 ? custPoNo : '',
            idx === 0 ? custPoDate : '',
            idx === 0 ? processCategory : '',
            idx === 0 ? styleNo : '',
            idx === 0 ? itemName : '',
            line.colourName || '-',
            line.processType || '-',
            lineQty,
            (line.unit || 'PCS').toUpperCase(),
            line.rateBasis === 'per_kg' ? '/ Kg' : '/ Pc',
            lineRate,
            lineAmt,
            idx === 0 ? statusText : ''
          ];

          formatWithColoursDataRow(row, idx % 2 === 1, idx === 0);
          currentRowIndex++;
        });

        // Vertically merge PO & Style metadata across this PO's colour lines
        if (lines.length > 1) {
          [1, 2, 3, 4, 5, 6, 7, 8, 16].forEach((col) => {
            worksheet.mergeCells(startRow, col, endRow, col);
            const cell = worksheet.getCell(startRow, col);
            cell.alignment = {
              vertical: 'middle',
              horizontal: [2, 5, 6, 16].includes(col) ? 'center' : 'left',
              wrapText: true
            };
          });
        }
      }
    });

    // --- 5. Total Row ---
    const totalRow = worksheet.getRow(currentRowIndex);
    totalRow.values = [
      'TOTAL SUMMARY',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      totalQty,
      '',
      '',
      '',
      totalAmount,
      ''
    ];

    worksheet.mergeCells(currentRowIndex, 1, currentRowIndex, 10);
    totalRow.height = 24;

    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E79' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1F4E79' } },
        bottom: { style: 'double', color: { argb: 'FF1F4E79' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (colNumber === 11) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 15) {
        cell.numFmt = '₹#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 1) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    // --- 6. Adjust Column Widths (16 columns) ---
    worksheet.columns = [
      { key: 'poNumber', width: 18 },
      { key: 'orderDate', width: 14 },
      { key: 'customerName', width: 30 },
      { key: 'custPoNo', width: 16 },
      { key: 'custPoDate', width: 14 },
      { key: 'processCategory', width: 14 },
      { key: 'styleNo', width: 20 },
      { key: 'itemName', width: 24 },
      { key: 'colourName', width: 18 },
      { key: 'washType', width: 18 },
      { key: 'quantity', width: 14 },
      { key: 'unit', width: 10 },
      { key: 'rateBasis', width: 12 },
      { key: 'rate', width: 14 },
      { key: 'lineAmount', width: 18 },
      { key: 'status', width: 14 }
    ];

    // Helper for formatting data rows
    function formatWithColoursDataRow(row: ExcelJS.Row, isEvenRow: boolean, isFirstOfGroup: boolean) {
      row.height = 20;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 9 };

        if (isEvenRow) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' }
          };
        }

        cell.border = {
          top: { style: isFirstOfGroup ? 'thin' : 'hair', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (colNumber === 1 || colNumber === 7 || colNumber === 9) {
          cell.font = { name: 'Calibri', size: 9, bold: true };
        }
        if (colNumber === 2 || colNumber === 5 || colNumber === 6 || colNumber === 12 || colNumber === 13 || colNumber === 16) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 11) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNumber === 14) {
          cell.numFmt = '0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNumber === 15) {
          cell.numFmt = '₹#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 9, bold: true };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    }

    // --- 7. Save & Download ---
    await downloadWorkbook(workbook, `PO_Detailed_With_Colours_${getSafeName(params.customerName)}_${getSafeDate()}.xlsx`);
  }

  /**
   * 2. Export PO Information Only:
   * Generates and downloads an Excel spreadsheet with 1 row per PO (no colour lines).
   * Note: "Customer Code" column is omitted as requested.
   */
  static async exportPOOnly(params: POReportExcelParams): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Perla ERP';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('PO Summary Report', {
      views: [{ showGridLines: true }]
    });

    // --- 1. Company Header Banner ---
    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'PERLA TEXTILES PROCESSOR - PURCHASE ORDER SUMMARY REPORT';
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' }
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    worksheet.mergeCells('A2:M2');
    const subTitleCell = worksheet.getCell('A2');
    subTitleCell.value = 'NO. 107, Industrial Estate, Thirumudivakkam, SIDCO, Chennai - 600 044.';
    subTitleCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF555555' } };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 18;

    // --- 2. Filter Information Rows ---
    const dateRangeStr =
      params.startDate || params.endDate
        ? `${params.startDate ? formatDate(params.startDate) : 'Start'} to ${
            params.endDate ? formatDate(params.endDate) : 'Present'
          }`
        : 'All Available Dates';

    worksheet.mergeCells('A3:D3');
    worksheet.getCell('A3').value = `Customer: ${params.customerName || 'All Customers'}`;
    worksheet.getCell('A3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('E3:G3');
    worksheet.getCell('E3').value = `Date Range: ${dateRangeStr}`;
    worksheet.getCell('E3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('H3:J3');
    worksheet.getCell('H3').value = `Generated On: ${formatDate(new Date().toISOString())}`;
    worksheet.getCell('H3').font = { name: 'Calibri', size: 10 };

    worksheet.mergeCells('K3:M3');
    worksheet.getCell('K3').value = `Total POs: ${params.pos.length}`;
    worksheet.getCell('K3').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E79' } };
    worksheet.getCell('K3').alignment = { horizontal: 'right' };
    worksheet.getRow(3).height = 20;

    worksheet.getRow(4).height = 8; // Spacing row

    // --- 3. Table Column Headers (13 Columns, Customer Code omitted) ---
    const headers = [
      'PO Number',
      'Order Date',
      'Customer Name',
      'Cust PO No',
      'Cust PO Date',
      'Process',
      'Style Number',
      'Item Description',
      'Pieces (Pcs)',
      'Weight (Kg)',
      'Total Quantity',
      'Total Amount (₹)',
      'Status'
    ];

    const headerRow = worksheet.getRow(5);
    headerRow.values = headers;
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
    });

    // --- 4. Populate Data Rows (1 row per PO) ---
    let totalPieces = 0;
    let totalKg = 0;
    let totalQty = 0;
    let totalAmount = 0;
    let currentRowIndex = 6;

    params.pos.forEach((po) => {
      const row = worksheet.getRow(currentRowIndex);
      const poNum = po.poNumber || 'PO/PENDING';
      const poDate = formatDate(po.orderDate);
      const custName = po.customerCompanyNameSnapshot || po.customerName || '-';
      const custPoNo = po.customerPoNumber || '-';
      const custPoDate = po.customerPoDate ? formatDate(po.customerPoDate) : '-';
      const processCategory = (po.processCategory || 'washing').toUpperCase();
      const styleNo = po.styleNo || po.styleNumber || '-';
      const itemName = po.itemName || '-';
      const statusText = (po.status || 'draft').toUpperCase();

      const pieceQty = po.totalQtyByUnit?.piece ?? 0;
      const kgQty = po.totalQtyByUnit?.kg ?? 0;
      const poQty = Number(po.totalQuantity) || 0;
      const poAmt = Number(po.totalAmount) || 0;

      totalPieces += pieceQty;
      totalKg += kgQty;
      totalQty += poQty;
      totalAmount += poAmt;

      row.values = [
        poNum,
        poDate,
        custName,
        custPoNo,
        custPoDate,
        processCategory,
        styleNo,
        itemName,
        pieceQty,
        kgQty,
        poQty,
        poAmt,
        statusText
      ];

      row.height = 20;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 9 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (colNumber === 1 || colNumber === 7) {
          cell.font = { name: 'Calibri', size: 9, bold: true };
        }
        if ([2, 5, 6, 13].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if ([9, 10, 11].includes(colNumber)) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNumber === 12) {
          cell.numFmt = '₹#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 9, bold: true };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });

      currentRowIndex++;
    });

    // --- 5. Total Row ---
    const totalRow = worksheet.getRow(currentRowIndex);
    totalRow.values = [
      'TOTAL GRAND SUMMARY',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      totalPieces,
      totalKg,
      totalQty,
      totalAmount,
      ''
    ];

    worksheet.mergeCells(currentRowIndex, 1, currentRowIndex, 8);
    totalRow.height = 24;

    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E79' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' }
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1F4E79' } },
        bottom: { style: 'double', color: { argb: 'FF1F4E79' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if ([9, 10, 11].includes(colNumber)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 12) {
        cell.numFmt = '₹#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 1) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    // --- 6. Adjust Column Widths (13 columns) ---
    worksheet.columns = [
      { key: 'poNumber', width: 18 },
      { key: 'poDate', width: 14 },
      { key: 'customerName', width: 30 },
      { key: 'custPoNo', width: 16 },
      { key: 'custPoDate', width: 14 },
      { key: 'processCategory', width: 14 },
      { key: 'styleNo', width: 20 },
      { key: 'itemName', width: 24 },
      { key: 'pieces', width: 14 },
      { key: 'weight', width: 14 },
      { key: 'totalQuantity', width: 14 },
      { key: 'totalAmount', width: 18 },
      { key: 'status', width: 14 }
    ];

    // --- 7. Save & Download ---
    await downloadWorkbook(workbook, `PO_Summary_Report_${getSafeName(params.customerName)}_${getSafeDate()}.xlsx`);
  }

  /**
   * Backward compatibility alias for exportWithColours
   */
  static async exportToExcel(params: POReportExcelParams): Promise<void> {
    return this.exportWithColours(params);
  }
}

// Helpers
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getSafeName(customerName?: string): string {
  return (customerName || 'All_Customers').replace(/[^a-zA-Z0-9]/g, '_');
}

function getSafeDate(): string {
  return new Date().toISOString().split('T')[0];
}
