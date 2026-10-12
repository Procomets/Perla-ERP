import React from 'react';
import { ArrowLeft, Printer, Download, CheckCircle2 } from 'lucide-react';
import { PurchaseOrder } from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { Button } from '../../../components/ui/Button';
import {
  formatCurrency,
  formatQuantity,
  formatDate,
  numberToWordsIndian
} from '../../../utils/formatters';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface POPrintViewProps {
  po: PurchaseOrder;
  customer?: Vendor | null;
  onBack: () => void;
}

export const POPrintView: React.FC<POPrintViewProps> = ({
  po,
  customer,
  onBack
}) => {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();

    // Company Header
    doc.setFontSize(16);
    doc.setTextColor(31, 78, 121); // #1F4E79
    doc.text('PERLA TEXTILES PROCESSOR', 14, 20);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      'Specialized Garment Washing, Dyeing & Finishing Services',
      14,
      26
    );
    doc.text(
      'SIDCO Industrial Estate, Thirumudivakkam, Chennai - 600132, Tamil Nadu',
      14,
      31
    );
    doc.text('GSTIN: 33AAACP8899P1Z4 | Phone: +91 44 2478 1234', 14, 36);

    doc.setDrawColor(200);
    doc.line(14, 40, 196, 40);

    // Title & PO Info
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.text('CUSTOMER WORK ORDER / PURCHASE ORDER', 14, 48);

    doc.setFontSize(10);
    doc.text(`PO Number: ${po.poNumber}`, 14, 55);
    doc.text(`Order Date: ${formatDate(po.orderDate)}`, 14, 61);
    doc.text(`Process Category: ${po.processCategory.toUpperCase()}`, 14, 67);

    doc.text(`Customer: ${po.customerName}`, 120, 55);
    if (po.customerCode) doc.text(`Customer Code: ${po.customerCode}`, 120, 61);
    doc.text(`Style No: ${po.styleNo || po.styleNumber}`, 120, 67);
    doc.text(`Item Description: ${po.itemName}`, 120, 73);

    // Table
    const tableData = po.colourLines.map((line, idx) => [
      idx + 1,
      `${line.colourName}${line.colourCode ? ` (${line.colourCode})` : ''}`,
      line.processType,
      line.quantity.toLocaleString('en-IN'),
      line.unit.toUpperCase(),
      line.rateBasis.replace('_', ' '),
      `Rs. ${line.rate}`,
      `Rs. ${(line.lineAmount || line.amount || 0).toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: 80,
      head: [
        [
          '#',
          'Colour',
          'Wash / Process',
          'Qty',
          'Unit',
          'Rate Basis',
          'Rate',
          'Amount'
        ]
      ],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [31, 78, 121] },
      styles: { fontSize: 8 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.text(
      `Total Order Value: Rs. ${po.totalAmount.toLocaleString('en-IN')}`,
      14,
      finalY
    );
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Amount in words: ${numberToWordsIndian(po.totalAmount)}`,
      14,
      finalY + 6
    );

    // Signatures
    doc.setTextColor(0);
    doc.text('Prepared By', 14, finalY + 30);
    doc.text('Authorized Signatory', 140, finalY + 30);

    doc.save(`${po.poNumber.replace(/\//g, '_')}_WorkOrder.pdf`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Action Toolbar (hidden during print) */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Work Order Document
            </h2>
            <p className="text-xs text-slate-500">{po.poNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownloadPdf}
          >
            Download PDF
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
          >
            Print Order
          </Button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="bg-white p-8 md:p-12 rounded-xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 text-slate-900 space-y-6">
        {/* Header Section */}
        <div className="border-b-2 border-[#1F4E79] pb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#1F4E79] tracking-tight">
              PERLA TEXTILES PROCESSOR
            </h1>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">
              Specialized Garment Washing, Dyeing & Finishing Operations
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Thirumudivakkam Industrial Estate, Chennai - 600132, Tamil Nadu, India
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              GSTIN: 33AAACP8899P1Z4 | Email: operations@perlatextiles.com
            </p>
          </div>

          <div className="sm:text-right">
            <span className="inline-block px-3 py-1 rounded bg-[#EEF5FB] text-[#1F4E79] text-xs font-bold uppercase tracking-wider mb-2">
              Work Order / PO
            </span>
            <div className="text-lg font-black text-slate-900 font-mono">
              {po.poNumber}
            </div>
            {po.revision && po.revision > 1 && (
              <div className="text-[11px] font-bold text-amber-700">
                Revision: {po.revision}
              </div>
            )}
            <div className="text-xs text-slate-500 mt-1">
              Date: <strong>{formatDate(po.orderDate)}</strong>
            </div>
          </div>
        </div>

        {/* Customer & Processing Information Grid */}
        <div className="grid grid-cols-2 gap-6 text-xs border border-slate-200 rounded-lg p-4 bg-slate-50/50">
          <div>
            <h4 className="font-bold text-[#1F4E79] uppercase tracking-wider text-[11px] mb-2 border-b border-slate-200 pb-1">
              Customer Details
            </h4>
            <div className="space-y-1">
              <div className="font-black text-sm text-slate-900">
                {po.customerName}
              </div>
              {po.customerCode && (
                <div className="text-slate-500 font-mono">
                  Code: {po.customerCode}
                </div>
              )}
              {customer?.address && (
                <div className="text-slate-600">
                  {customer.address.addressLine1}, {customer.address.city},{' '}
                  {customer.address.state}
                </div>
              )}
              {customer?.taxDetails?.gstin && (
                <div className="text-slate-500 font-mono">
                  GSTIN: {customer.taxDetails.gstin}
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-bold text-[#1F4E79] uppercase tracking-wider text-[11px] mb-2 border-b border-slate-200 pb-1">
              Work Order Specifications
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block text-[11px]">
                  Process Category:
                </span>
                <strong className="capitalize text-slate-900">
                  {po.processCategory}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">
                  Style Number:
                </span>
                <strong className="font-mono text-slate-900">
                  {po.styleNo || po.styleNumber}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">
                  Item Description:
                </span>
                <strong className="text-slate-900">{po.itemName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">
                  Delivery Date:
                </span>
                <strong className="text-slate-900">
                  {po.deliveryDate ? formatDate(po.deliveryDate) : 'Standard schedule'}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Colour Breakdown Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#1F4E79] text-white uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Colour Specification</th>
                <th className="py-2.5 px-3">Wash / Processing Type</th>
                <th className="py-2.5 px-3 text-right">Order Qty</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3">Rate Basis</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-right">Line Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {po.colourLines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-semibold text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {line.colourName}
                    {line.colourCode && (
                      <span className="text-slate-500 font-mono text-[10px] block">
                        Code: {line.colourCode}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {line.processType}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    {line.quantity.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 uppercase text-slate-600">
                    {line.unit}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 capitalize">
                    {line.rateBasis.replace('_', ' ')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                    {formatCurrency(line.rate)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(line.lineAmount || line.amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-600">
                  Total Quantities:
                </td>
                <td className="py-2.5 px-3 text-right font-black text-[#1F4E79]">
                  {formatQuantity(po.totalQuantity, po.colourLines[0]?.unit || 'piece')}
                </td>
                <td colSpan={2}></td>
                <td className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-600">
                  Grand Total:
                </td>
                <td className="py-2.5 px-3 text-right font-black text-base text-[#1F4E79]">
                  {formatCurrency(po.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Amount in Words */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
          <span className="text-slate-500 font-medium">Amount in words: </span>
          <strong className="text-slate-900 capitalize">
            {numberToWordsIndian(po.totalAmount)}
          </strong>
        </div>

        {/* Special Instructions */}
        {po.customerInstructions && (
          <div className="text-xs space-y-1">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
              Customer Instructions:
            </span>
            <p className="text-slate-600 italic">{po.customerInstructions}</p>
          </div>
        )}

        {/* Terms & Signatures */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs">
          <div className="space-y-1 text-slate-500 text-[11px]">
            <h5 className="font-bold text-slate-700 uppercase text-[10px]">
              Terms of Processing:
            </h5>
            <p>1. Jobwork processing only; fabric loss/shrinkage as per agreed sample tolerance.</p>
            <p>2. Inward and outward material delivery challans must reference this PO number.</p>
            <p>3. Thirumudivakkam, Chennai jurisdiction for all commercial matters.</p>
          </div>

          <div className="flex justify-between items-end pt-8">
            <div className="text-center">
              <div className="w-32 border-b border-slate-400 mb-1"></div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                Customer Signature
              </span>
            </div>
            <div className="text-center">
              <div className="w-36 border-b border-slate-400 mb-1"></div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">
                For Perla Textiles Processor
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
