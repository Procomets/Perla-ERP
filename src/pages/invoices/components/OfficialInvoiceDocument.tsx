import React, { useState, useEffect } from 'react';
import { Invoice, CompanyInvoiceSettings } from '../../../types/invoice';
import { formatDate } from '../../../utils/formatters';
import { InvoiceSettingsService } from '../../../services/invoiceSettingsService';
import { POService } from '../../../services/poService';
import { convertNumberToIndianWords } from '../../../utils/taxCalculations';

interface OfficialInvoiceDocumentProps {
  invoice: Invoice;
  isDraft?: boolean;
  settings?: CompanyInvoiceSettings;
}

export const OfficialInvoiceDocument: React.FC<OfficialInvoiceDocumentProps> = ({
  invoice,
  isDraft = false,
  settings: propSettings
}) => {
  const [liveSettings, setLiveSettings] = useState<CompanyInvoiceSettings | null>(propSettings || null);
  const [resolvedWoNumber, setResolvedWoNumber] = useState<string>(
    invoice.customerPoNumber || invoice.woNumber || ''
  );

  useEffect(() => {
    if (propSettings) {
      setLiveSettings(propSettings);
      return;
    }

    // Subscribe to live Tax & Issuer settings directly from Firebase generalSettings
    const unsubscribe = InvoiceSettingsService.subscribeSettings(
      (settings) => {
        setLiveSettings(settings);
      },
      () => {
        // Fallback to one-time fetch
        InvoiceSettingsService.getSettings().then(setLiveSettings).catch(() => {});
      }
    );

    return () => unsubscribe();
  }, [propSettings]);

  useEffect(() => {
    if (invoice.customerPoNumber || invoice.woNumber) {
      setResolvedWoNumber(invoice.customerPoNumber || invoice.woNumber || '');
      return;
    }

    let isMounted = true;
    const poNum = invoice.poNumber || (invoice.poNumbers && invoice.poNumbers[0]) || '';
    const poId = (invoice.purchaseOrderIds && invoice.purchaseOrderIds[0]) || '';

    if (!poNum && !poId) {
      setResolvedWoNumber('');
      return;
    }

    async function loadCustomerPoNumber() {
      try {
        let customerPoNum = '';
        if (poId) {
          const res = await POService.getPurchaseOrderById(poId);
          if (res?.po?.customerPoNumber) {
            customerPoNum = res.po.customerPoNumber;
          }
        }
        if (!customerPoNum && poNum) {
          const res = await POService.getPurchaseOrders({ searchQuery: poNum }, { page: 1, pageSize: 5 });
          const matched = res.pos.find((p) => p.poNumber === poNum || p.id === poNum || p.poId === poNum);
          if (matched?.customerPoNumber) {
            customerPoNum = matched.customerPoNumber;
          }
        }
        if (isMounted) {
          setResolvedWoNumber(customerPoNum || '');
        }
      } catch (err) {
        console.warn('Could not load customer PO number for invoice W.O Number:', err);
        if (isMounted) {
          setResolvedWoNumber('');
        }
      }
    }

    loadCustomerPoNumber();
    return () => {
      isMounted = false;
    };
  }, [invoice.id, invoice.poNumber, invoice.purchaseOrderIds, invoice.customerPoNumber, invoice.woNumber]);

  const activeSettings = propSettings || liveSettings;

  // Resolved issuer details from Firebase (falling back to invoice snapshot)
  const companyName = activeSettings?.companyName || invoice.issuerSnapshot?.companyName || 'PERLA TEXTILES PROCESSOR';
  const addressLine1 = activeSettings?.addressLine1 || invoice.issuerSnapshot?.addressLine1 || 'NO.107, INDUSTRIAL ESTATE';
  const addressLine2 = activeSettings?.addressLine2 ?? invoice.issuerSnapshot?.addressLine2 ?? 'THIRUMUDIVAKKAM, SIDCO';
  const city = activeSettings?.city || invoice.issuerSnapshot?.city || 'CHENNAI';
  const pincode = activeSettings?.pincode || invoice.issuerSnapshot?.pincode || '600044';
  const tin = activeSettings?.tin || invoice.issuerSnapshot?.tin || '33916280923';
  const cst = activeSettings?.cst || invoice.issuerSnapshot?.cst || '1299271/02-01-2015';
  const gstin = activeSettings?.gstin || invoice.issuerSnapshot?.gstin || '33AMMPK2032Q1ZU';
  const state = activeSettings?.state || invoice.issuerSnapshot?.state || 'Tamil Nadu';
  const stateCode = activeSettings?.stateCode || invoice.issuerSnapshot?.stateCode || '33';
  const pan = activeSettings?.pan || invoice.issuerSnapshot?.pan || 'AMMPK2032Q';

  // Resolved bank details from Firebase (falling back to invoice snapshot)
  const bankName = (activeSettings?.bankName || invoice.bankDetailsSnapshot?.bankName || 'STATE BANK OF INDIA').toUpperCase();
  const accountNumber = activeSettings?.accountNumber || invoice.bankDetailsSnapshot?.accountNumber || '30407742234';
  const ifscCode = activeSettings?.ifscCode || invoice.bankDetailsSnapshot?.ifscCode || 'SBIN0012931';
  const declaration = activeSettings?.declaration || invoice.declarationSnapshot || 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.';
  const signatoryName = activeSettings?.signatoryName || 'Authorised Signatory';

  // Check GST type
  const isWithoutGst = Boolean(
    invoice.isWithoutGst ||
    invoice.gstType === 'without_gst' ||
    (Number(invoice.totalCgst) === 0 && Number(invoice.totalSgst) === 0 && Number(invoice.totalIgst) === 0 && Number(invoice.cgstRate) === 0)
  );

  const isIntraState =
    (invoice.customerSnapshot?.stateCode === '33' ||
      invoice.customerSnapshot?.state?.toLowerCase().includes('tamil nadu')) &&
    (invoice.totalIgst === 0 || !invoice.totalIgst);

  let totalQuantity = 0;
  const lineRows = (invoice.lines || []).map((line, idx) => {
    totalQuantity += Number(line.qty) || 0;
    const desc = (line.itemNameSnapshot || invoice.styleNo || 'MENS SHIRT').toUpperCase();
    const col = (line.colour || '').toUpperCase();
    const proc = (line.process || 'SOFTNER WASH').toUpperCase();
    const qtyStr = (Number(line.qty) || 0).toFixed(2);
    const ttlWgt = line.billableWeightKg ? Number(line.billableWeightKg).toFixed(2) : '-';
    const rateStr = (Number(line.rate) || 0).toFixed(2);
    const amtStr = (Number(line.amount) || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return {
      sNo: idx + 1,
      description: desc,
      hsnSac: line.hsnSac || (line as any).hsnNo || '998821',
      colour: col,
      process: proc,
      qty: qtyStr,
      ttlWgt,
      rate: rateStr,
      amount: amtStr
    };
  });

  const totalQtyStr = totalQuantity.toFixed(2);
  const totalAmountStr = (Number(invoice.subtotal) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const displayStyle = invoice.styleNo
    ? invoice.styleNo.startsWith('#')
      ? invoice.styleNo
      : `#${invoice.styleNo}`
    : '#082375221';

  const modeOfPayment = invoice.modeOfPayment || invoice.paymentTerms || 'Against Delivery / 30 Days';

  // Final Total calculation based on GST status
  const finalTotalAmount = isWithoutGst
    ? Number(invoice.subtotal) || 0
    : Number(invoice.finalTotal) || 0;

  // Words computation
  let wordsText = '';
  if (isWithoutGst) {
    wordsText = convertNumberToIndianWords(finalTotalAmount);
  } else {
    wordsText = invoice.amountInWords || convertNumberToIndianWords(finalTotalAmount);
  }
  wordsText = wordsText.replace(/^Rupees\s*/i, '').replace(/\s*Only$/i, '');
  const fullWordsStr = `INR - ${wordsText.toUpperCase()} RUPEES ONLY.`;

  const totalGst = isWithoutGst
    ? 0
    : (Number(invoice.totalCgst) || 0) +
      (Number(invoice.totalSgst) || 0) +
      (Number(invoice.totalIgst) || 0);

  return (
    <div className="bg-white text-black text-xs sm:text-[13px] leading-tight font-sans select-text border border-black max-w-[900px] w-full mx-auto shadow-sm">
      {/* 1. TOP TITLE BAR */}
      <div className="border-b border-black text-center py-2 font-bold text-base sm:text-lg tracking-wider uppercase bg-white relative">
        <span>INVOICE</span>
        {isDraft && (
          <div className="absolute right-2 top-1.5 flex items-center gap-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-800 border border-neutral-300 rounded uppercase">
              DRAFT PREVIEW
            </span>
          </div>
        )}
      </div>

      {/* 2. ISSUER DETAILS & METADATA GRID */}
      <div className="grid grid-cols-12 border-b border-black">
        {/* Left Issuer Box (7 cols ~ 58%) */}
        <div className="col-span-7 p-3 border-r border-black space-y-1">
          <h2 className="font-extrabold text-base sm:text-lg tracking-wide text-black uppercase">
            {companyName}
          </h2>
          <p className="text-xs sm:text-[13px] text-black">
            {addressLine1}
          </p>
          {addressLine2 && (
            <p className="text-xs sm:text-[13px] text-black">
              {addressLine2}
            </p>
          )}
          <p className="text-xs sm:text-[13px] text-black">
            {city}-{pincode}
          </p>
          <div className="pt-1 text-xs sm:text-[13px] font-bold space-y-0.5">
            <p>TIN: {tin}</p>
            <p>CST: {cst}</p>
            <p>GST ID : {gstin}</p>
          </div>
          <p className="pt-0.5 text-xs sm:text-[13px]">
            STATE- {state}. &nbsp;Code No- {stateCode}
          </p>
        </div>

        {/* Right Metadata Grid (5 cols ~ 42%) */}
        <div className="col-span-5 grid grid-cols-2 grid-rows-2">
          {/* Row 1, Col 1: Invoice No */}
          <div className="p-2.5 border-r border-b border-black flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-600">Invoice No.</span>
            <span className="font-black text-xs sm:text-sm font-mono mt-1 text-black">
              {invoice.invoiceNo || invoice.invoiceNumber || 'PTP/2026-27/0001'}
            </span>
          </div>

          {/* Row 1, Col 2: Dated */}
          <div className="p-2.5 border-b border-black flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-600">Dated</span>
            <span className="font-bold text-xs sm:text-sm mt-1 text-black">
              {formatDate(invoice.invoiceDate)}
            </span>
          </div>

          {/* Row 2, Col 1: W.O Number */}
          <div className="p-2.5 border-r border-black flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-600">W.O Number</span>
            <span className="font-black text-xs sm:text-sm font-mono mt-1 text-black">
              {resolvedWoNumber || '—'}
            </span>
          </div>

          {/* Row 2, Col 2: Style */}
          <div className="p-2.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-600">Style</span>
            <span className="font-bold text-xs sm:text-sm mt-1 text-black">
              {displayStyle}
            </span>
          </div>
        </div>
      </div>

      {/* 3. BUYER BLOCK & MODE/TERMS OF PAYMENT */}
      <div className="grid grid-cols-12 border-b border-black">
        {/* Left: Buyer (7 cols) */}
        <div className="col-span-7 p-3 border-r border-black space-y-1">
          <div className="font-bold text-xs sm:text-[13px] uppercase tracking-wider text-slate-700">BUYER</div>
          <p className="font-extrabold text-sm sm:text-base text-black uppercase mt-0.5">
            {invoice.customerSnapshot?.companyName || 'CUSTOMER COMPANY'}
          </p>
          <p className="text-xs sm:text-[13px] uppercase text-black whitespace-pre-line">
            {invoice.customerSnapshot?.address || 'CUSTOMER ADDRESS'}
          </p>
          <p className="text-xs sm:text-[13px] uppercase text-black">
            {invoice.customerSnapshot?.city || 'CHENNAI'} - 600 077
          </p>
          {invoice.customerSnapshot?.phone && (
            <p className="text-xs sm:text-[13px] text-black">PH: {invoice.customerSnapshot.phone}</p>
          )}
          <div className="pt-1 space-y-0.5">
            <p className="font-bold text-xs sm:text-[13px]">
              GST ID : {invoice.customerSnapshot?.gstin || '33AACFS4987J1ZS'}
            </p>
            <p className="text-xs sm:text-[13px]">
              STATE- {invoice.customerSnapshot?.state || 'Tamil Nadu'}. &nbsp;Code No- {invoice.customerSnapshot?.stateCode || '33'}
            </p>
          </div>
        </div>

        {/* Right: Terms of Payment (5 cols) */}
        <div className="col-span-5 p-3 flex flex-col justify-between">
          <div>
            <div className="font-bold text-xs sm:text-[13px] text-slate-700 uppercase tracking-wider">
              Mode/Terms of Payment
            </div>
            <div className="text-xs sm:text-sm font-bold text-black mt-1">
              {modeOfPayment}
            </div>
          </div>
          <div className="pt-2 text-xs text-slate-600 font-medium">
            Place of Supply: {invoice.customerSnapshot?.state || 'Tamil Nadu'}
          </div>
        </div>
      </div>

      {/* 4. LINE ITEMS TABLE (Exact Match to PDF Grid with larger font) */}
      <div className="overflow-x-auto border-b border-black">
        <table className="w-full text-xs sm:text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-black text-center font-bold text-black uppercase text-xs bg-slate-50/70">
              <th className="border-r border-black py-2 px-2 w-10 text-center">S.No</th>
              <th className="border-r border-black py-2 px-2.5 text-left">DESCRIPTION</th>
              <th className="border-r border-black py-2 px-2 w-20 text-center">HSN/SAC</th>
              <th className="border-r border-black py-2 px-2.5 text-left">COLOUR</th>
              <th className="border-r border-black py-2 px-2.5 text-center">PROCESS</th>
              <th className="border-r border-black py-2 px-2 w-24 text-right">QTY</th>
              <th className="border-r border-black py-2 px-2 w-18 text-right">TTL WGT</th>
              <th className="border-r border-black py-2 px-2 w-20 text-right">RATE</th>
              <th className="py-2 px-2.5 w-28 text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {lineRows.map((row) => (
              <tr key={row.sNo} className="border-b border-black">
                <td className="border-r border-black py-2 px-2 text-center font-mono">{row.sNo}</td>
                <td className="border-r border-black py-2 px-2.5 font-bold text-black">{row.description}</td>
                <td className="border-r border-black py-2 px-2 text-center font-mono">{row.hsnSac}</td>
                <td className="border-r border-black py-2 px-2.5 text-black font-medium">{row.colour}</td>
                <td className="border-r border-black py-2 px-2.5 text-center text-black">{row.process}</td>
                <td className="border-r border-black py-2 px-2 text-right font-mono font-bold">{row.qty}</td>
                <td className="border-r border-black py-2 px-2 text-right font-mono">{row.ttlWgt}</td>
                <td className="border-r border-black py-2 px-2 text-right font-mono font-medium">{row.rate}</td>
                <td className="py-2 px-2.5 text-right font-mono font-bold">{row.amount}</td>
              </tr>
            ))}

            {/* TOTAL ROW */}
            <tr className="font-extrabold text-black bg-slate-50/50">
              <td className="border-r border-black py-2 px-2"></td>
              <td className="border-r border-black py-2 px-2.5 text-right font-bold tracking-wider text-xs sm:text-sm">TOTAL</td>
              <td className="border-r border-black py-2 px-2"></td>
              <td className="border-r border-black py-2 px-2.5"></td>
              <td className="border-r border-black py-2 px-2.5"></td>
              <td className="border-r border-black py-2 px-2 text-right font-mono font-black text-xs sm:text-sm">{totalQtyStr}</td>
              <td className="border-r border-black py-2 px-2"></td>
              <td className="border-r border-black py-2 px-2"></td>
              <td className="py-2 px-2.5 text-right font-mono font-black text-xs sm:text-sm">{totalAmountStr}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. BOTTOM SECTION: Bank Details + Words (Left) & Tax Summary + Signatory (Right) */}
      <div className="grid grid-cols-12">
        {/* Left Bottom Box (7 cols) */}
        <div className="col-span-7 border-r border-black flex flex-col justify-between">
          <div className="p-3 space-y-2.5">
            {/* Amount in words */}
            <div>
              <div className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Total Amount Chargeable (in Words)
              </div>
              <div className="font-black text-xs sm:text-sm text-black mt-1 leading-snug">
                {fullWordsStr}
              </div>
            </div>

            <div className="border-t border-black pt-2 space-y-1">
              <div className="font-bold text-xs sm:text-[13px] text-black">
                BANK DETAILS: ({bankName})
              </div>
              <div className="grid grid-cols-12 text-xs pt-0.5 gap-y-0.5">
                <span className="col-span-5 text-black font-medium">Bank Account Number</span>
                <span className="col-span-7 font-mono font-bold text-black">
                  : {accountNumber}
                </span>
                <span className="col-span-5 text-black font-medium">IFS Code</span>
                <span className="col-span-7 font-mono font-bold text-black">
                  : {ifscCode}
                </span>
                <span className="col-span-5 text-black font-medium">COMPANY'S PAN</span>
                <span className="col-span-7 font-mono font-bold text-black">
                  : {pan}
                </span>
              </div>
            </div>
          </div>

          {/* Declaration */}
          <div className="border-t border-black p-2.5 bg-white">
            <div className="font-bold text-xs text-black">Declaration</div>
            <p className="text-xs italic text-slate-700 leading-tight mt-0.5">
              {declaration}
            </p>
          </div>
        </div>

        {/* Right Bottom Box (5 cols): Tax Summary & Signatory */}
        <div className="col-span-5 flex flex-col justify-between">
          {/* Tax Summary Table */}
          <table className="w-full text-xs sm:text-[12.5px] border-collapse">
            <thead>
              <tr className="border-b border-black font-bold">
                <th className="py-1 px-2 text-right border-r border-black text-xs" colSpan={1}>E. &amp; O.E</th>
                <th className="py-1 px-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              <tr>
                <td className="py-1.5 px-2.5 text-left border-r border-black">Total Amount without Tax</td>
                <td className="py-1.5 px-2 text-right font-mono font-bold">
                  {(Number(invoice.subtotal) || 0).toFixed(2)}
                </td>
              </tr>

              {isWithoutGst ? (
                <>
                  <tr>
                    <td className="py-1.5 px-2.5 text-left border-r border-black text-slate-600">
                      Add : CGST 0.00%
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                      0.00
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 text-left border-r border-black text-slate-600">
                      Add : SGST 0.00%
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                      0.00
                    </td>
                  </tr>
                </>
              ) : isIntraState ? (
                <>
                  <tr>
                    <td className="py-1.5 px-2.5 text-left border-r border-black">
                      Add : CGST {(invoice.cgstRate || 2.5).toFixed(2)}%
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-medium">
                      {(Number(invoice.totalCgst) || 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2.5 text-left border-r border-black">
                      Add : SGST {(invoice.sgstRate || 2.5).toFixed(2)}%
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-medium">
                      {(Number(invoice.totalSgst) || 0).toFixed(2)}
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td className="py-1.5 px-2.5 text-left border-r border-black">
                    Add : IGST {(invoice.igstRate || 5.0).toFixed(2)}%
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono font-medium">
                    {(Number(invoice.totalIgst) || 0).toFixed(2)}
                  </td>
                </tr>
              )}

              <tr>
                <td className="py-1.5 px-2.5 text-left border-r border-black font-semibold">Total Tax Amount : GST</td>
                <td className="py-1.5 px-2 text-right font-mono font-bold">
                  {totalGst.toFixed(2)}
                </td>
              </tr>

              <tr>
                <td className="py-1.5 px-2.5 text-left border-r border-black">Round Off</td>
                <td className="py-1.5 px-2 text-right font-mono font-medium">
                  {isWithoutGst ? '0.00' : (Number(invoice.roundOff) || 0).toFixed(2)}
                </td>
              </tr>

              <tr className="font-extrabold bg-slate-100">
                <td className="py-2 px-2.5 text-left border-r border-black text-xs sm:text-sm font-black">
                  {isWithoutGst ? 'Total Amount' : 'Total Amount with Tax'}
                </td>
                <td className="py-2 px-2 text-right font-mono text-sm sm:text-base font-black">
                  {finalTotalAmount.toFixed(2)}
                </td>
              </tr>

              <tr>
                <td className="py-1 px-2.5 text-left border-r border-black text-[10px] text-slate-600">
                  GST Payable On Reverse Charge
                </td>
                <td className="py-1 px-2 text-right text-[10px] text-slate-600 font-mono">N.A.</td>
              </tr>
            </tbody>
          </table>

          {/* Signatory Box */}
          <div className="border-t border-black p-2.5 text-center flex flex-col justify-between min-h-[85px] bg-white">
            <div className="font-bold text-xs text-black">
              FOR {companyName.toUpperCase()}
            </div>

            <div className="text-xs text-slate-800 font-bold pt-8">{signatoryName}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
