import ExcelJS from 'exceljs';
import { OutwardEntry } from '../types/outward';
import { formatDate } from '../utils/formatters';

export interface OutwardReportExcelParams {
  outwards: OutwardEntry[];
  customerName?: string;
  subcontractorName?: string;
  transporterName?: string;
  startDate?: string;
  endDate?: string;
  processCategory?: string;
  status?: string;
}

export class OutwardReportExcelService {
  /**
   * 1. Export with Colour Lines:
   * Generates and downloads an Excel spreadsheet with every outward colour line detailed.
   * Merges dispatch, customer & PO metadata across colour lines so duplicate info is not repeated.
   * Note: "Customer Code" column is omitted as requested.
   */
  static async exportWithColours(params: OutwardReportExcelParams): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Perla ERP';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Outward With Colour Lines', {
      views: [{ showGridLines: true }]
    });

    // --- 1. Company Header Banner ---
    worksheet.mergeCells('A1:V1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'PERLA TEXTILES PROCESSOR - OUTWARD DISPATCH DETAILED REPORT (WITH COLOURS)';
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' } // Dark Navy #1F4E79
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    worksheet.mergeCells('A2:V2');
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

    worksheet.mergeCells('F3:J3');
    worksheet.getCell('F3').value = `Contractor: ${params.subcontractorName || 'All Contractors'}`;
    worksheet.getCell('F3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('K3:P3');
    worksheet.getCell('K3').value = `Date Range: ${dateRangeStr}`;
    worksheet.getCell('K3').font = { name: 'Calibri', size: 10, bold: true };

    worksheet.mergeCells('Q3:V3');
    worksheet.getCell('Q3').value = `Generated On: ${formatDate(new Date().toISOString())}`;
    worksheet.getCell('Q3').font = { name: 'Calibri', size: 10 };
    worksheet.getCell('Q3').alignment = { horizontal: 'right' };
    worksheet.getRow(3).height = 20;

    worksheet.getRow(4).height = 8; // Spacing row

    // --- 3. Table Column Headers (Customer Code omitted) ---
    const headers = [
      'Outward No',
      'Outward Date',
      'Our DC No',
      'Customer Name',
      'Subcontractor Unit',
      'PO Number',
      'Style Number',
      'Item Description',
      'Process Category',
      'Colour Name',
      'Wash / Process',
      'PO Ordered Qty',
      'Total Inward Qty',
      'Prev Dispatched',
      'Dispatch Qty',
      'Remaining Qty',
      'Unit',
      'Vehicle Number',
      'Driver Name',
      'Transporter',
      'Destination',
      'Status'
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }
      };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0D2840' } },
        bottom: { style: 'medium', color: { argb: 'FF0D2840' } },
        left: { style: 'thin', color: { argb: 'FF0D2840' } },
        right: { style: 'thin', color: { argb: 'FF0D2840' } }
      };
    });

    let rowIndex = 6;
    let totalOrderedQty = 0;
    let totalInwardQty = 0;
    let totalPrevDispatchedQty = 0;
    let totalPiecesDispatched = 0;
    let totalKgDispatched = 0;
    let totalRemainingQty = 0;

    for (const outw of params.outwards) {
      const startRowForOutw = rowIndex;
      const lines = outw.lines && outw.lines.length > 0 ? outw.lines : [null];

      for (const line of lines) {
        const row = worksheet.addRow([
          outw.outwardNo || '—',
          outw.outwardDate ? formatDate(outw.outwardDate) : '—',
          outw.ourDcNo || '—',
          outw.customerCompanyNameSnapshot || outw.customerName || '—',
          outw.subcontractorNameSnapshot || outw.subContractorName || 'Direct Delivery',
          outw.poNumberSnapshot || outw.poNumber || '—',
          outw.styleNoSnapshot || outw.styleNo || '—',
          outw.itemNameSnapshot || outw.itemName || 'Garments',
          (outw.processCategorySnapshot || outw.processCategory || 'washing').toUpperCase(),
          line ? line.colourNameSnapshot || line.colour || '—' : '—',
          line ? line.washTypeSnapshot || line.processType || line.process || 'Standard' : '—',
          line ? line.orderedQtySnapshot || 0 : 0,
          line ? line.cumulativeInwardQtySnapshot || 0 : 0,
          line ? line.previouslyDispatchedQtySnapshot || 0 : 0,
          line ? line.dispatchQty || 0 : 0,
          line ? line.remainingAfterDispatchSnapshot || 0 : 0,
          line ? (line.unit || 'piece').toUpperCase() : 'PIECE',
          outw.vehicleNumber || outw.vehicleNo || '—',
          outw.driverName || '—',
          outw.transporterNameSnapshot || (outw.transporterVendorId ? 'Transporter' : 'In-House Logistics'),
          outw.destination || '—',
          (outw.status || 'posted').toUpperCase()
        ]);

        row.height = 20;

        if (line) {
          totalOrderedQty += Number(line.orderedQtySnapshot) || 0;
          totalInwardQty += Number(line.cumulativeInwardQtySnapshot) || 0;
          totalPrevDispatchedQty += Number(line.previouslyDispatchedQtySnapshot) || 0;
          const disp = Number(line.dispatchQty) || 0;
          if (line.unit === 'kg') {
            totalKgDispatched += disp;
          } else {
            totalPiecesDispatched += disp;
          }
          totalRemainingQty += Number(line.remainingAfterDispatchSnapshot) || 0;
        }

        // Cell borders and alignments
        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Calibri', size: 9 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // Numbers alignment (ordered, inward, prev, dispatch, remaining)
          if (colNumber >= 12 && colNumber <= 16) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
            cell.numFmt = '#,##0.00';
          } else if (colNumber === 2 || colNumber === 17 || colNumber === 22) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });

        // Highlight dispatch qty column with a soft blue tint
        const dispatchCell = row.getCell(15);
        dispatchCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1F4E79' } };
        dispatchCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F7FF' }
        };

        rowIndex++;
      }

      const endRowForOutw = rowIndex - 1;

      // Merge common columns across colour lines for this outward dispatch
      if (endRowForOutw > startRowForOutw) {
        const columnsToMerge = [1, 2, 3, 4, 5, 6, 7, 8, 9, 18, 19, 20, 21, 22];
        columnsToMerge.forEach((colIdx) => {
          worksheet.mergeCells(startRowForOutw, colIdx, endRowForOutw, colIdx);
          const topCell = worksheet.getCell(startRowForOutw, colIdx);
          topCell.alignment = {
            vertical: 'middle',
            horizontal: [1, 2, 22].includes(colIdx) ? 'center' : 'left'
          };
        });
      }
    }

    // --- 4. Grand Total Summary Row ---
    worksheet.addRow([]); // Blank spacing row
    const totalRow = worksheet.addRow([
      'TOTAL DISPATCHES',
      `${params.outwards.length} Dispatches`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'GRAND TOTAL:',
      totalOrderedQty,
      totalInwardQty,
      totalPrevDispatchedQty,
      totalPiecesDispatched,
      totalRemainingQty,
      totalKgDispatched > 0 ? 'PCS / KG' : 'PCS',
      '',
      '',
      '',
      '',
      ''
    ]);

    totalRow.height = 24;
    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E79' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' } // Light slate-100
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1F4E79' } },
        bottom: { style: 'double', color: { argb: 'FF1F4E79' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (colNumber >= 12 && colNumber <= 16) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
      } else if (colNumber === 17) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colNumber <= 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if (colNumber === 11) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    if (totalKgDispatched > 0) {
      const kgRow = worksheet.addRow([
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
        'TOTAL WEIGHT (KG):',
        '',
        '',
        '',
        totalKgDispatched,
        '',
        'KG',
        '',
        '',
        '',
        '',
        ''
      ]);
      kgRow.height = 22;
      kgRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1F4E79' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' } // Light soft slate-50
        };
        cell.border = {
          bottom: { style: 'medium', color: { argb: 'FF1F4E79' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        if (colNumber === 15) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00';
        } else if (colNumber === 17) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colNumber === 11) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
    }

    // --- 5. Column Widths ---
    worksheet.columns = [
      { width: 18 }, // Outward No
      { width: 14 }, // Date
      { width: 18 }, // DC No
      { width: 26 }, // Customer Name
      { width: 22 }, // Subcontractor
      { width: 18 }, // PO Number
      { width: 18 }, // Style Number
      { width: 20 }, // Item Description
      { width: 16 }, // Process Category
      { width: 18 }, // Colour Name
      { width: 16 }, // Wash/Process
      { width: 14 }, // Ordered Qty
      { width: 14 }, // Inward Qty
      { width: 14 }, // Prev Dispatched
      { width: 16 }, // Dispatch Qty
      { width: 14 }, // Remaining
      { width: 10 }, // Unit
      { width: 18 }, // Vehicle
      { width: 18 }, // Driver
      { width: 22 }, // Transporter
      { width: 22 }, // Destination
      { width: 14 }  // Status
    ];

    // --- 6. Save & Download ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const fileName = `Outward_Detailed_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /**
   * 2. Export Summary Only:
   * Generates a single-row-per-dispatch Excel sheet with totals and logistics info.
   */
  static async exportSummaryOnly(params: OutwardReportExcelParams): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Perla ERP';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Outward Dispatches Summary', {
      views: [{ showGridLines: true }]
    });

    // Header
    worksheet.mergeCells('A1:P1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'PERLA TEXTILES PROCESSOR - OUTWARD DISPATCHES SUMMARY REPORT';
    titleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' }
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 28;

    worksheet.mergeCells('A2:P2');
    const subTitle = worksheet.getCell('A2');
    subTitle.value = `Generated On: ${formatDate(new Date().toISOString())} | Total Dispatches: ${params.outwards.length}`;
    subTitle.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF555555' } };
    subTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 18;

    const headers = [
      'Outward No',
      'Outward Date',
      'Our DC No',
      'Customer Name',
      'Subcontractor Unit',
      'PO Number',
      'Style Number',
      'Item Description',
      'Process Category',
      'Total Pieces',
      'Total Weight (Kg)',
      'Vehicle Number',
      'Driver Name',
      'Transporter',
      'Destination',
      'Status'
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }
      };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0D2840' } },
        bottom: { style: 'medium', color: { argb: 'FF0D2840' } }
      };
    });

    let totalPcs = 0;
    let totalKg = 0;

    params.outwards.forEach((outw) => {
      const pcs = outw.totalQtyByUnit?.piece || 0;
      const kg = outw.totalQtyByUnit?.kg || 0;
      totalPcs += pcs;
      totalKg += kg;

      const row = worksheet.addRow([
        outw.outwardNo || '—',
        outw.outwardDate ? formatDate(outw.outwardDate) : '—',
        outw.ourDcNo || '—',
        outw.customerCompanyNameSnapshot || outw.customerName || '—',
        outw.subcontractorNameSnapshot || outw.subContractorName || 'Direct Delivery',
        outw.poNumberSnapshot || outw.poNumber || '—',
        outw.styleNoSnapshot || outw.styleNo || '—',
        outw.itemNameSnapshot || outw.itemName || 'Garments',
        (outw.processCategorySnapshot || outw.processCategory || 'washing').toUpperCase(),
        pcs,
        kg,
        outw.vehicleNumber || outw.vehicleNo || '—',
        outw.driverName || '—',
        outw.transporterNameSnapshot || (outw.transporterVendorId ? 'Transporter' : 'In-House Logistics'),
        outw.destination || '—',
        (outw.status || 'posted').toUpperCase()
      ]);

      row.height = 19;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 9 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        if (colNumber === 10 || colNumber === 11) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = colNumber === 11 ? '#,##0.00' : '#,##0';
        } else if ([2, 16].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    // Grand total
    const totRow = worksheet.addRow([
      'TOTAL DISPATCHES',
      `${params.outwards.length} Dispatches`,
      '',
      '',
      '',
      '',
      '',
      '',
      'GRAND TOTAL:',
      totalPcs,
      totalKg,
      '',
      '',
      '',
      '',
      ''
    ]);
    totRow.height = 24;
    totRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E79' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' } // Light slate-100
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF1F4E79' } },
        bottom: { style: 'double', color: { argb: 'FF1F4E79' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (colNumber === 10 || colNumber === 11) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = colNumber === 11 ? '#,##0.00' : '#,##0';
      } else if (colNumber === 9) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber <= 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    worksheet.columns = [
      { width: 18 }, // Outward No
      { width: 14 }, // Date
      { width: 18 }, // DC No
      { width: 26 }, // Customer Name
      { width: 22 }, // Subcontractor
      { width: 18 }, // PO Number
      { width: 18 }, // Style Number
      { width: 20 }, // Item Description
      { width: 16 }, // Process Category
      { width: 14 }, // Total Pieces
      { width: 16 }, // Total Kg
      { width: 18 }, // Vehicle
      { width: 18 }, // Driver
      { width: 22 }, // Transporter
      { width: 22 }, // Destination
      { width: 14 }  // Status
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const fileName = `Outward_Summary_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}

