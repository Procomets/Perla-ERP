import { PurchaseOrder } from '../types/po';
import { InwardEntry, OutwardEntry, StatementColourSummary } from '../types/inwardOutward';

/**
 * Quantity logic rules as per Perla ERP functional specs:
 * 1. Cumulative Inward = Sum of all inward receipt quantities for a specific PO/style/colour line.
 * 2. Inward Balance = Ordered Quantity - Cumulative Inward.
 * 3. Cumulative Outward = Sum of all outward dispatch quantities for a specific PO/style/colour line.
 * 4. Dispatchable Quantity = Cumulative Inward Quantity - Cumulative Outward Quantity.
 * 5. Statement Difference = Cumulative Inward - Cumulative Outward.
 * 6. Ready For Invoice = (Cumulative Inward == Cumulative Outward) AND (Cumulative Inward > 0).
 */

export function calculateStatementSummaries(
  pos: PurchaseOrder[],
  inwards: InwardEntry[],
  outwards: OutwardEntry[],
  approvedPoLineIds: string[] = [],
  invoicedPoLineIds: string[] = []
): StatementColourSummary[] {
  const summaries: StatementColourSummary[] = [];

  pos.forEach((po) => {
    po.lines.forEach((line) => {
      // Calculate cumulative inward for this line
      let totalInward = 0;
      inwards.forEach((inEntry) => {
        if (inEntry.poId === po.id || inEntry.poNumber === po.poNumber) {
          inEntry.lines.forEach((inLine) => {
            if (inLine.poLineId === line.lineId || inLine.colour === line.colourName) {
              totalInward += Number(inLine.receivedQty) || 0;
            }
          });
        }
      });

      // Calculate cumulative outward for this line
      let totalOutward = 0;
      outwards.forEach((outEntry) => {
        if (outEntry.poId === po.id || outEntry.poNumber === po.poNumber) {
          outEntry.lines.forEach((outLine) => {
            if (outLine.poLineId === line.lineId || outLine.colour === line.colourName) {
              totalOutward += Number(outLine.dispatchQty) || 0;
            }
          });
        }
      });

      const difference = totalInward - totalOutward;
      const isReadyForInvoice = totalInward > 0 && totalInward === totalOutward;
      const isApprovedForInvoice = approvedPoLineIds.includes(line.lineId);
      const isInvoiced = invoicedPoLineIds.includes(line.lineId);

      summaries.push({
        poId: po.id,
        poNumber: po.poNumber,
        styleNo: po.styleNo,
        itemName: po.itemName,
        poLineId: line.lineId,
        colour: line.colourName,
        processType: line.processType,
        unit: line.unit,
        orderedQty: line.quantity,
        rate: line.rate,
        cumulativeInward: totalInward,
        cumulativeOutward: totalOutward,
        difference,
        isReadyForInvoice,
        isApprovedForInvoice,
        isInvoiced
      });
    });
  });

  return summaries;
}
