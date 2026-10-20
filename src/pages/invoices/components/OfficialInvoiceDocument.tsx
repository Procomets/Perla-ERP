import React, { useState, useEffect } from 'react';
import { Invoice, CompanyInvoiceSettings } from '../../../types/invoice';
import { formatDate } from '../../../utils/formatters';
import { InvoiceSettingsService } from '../../../services/invoiceSettingsService';

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
      hsnSac: line.hsnSac || '998821',
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

  let wordsText = invoice.amountInWords || 'Fifty-Seven Thousand Five Hundred and Forty-Four';
  wordsText = wordsText.replace(/^Rupees\s*/i, '').replace(/\s*Only$/i, '');
  const fullWordsStr = `INR - ${wordsText.toUpperCase()} RUPEES ONLY.`;

  const totalGst =
    (Number(invoice.totalCgst) || 0) +
    (Number(invoice.totalSgst) || 0) +
    (Number(invoice.totalIgst) || 0);

  return (
    <div className="bg-white text-black text-[11px] leading-tight font-sans select-text border border-black max-w-[840px] mx-auto shadow-sm">
      {/* 1. TOP TITLE BAR */}
      <div className="border-b border-black text-center py-1 font-bold text-xs tracking-wider uppercase bg-white relative">
        <span>INVOICE</span>
        {isDraft && (
          <span className="absolute right-2 top-1 text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded">
            DRAFT PREVIEW
          </span>
        )}
      </div>

      {/* 2. ISSUER DETAILS & METADATA GRID */}
      <div className="grid grid-cols-12 border-b border-black">
        {/* Left Issuer Box (7 cols ~ 58%) */}
        <div className="col-span-7 p-2.5 border-r border-black space-y-0.5">
          <h2 className="font-bold text-[13px] tracking-wide text-black uppercase">
            {companyName}
          </h2>
          <p className="text-[11px] text-black">
            {addressLine1}
          </p>
          {addressLine2 && (
            <p className="text-[11px] text-black">
              {addressLine2}
            </p>
          )}
          <p className="text-[11px] text-black">
            {city}-{pincode}
          </p>
          <div className="pt-1 text-[11px] font-bold space-y-0.5">
            <p>TIN: {tin}</p>
            <p>CST: {cst}</p>
            <p>GST ID : {gstin}</p>
          </div>
          <p className="pt-0.5 text-[11px]">
            STATE- {state}. &nbsp;Code No-
            {stateCode}
          </p>
        </div>

        {/* Right Metadata Grid (5 cols ~ 42%) */}
        <div className="col-span-5 grid grid-cols-2 grid-rows-2">
          {/* Row 1, Col 1: Invoice No */}
          <div className="p-2 border-r border-b border-black flex flex-col justify-between">
            <span className="text-[10px] text-black">Invoice No.</span>
            <span className="font-bold text-[11px] font-mono mt-1 text-black">
              {invoice.invoiceNo || invoice.invoiceNumber || 'PTP/1182/2025-26'}
            </span>
          </div>

          {/* Row 1, Col 2: Dated */}
          <div className="p-2 border-b border-black flex flex-col justify-between">
            <span className="text-[10px] text-black">Dated</span>
            <span className="font-bold text-[11px] mt-1 text-black">
              {formatDate(invoice.invoiceDate)}
            </span>
          </div>

          {/* Row 2, Col 1: W.O Number */}
          <div className="p-2 border-r border-black flex flex-col justify-between">
            <span className="text-[10px] text-black">W.O Number</span>
            <span className="font-bold text-[11px] font-mono mt-1 text-black">
              {invoice.poNumber || 'PP217'}
            </span>
          </div>

          {/* Row 2, Col 2: Style */}
          <div className="p-2 flex flex-col justify-between">
            <span className="text-[10px] text-black">Style</span>
            <span className="font-bold text-[11px] mt-1 text-black">
              {displayStyle}
            </span>
          </div>
        </div>
      </div>

      {/* 3. BUYER BLOCK & MODE/TERMS OF PAYMENT */}
      <div className="grid grid-cols-12 border-b border-black">
        {/* Left: Buyer (7 cols) */}
        <div className="col-span-7 p-2.5 border-r border-black space-y-0.5">
          <div className="font-bold text-[11px] uppercase tracking-wide">BUYER</div>
          <p className="font-bold text-[12px] text-black uppercase mt-0.5">
            {invoice.customerSnapshot?.companyName || 'SREE KUMAR TEXIND CORPORATION'}
          </p>
          <p className="text-[11px] uppercase text-black whitespace-pre-line">
            {invoice.customerSnapshot?.address || 'PLOT NO: 5, NUMBAL ROAD, VELAPPANCHAVADI'}
          </p>
          <p className="text-[11px] uppercase text-black">
            {invoice.customerSnapshot?.city || 'CHENNAI'} - 600 077
          </p>
          {invoice.customerSnapshot?.phone && (
            <p className="text-[11px] text-black">PH-{invoice.customerSnapshot.phone}</p>
          )}
          <div className="pt-1">
            <p className="font-bold text-[11px]">
              GST ID : {invoice.customerSnapshot?.gstin || '33AACFS4987J1ZS'}
            </p>
            <p className="text-[11px]">
              STATE- {invoice.customerSnapshot?.state || 'Tamil Nadu'}. &nbsp;Code No-
              {invoice.customerSnapshot?.stateCode || '33'}
            </p>
          </div>
        </div>

        {/* Right: Terms of Payment (5 cols) */}
        <div className="col-span-5 p-2.5 flex flex-col justify-between">
          <div>
            <div className="font-bold text-[11px]">Mode/Terms of Payment</div>
            <div className="text-[11px] text-black mt-1">Against Delivery / 30 Days</div>
          </div>
          <div className="pt-2 text-[10px] text-slate-500 font-mono">
            Place of Supply: {invoice.customerSnapshot?.state || 'Tamil Nadu'}
          </div>
        </div>
      </div>

      {/* 4. LINE ITEMS TABLE (Exact Match to PDF Grid) */}
      <div className="overflow-x-auto border-b border-black">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-black text-center font-bold text-black uppercase text-[10px] bg-white">
              <th className="border-r border-black py-1.5 px-1.5 w-10 text-center">S.No</th>
              <th className="border-r border-black py-1.5 px-2 text-left">DESCRIPTION</th>
              <th className="border-r border-black py-1.5 px-1.5 w-18 text-center">HSN/SAC</th>
              <th className="border-r border-black py-1.5 px-2 text-left">COLOUR</th>
              <th className="border-r border-black py-1.5 px-2 text-center">PROCESS</th>
              <th className="border-r border-black py-1.5 px-1.5 w-20 text-right">QTY</th>
              <th className="border-r border-black py-1.5 px-1.5 w-16 text-right">TTL WGT</th>
              <th className="border-r border-black py-1.5 px-1.5 w-16 text-right">RATE</th>
              <th className="py-1.5 px-2 w-24 text-right">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {lineRows.map((row) => (
              <tr key={row.sNo} className="border-b border-black">
                <td className="border-r border-black py-1.5 px-1.5 text-center font-mono">{row.sNo}</td>
                <td className="border-r border-black py-1.5 px-2 font-semibold text-black">{row.description}</td>
                <td className="border-r border-black py-1.5 px-1.5 text-center font-mono">{row.hsnSac}</td>
                <td className="border-r border-black py-1.5 px-2 text-black">{row.colour}</td>
                <td className="border-r border-black py-1.5 px-2 text-center text-black">{row.process}</td>
                <td className="border-r border-black py-1.5 px-1.5 text-right font-mono font-medium">{row.qty}</td>
                <td className="border-r border-black py-1.5 px-1.5 text-right font-mono">{row.ttlWgt}</td>
                <td className="border-r border-black py-1.5 px-1.5 text-right font-mono">{row.rate}</td>
                <td className="py-1.5 px-2 text-right font-mono font-semibold">{row.amount}</td>
              </tr>
            ))}

            {/* TOTAL ROW */}
            <tr className="font-bold text-black bg-white">
              <td className="border-r border-black py-1.5 px-1.5"></td>
              <td className="border-r border-black py-1.5 px-2 text-right font-bold tracking-wider">TOTAL</td>
              <td className="border-r border-black py-1.5 px-1.5"></td>
              <td className="border-r border-black py-1.5 px-2"></td>
              <td className="border-r border-black py-1.5 px-2"></td>
              <td className="border-r border-black py-1.5 px-1.5 text-right font-mono font-bold">{totalQtyStr}</td>
              <td className="border-r border-black py-1.5 px-1.5"></td>
              <td className="border-r border-black py-1.5 px-1.5"></td>
              <td className="py-1.5 px-2 text-right font-mono font-bold">{totalAmountStr}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 5. BOTTOM SECTION: Bank Details + Words (Left) & Tax Summary + Signatory (Right) */}
      <div className="grid grid-cols-12">
        {/* Left Bottom Box (7 cols) */}
        <div className="col-span-7 border-r border-black flex flex-col justify-between">
          <div className="p-2 space-y-2">
            {/* Amount in words */}
            <div>
              <div className="font-bold text-[10px] text-black">
                Total Amount Chargeable (in Words)
              </div>
              <div className="font-bold text-[11px] text-black mt-0.5 leading-snug">
                {fullWordsStr}
              </div>
            </div>

            <div className="border-t border-black pt-1.5 space-y-0.5">
              <div className="font-bold text-[11px] text-black">
                BANK DETAILS: ({bankName})
              </div>
              <div className="grid grid-cols-12 text-[10px] pt-0.5">
                <span className="col-span-5 text-black">Bank Account Number</span>
                <span className="col-span-7 font-mono font-bold text-black">
                  : {accountNumber}
                </span>
                <span className="col-span-5 text-black">IFS Code</span>
                <span className="col-span-7 font-mono font-bold text-black">
                  : {ifscCode}
                </span>
                <span className="col-span-5 text-black">COMPANY'S PAN</span>
                <span className="col-span-7 font-mono font-bold text-black">
                  : {pan}
                </span>
              </div>
            </div>
          </div>

          {/* Declaration */}
          <div className="border-t border-black p-2 bg-white">
            <div className="font-bold text-[10px] text-black">Declaration</div>
            <p className="text-[10px] italic text-black leading-tight mt-0.5">
              {declaration}
            </p>
          </div>
        </div>

        {/* Right Bottom Box (5 cols): Tax Summary & Signatory */}
        <div className="col-span-5 flex flex-col justify-between">
          {/* Tax Summary Table */}
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-black font-bold">
                <th className="py-1 px-2 text-right border-r border-black" colSpan={1}>E. &amp; O.E</th>
                <th className="py-1 px-2 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              <tr>
                <td className="py-1 px-2 text-left border-r border-black">Total Amount without Tax</td>
                <td className="py-1 px-2 text-right font-mono font-semibold">
                  {(Number(invoice.subtotal) || 0).toFixed(2)}
                </td>
              </tr>

              {isIntraState ? (
                <>
                  <tr>
                    <td className="py-1 px-2 text-left border-r border-black">
                      Add : CGST {(invoice.cgstRate || 2.5).toFixed(2)}%
                    </td>
                    <td className="py-1 px-2 text-right font-mono">
                      {(Number(invoice.totalCgst) || 0).toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-2 text-left border-r border-black">
                      Add : SGST {(invoice.sgstRate || 2.5).toFixed(2)}%
                    </td>
                    <td className="py-1 px-2 text-right font-mono">
                      {(Number(invoice.totalSgst) || 0).toFixed(2)}
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td className="py-1 px-2 text-left border-r border-black">
                    Add : IGST {(invoice.igstRate || 5.0).toFixed(2)}%
                  </td>
                  <td className="py-1 px-2 text-right font-mono">
                    {(Number(invoice.totalIgst) || 0).toFixed(2)}
                  </td>
                </tr>
              )}

              <tr>
                <td className="py-1 px-2 text-left border-r border-black font-medium">Total Tax Amount : GST</td>
                <td className="py-1 px-2 text-right font-mono font-medium">{totalGst.toFixed(2)}</td>
              </tr>

              <tr>
                <td className="py-1 px-2 text-left border-r border-black">Round Off</td>
                <td className="py-1 px-2 text-right font-mono font-medium">
                  {(Number(invoice.roundOff) || 0).toFixed(2)}
                </td>
              </tr>

              <tr className="font-bold bg-slate-50/60">
                <td className="py-1.5 px-2 text-left border-r border-black text-[11px]">Total Amount with Tax</td>
                <td className="py-1.5 px-2 text-right font-mono text-[11px] font-bold">
                  {(Number(invoice.finalTotal) || 0).toFixed(2)}
                </td>
              </tr>

              <tr>
                <td className="py-1 px-2 text-left border-r border-black text-[9px] text-slate-700">
                  GST Payable On Reverse Charge
                </td>
                <td className="py-1 px-2 text-right text-[9px]">N.A.</td>
              </tr>
            </tbody>
          </table>

          {/* Signatory Box */}
          <div className="border-t border-black p-2 text-center flex flex-col justify-between min-h-[70px] bg-white">
            <div className="font-bold text-[10px] text-black">
              FOR {companyName.toUpperCase()}
            </div>

            <div className="text-[10px] text-black pt-6">{signatoryName}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
