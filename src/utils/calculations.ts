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
      // Calculate cumulative inward for this line (posted entries only)
      let totalInward = 0;
      inwards.forEach((inEntry) => {
        const isPosted = !inEntry.status || inEntry.status === 'posted';
        if (isPosted && (inEntry.poId === po.id || inEntry.poNumber === po.poNumber)) {
          inEntry.lines.forEach((inLine) => {
            if (inLine.poLineId === line.lineId || inLine.colour === line.colourName || inLine.colourNameSnapshot === line.colourName) {
              totalInward += Number(inLine.receivedQty) || 0;
            }
          });
        }
      });

      // Calculate cumulative outward for this line (posted entries only)
      let totalOutward = 0;
      outwards.forEach((outEntry) => {
        const isPosted = !outEntry.status || outEntry.status === 'posted';
        if (isPosted && (outEntry.poId === po.id || outEntry.poNumber === po.poNumber)) {
          outEntry.lines.forEach((outLine) => {
            if (
              outLine.poLineId === line.lineId ||
              outLine.colour === line.colourName ||
              (outLine as any).colourNameSnapshot === line.colourName
            ) {
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

/**
 * Checks whether inward receipts or entries have been entered for a Purchase Order:
 * Returns true ONLY if active non-cancelled/reversed inward entries exist matching PO id or PO number.
 */
export function hasInwardForPO(
  po: PurchaseOrder | null | undefined,
  inwards: InwardEntry[] = []
): boolean {
  if (!po) return false;

  const poId = (po.id || po.poId || '').toLowerCase().trim();
  const poNum = (po.poNumber || '').toLowerCase().trim();

  let candidateInwards = inwards;
  if ((!candidateInwards || candidateInwards.length === 0) && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('perla_erp_inward_entries');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          candidateInwards = parsed;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (!candidateInwards || candidateInwards.length === 0) {
    return false;
  }

  return candidateInwards.some((inw) => {
    if (inw.status === 'reversed' || inw.status === 'cancelled') return false;
    if (['inw-paramount-0001', 'inw-apex-0002', 'inw-101'].includes(inw.id || inw.inwardId)) return false;

    const inwPoId = (inw.poId || '').toLowerCase().trim();
    const inwPoNum = (inw.poNumber || inw.poNumberSnapshot || '').toLowerCase().trim();

    const matchesId =
      poId &&
      inwPoId &&
      (inwPoId === poId ||
        inwPoId === (po.id || '').toLowerCase() ||
        inwPoId === (po.poId || '').toLowerCase());

    const matchesNum =
      poNum &&
      inwPoNum &&
      inwPoNum === poNum &&
      !poNum.includes('pending');

    return Boolean(matchesId || matchesNum);
  });
}
