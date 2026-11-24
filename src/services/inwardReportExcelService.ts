import ExcelJS from 'exceljs';
import { InwardEntry } from '../types/inward';
import { formatDate } from '../utils/formatters';

export interface InwardReportExcelParams {
  inwards: InwardEntry[];
  customerName?: string;
  subcontractorName?: string;
  startDate?: string;
  endDate?: string;
  processCategory?: string;
  status?: string;
}

export class InwardReportExcelService {
  /**
   * 1. Export with Colour Lines:
   * Generates and downloads an Excel spreadsheet with every inward colour line detailed.
   * Merges receipt & customer & PO metadata across colour lines so duplicate info is not repeated.
   * Note: "Customer Code" column is omitted as requested.
   */
  static async exportWithColours(params: InwardReportExcelParams): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Perla ERP';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Inward With Colour Lines', {
      views: [{ showGridLines: true }]
    });

    // --- 1. Company Header Banner ---
    worksheet.mergeCells('A1:R1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'PERLA TEXTILES PROCESSOR - INWARD DETAILED REPORT (WITH COLOURS)';
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' } // Dark Navy
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    worksheet.mergeCells('A2:R2');
    const subTitleCell = worksheet.getCell('A2');
    subTitleCell.value = 'Factory: No. 48/2, SIDCO Industrial Estate, Thirumudivakkam, Chennai - 600044, Tamil Nadu.';
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
    worksheet.getCell('F3').value = `Contractor: ${params.subcontractorName || 'All Contractors'}`;
    worksheet.getCell('F3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('J3:N3');
    worksheet.getCell('J3').value = `Date Range: ${dateRangeStr}`;
    worksheet.getCell('J3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('O3:R3');
    worksheet.getCell('O3').value = `Generated On: ${formatDate(new Date().toISOString())}`;
    worksheet.getCell('O3').font = { name: 'Calibri', size: 10 };
    worksheet.getCell('O3').alignment = { horizontal: 'right' };
    worksheet.getRow(3).height = 20;

    worksheet.getRow(4).height = 8; // Spacing row

    // --- 3. Table Column Headers (18 Columns, Customer Code omitted) ---
    const headers = [
      'Inward No',
      'Inward Date',
      'Customer DC No',
      'DC Date',
      'Customer Name',
      'Subcontractor Unit',
      'PO Number',
      'Style Number',
      'Item Description',
      'Process',
      'Colour Name',
      'Wash / Process',
      'PO Ordered Qty',
      'Prev Inward Qty',
      'Inward Qty',
      'Balance Qty',
      'Unit',
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
    let totalInwardQty = 0;
    let totalPoOrderedQty = 0;
    let totalPrevInwardQty = 0;
    let totalBalanceQty = 0;
    let currentRowIndex = 6;

    params.inwards.forEach((inward) => {
      const lines = inward.lines || [];
      const inwardNo = inward.inwardNo || 'INW/PENDING';
      const inwardDate = formatDate(inward.inwardDate);
      const custDcNo = inward.customerDcNo || '-';
      const custDcDate = inward.customerDate ? formatDate(inward.customerDate) : '-';
      const custName = inward.customerCompanyNameSnapshot || inward.customerName || '-';
      const subName = inward.subcontractorNameSnapshot || inward.subContractorName || '-';
      const poNum = inward.poNumberSnapshot || inward.poNumber || '-';
      const styleNo = inward.styleNoSnapshot || inward.styleNo || '-';
      const itemName = inward.itemNameSnapshot || inward.itemName || '-';
      const processCategory = (inward.processCategorySnapshot || inward.processCategory || 'washing').toUpperCase();
      const statusText = (inward.status || 'draft').toUpperCase();

      if (lines.length === 0) {
        const row = worksheet.getRow(currentRowIndex);
        const inwQty = Number(inward.totalQuantity) || 0;
        totalInwardQty += inwQty;

        row.values = [
          inwardNo,
          inwardDate,
          custDcNo,
          custDcDate,
          custName,
          subName,
          poNum,
          styleNo,
          itemName,
          processCategory,
          '-',
          '-',
          0,
          0,
          inwQty,
          0,
          inward.totalQtyByUnit?.kg ? 'KG' : 'PCS',
          statusText
        ];

        formatWithColoursDataRow(row, false, true);
        currentRowIndex++;
      } else {
        const startRow = currentRowIndex;
        const endRow = currentRowIndex + lines.length - 1;

        lines.forEach((line, idx) => {
          const row = worksheet.getRow(currentRowIndex);
          const lineOrderedQty = Number(line.orderedQtySnapshot) || 0;
          const linePrevQty = Number(line.previouslyReceivedQtySnapshot) || 0;
          const lineInwQty = Number(line.receivedQty) || 0;
          const lineBalQty = Number(line.balanceAfterReceiptSnapshot) || 0;

          totalPoOrderedQty += lineOrderedQty;
          totalPrevInwardQty += linePrevQty;
          totalInwardQty += lineInwQty;
          totalBalanceQty += lineBalQty;

          // Only the first row contains Receipt, Customer, Contractor & PO/Style header info
          // Non-repeating format matching PDF requirements (no Customer Code)
          row.values = [
            idx === 0 ? inwardNo : '',
            idx === 0 ? inwardDate : '',
            idx === 0 ? custDcNo : '',
            idx === 0 ? custDcDate : '',
            idx === 0 ? custName : '',
            idx === 0 ? subName : '',
            idx === 0 ? poNum : '',
            idx === 0 ? styleNo : '',
            idx === 0 ? itemName : '',
            idx === 0 ? processCategory : '',
            line.colourNameSnapshot || line.colour || '-',
            line.washTypeSnapshot || line.processType || '-',
            lineOrderedQty,
            linePrevQty,
            lineInwQty,
            lineBalQty,
            (line.unit || 'piece').toUpperCase(),
            idx === 0 ? statusText : ''
          ];

          formatWithColoursDataRow(row, idx % 2 === 1, idx === 0);
          currentRowIndex++;
        });

        // Vertically merge receipt metadata columns across this inward's colour lines
        if (lines.length > 1) {
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 18].forEach((col) => {
            worksheet.mergeCells(startRow, col, endRow, col);
            const cell = worksheet.getCell(startRow, col);
            cell.alignment = {
              vertical: 'middle',
              horizontal: [1, 2, 3, 4, 7, 10, 18].includes(col) ? 'center' : 'left',
              wrapText: true
            };
          });
        }
      }
    });

    // --- 5. Total Row ---
    const totalRow = worksheet.getRow(currentRowIndex);
    totalRow.values = [
      'TOTAL INWARD RECEIPT SUMMARY',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      totalPoOrderedQty,
      totalPrevInwardQty,
      totalInwardQty,
      totalBalanceQty,
      '',
      ''
    ];

    worksheet.mergeCells(currentRowIndex, 1, currentRowIndex, 12);
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

      if ([13, 14, 15, 16].includes(colNumber)) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 1) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    // --- 6. Adjust Column Widths (18 Columns) ---
    worksheet.columns = [
      { key: 'inwardNo', width: 18 },
      { key: 'inwardDate', width: 14 },
      { key: 'customerDcNo', width: 18 },
      { key: 'customerDcDate', width: 14 },
      { key: 'customerName', width: 30 },
      { key: 'subcontractorName', width: 24 },
      { key: 'poNumber', width: 18 },
      { key: 'styleNo', width: 20 },
      { key: 'itemName', width: 24 },
      { key: 'processCategory', width: 14 },
      { key: 'colourName', width: 18 },
      { key: 'washType', width: 18 },
      { key: 'poOrderedQty', width: 15 },
      { key: 'prevInwardQty', width: 15 },
      { key: 'inwardQty', width: 15 },
      { key: 'balanceQty', width: 15 },
      { key: 'unit', width: 10 },
      { key: 'status', width: 14 }
    ];

    // Helper for cell formatting
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

        if (colNumber === 1 || colNumber === 7 || colNumber === 8 || colNumber === 11) {
          cell.font = { name: 'Calibri', size: 9, bold: true };
        }

        if ([2, 4, 10, 17, 18].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if ([13, 14, 15, 16].includes(colNumber)) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 15) {
            cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF047857' } }; // Emerald Bold
          }
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    }

    // --- 7. Save & Download ---
    await downloadWorkbook(workbook, `Inward_Detailed_With_Colours_${getSafeName(params.customerName)}_${getSafeDate()}.xlsx`);
  }

  /**
   * 2. Export Inward Summary (Inward Info Only):
   * Generates and downloads an Excel spreadsheet with 1 row per Inward receipt (no colour lines).
   * Note: "Customer Code" column is omitted as requested.
   */
  static async exportInwardSummary(params: InwardReportExcelParams): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Perla ERP';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Inward Summary Report', {
      views: [{ showGridLines: true }]
    });

    // --- 1. Header Banner ---
    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'PERLA TEXTILES PROCESSOR - INWARD SUMMARY REPORT';
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
    subTitleCell.value = 'Factory: No. 48/2, SIDCO Industrial Estate, Thirumudivakkam, Chennai - 600044, Tamil Nadu.';
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
    worksheet.getCell('E3').value = `Contractor: ${params.subcontractorName || 'All Contractors'}`;
    worksheet.getCell('E3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('H3:J3');
    worksheet.getCell('H3').value = `Date Range: ${dateRangeStr}`;
    worksheet.getCell('H3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('K3:M3');
    worksheet.getCell('K3').value = `Generated On: ${formatDate(new Date().toISOString())}`;
    worksheet.getCell('K3').font = { name: 'Calibri', size: 10 };
    worksheet.getCell('K3').alignment = { horizontal: 'right' };
    worksheet.getRow(3).height = 20;

    worksheet.getRow(4).height = 8; // Spacing

    // --- 3. Table Column Headers (13 Columns, Customer Code omitted) ---
    const headers = [
      'Inward No',
      'Inward Date',
      'Customer DC No',
      'DC Date',
      'Customer Name',
      'Subcontractor Unit',
      'PO Number',
      'Style Number',
      'Item Description',
      'Process',
      'Total Received Qty',
      'Unit',
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
    let totalInwardQty = 0;
    let currentRowIndex = 6;

    params.inwards.forEach((inward, index) => {
      const row = worksheet.getRow(currentRowIndex);
      const inwQty = Number(inward.totalQuantity) || 0;
      totalInwardQty += inwQty;

      row.values = [
        inward.inwardNo || 'INW/PENDING',
        formatDate(inward.inwardDate),
        inward.customerDcNo || '-',
        inward.customerDate ? formatDate(inward.customerDate) : '-',
        inward.customerCompanyNameSnapshot || inward.customerName || '-',
        inward.subcontractorNameSnapshot || inward.subContractorName || '-',
        inward.poNumberSnapshot || inward.poNumber || '-',
        inward.styleNoSnapshot || inward.styleNo || '-',
        inward.itemNameSnapshot || inward.itemName || '-',
        (inward.processCategorySnapshot || inward.processCategory || 'washing').toUpperCase(),
        inwQty,
        inward.totalQtyByUnit?.kg ? 'KG' : 'PCS',
        (inward.status || 'draft').toUpperCase()
      ];

      row.height = 20;
      const isEvenRow = index % 2 === 1;

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
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (colNumber === 1 || colNumber === 7 || colNumber === 8) {
          cell.font = { name: 'Calibri', size: 9, bold: true };
        }

        if ([2, 4, 10, 12, 13].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 11) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF047857' } };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });

      currentRowIndex++;
    });

    // --- 5. Total Row ---
    const totalRow = worksheet.getRow(currentRowIndex);
    totalRow.values = [
      'TOTAL RECEIVED QUANTITY',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      totalInwardQty,
      '',
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
      } else if (colNumber === 1) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    // --- 6. Adjust Column Widths (13 Columns) ---
    worksheet.columns = [
      { key: 'inwardNo', width: 18 },
      { key: 'inwardDate', width: 14 },
      { key: 'customerDcNo', width: 18 },
      { key: 'customerDcDate', width: 14 },
      { key: 'customerName', width: 30 },
      { key: 'subcontractorName', width: 24 },
      { key: 'poNumber', width: 18 },
      { key: 'styleNo', width: 20 },
      { key: 'itemName', width: 24 },
      { key: 'processCategory', width: 14 },
      { key: 'totalQuantity', width: 18 },
      { key: 'unit', width: 10 },
      { key: 'status', width: 14 }
    ];

    // --- 7. Save & Download ---
    await downloadWorkbook(workbook, `Inward_Summary_Report_${getSafeName(params.customerName)}_${getSafeDate()}.xlsx`);
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

function getSafeName(name?: string): string {
  return (name || 'All').replace(/[^a-zA-Z0-9]/g, '_');
}

function getSafeDate(): string {
  return new Date().toISOString().split('T')[0];
}
