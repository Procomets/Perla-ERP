import ExcelJS from 'exceljs';
import { formatDate } from '../utils/formatters';
import { StatementReportPdfItem } from './statementReportPdfService';

export interface StatementReportExcelParams {
  items: StatementReportPdfItem[];
  customerName?: string;
  styleNo?: string;
  poNumber?: string;
  statusFilter?: string;
  startDate?: string;
  endDate?: string;
}

export class StatementReportExcelService {
  static async exportToExcel(params: StatementReportExcelParams): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Perla ERP';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Statement Reconciliation', {
      views: [{ showGridLines: true }]
    });

    // 1. Company Header Banner
    worksheet.mergeCells('A1:M1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'PERLA TEXTILES PROCESSOR - STATEMENT RECONCILIATION & ORDER AUDIT REPORT';
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

    // 2. Filter Information Rows
    const dateRangeStr =
      params.startDate || params.endDate
        ? `${params.startDate ? formatDate(params.startDate) : 'Start'} to ${
            params.endDate ? formatDate(params.endDate) : 'Present'
          }`
        : 'All Available Dates';

    worksheet.mergeCells('A3:D3');
    worksheet.getCell('A3').value = `Customer: ${params.customerName || 'All Customers'}`;
    worksheet.getCell('A3').font = { name: 'Calibri', size: 10, bold: true };

    const scopeParts: string[] = [];
    if (params.styleNo && params.styleNo !== 'all') scopeParts.push(`Style: ${params.styleNo}`);
    if (params.poNumber && params.poNumber !== 'all') scopeParts.push(`PO: ${params.poNumber}`);
    if (params.statusFilter && params.statusFilter !== 'all') scopeParts.push(`Status: ${params.statusFilter}`);
    const scopeText = scopeParts.length > 0 ? scopeParts.join(' | ') : 'All Styles & POs';

    worksheet.mergeCells('E3:H3');
    worksheet.getCell('E3').value = `Scope: ${scopeText}`;
    worksheet.getCell('E3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('I3:K3');
    worksheet.getCell('I3').value = `Date Range: ${dateRangeStr}`;
    worksheet.getCell('I3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('L3:M3');
    worksheet.getCell('L3').value = `Generated On: ${formatDate(new Date().toISOString())}`;
    worksheet.getCell('L3').font = { name: 'Calibri', size: 10 };
    worksheet.getCell('L3').alignment = { horizontal: 'right' };
    worksheet.getRow(3).height = 20;

    worksheet.getRow(4).height = 8; // Spacer

    // 3. Column Headers
    const headers = [
      'Company Name',
      'PO Number',
      'Style No',
      'Item Description',
      'Colour Name',
      'Wash / Process',
      'Unit',
      'Order Qty',
      'Received Qty (Inward)',
      'Dispatch Qty (Outward)',
      'Dispatch Balance',
      'Receive Balance',
      'Reconciliation Status'
    ];

    const headerRow = worksheet.addRow(headers);
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
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    let grandOrderQty = 0;
    let grandInwardQty = 0;
    let grandDispatchQty = 0;

    // 4. Populate Rows
    params.items.forEach((item) => {
      item.lines.forEach((line) => {
        grandOrderQty += line.orderQty;
        grandInwardQty += line.receivedQty;
        grandDispatchQty += line.dispatchQty;

        const statusText = line.isAllThreeEqual
          ? `Equal (${line.orderQty} / ${line.receivedQty} / ${line.dispatchQty})`
          : line.dispatchBalance === 0 && line.receiveBalance === 0
          ? 'Completed'
          : line.dispatchBalance > 0
          ? `Pending Dispatch (${line.dispatchBalance})`
          : 'Pending Inward';

        const row = worksheet.addRow([
          item.companyName,
          item.poNumber,
          item.styleNo,
          item.itemName,
          line.colourName,
          line.process,
          line.unit.toUpperCase(),
          line.orderQty,
          line.receivedQty,
          line.dispatchQty,
          line.dispatchBalance,
          line.receiveBalance,
          statusText
        ]);

        row.height = 20;

        // Apply borders & alignments
        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Calibri', size: 9.5 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // Numerics: Columns 8..12
          if (colNumber >= 8 && colNumber <= 12) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0';
          } else if (colNumber === 7 || colNumber === 13) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }

          // Highlight status
          if (colNumber === 13 && line.isAllThreeEqual) {
            cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
          }
        });
      });
    });

    // 5. Grand Total Row
    const grandDispatchBal = grandInwardQty - grandDispatchQty;
    const grandReceiveBal = grandOrderQty - grandInwardQty;

    const totalRow = worksheet.addRow([
      'GRAND TOTALS',
      '',
      '',
      '',
      '',
      '',
      '',
      grandOrderQty,
      grandInwardQty,
      grandDispatchQty,
      grandDispatchBal,
      grandReceiveBal,
      grandDispatchBal === 0 && grandReceiveBal === 0 ? 'Fully Reconciled' : 'Open Balance'
    ]);

    totalRow.height = 22;
    worksheet.mergeCells(`A${totalRow.number}:G${totalRow.number}`);

    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      if (colNumber >= 8 && colNumber <= 12) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
      } else if (colNumber === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNumber === 13) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    // Column Widths
    worksheet.columns = [
      { width: 28 }, // Company Name
      { width: 18 }, // PO Number
      { width: 16 }, // Style No
      { width: 18 }, // Item Description
      { width: 18 }, // Colour Name
      { width: 16 }, // Wash / Process
      { width: 10 }, // Unit
      { width: 14 }, // Order Qty
      { width: 20 }, // Received Qty (Inward)
      { width: 20 }, // Dispatch Qty (Outward)
      { width: 16 }, // Dispatch Balance
      { width: 16 }, // Receive Balance
      { width: 26 }  // Status
    ];

    // Download buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (params.customerName || 'Statement_Report').replace(/[^a-zA-Z0-9]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `Perla_Statement_Report_${safeName}_${dateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}
