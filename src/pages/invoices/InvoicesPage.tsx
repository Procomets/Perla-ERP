import React, { useState } from 'react';
import { Invoice, InvoiceLine } from '../../types/invoice';
import { PurchaseOrder } from '../../types/po';
import { Vendor } from '../../types/vendor';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { StatusChip } from '../../components/ui/StatusChip';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatQuantity, formatDate, numberToWordsIndian } from '../../utils/formatters';
import { Receipt, Plus, Printer, CheckCircle2, FileText, Shirt } from 'lucide-react';

interface InvoicesPageProps {
  invoices: Invoice[];
  pos: PurchaseOrder[];
  vendors: Vendor[];
  approvedPoLineIds: string[];
  onAddInvoice: (inv: Invoice) => void;
}

export const InvoicesPage: React.FC<InvoicesPageProps> = ({
  invoices,
  pos,
  vendors,
  approvedPoLineIds,
  onAddInvoice
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Eligible PO lines that are approved but not yet invoiced
  const eligibleLines: { po: PurchaseOrder; lineId: string; colour: string; qty: number; rate: number }[] = [];

  pos.forEach((po) => {
    po.lines.forEach((l) => {
      if (approvedPoLineIds.includes(l.lineId)) {
        eligibleLines.push({
          po,
          lineId: l.lineId,
          colour: l.colourName,
          qty: l.quantity,
          rate: l.rate
        });
      }
    });
  });

  const handleGenerateInvoice = (item: typeof eligibleLines[0]) => {
    const customer = vendors.find((v) => v.id === item.po.customerId);
    const lineAmount = item.qty * item.rate;
    const cgst = lineAmount * 0.025;
    const sgst = lineAmount * 0.025;
    const total = lineAmount + cgst + sgst;

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceId: `inv-id-${Date.now()}`,
      invoiceNo: `INV/2026-27/000${invoices.length + 1}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      poNumber: item.po.poNumber,
      styleNo: item.po.styleNo,
      customerId: item.po.customerId,
      customerSnapshot: {
        companyName: customer ? customer.companyName : 'Apex Garments & Co.',
        address: customer ? (typeof customer.address === 'string' ? customer.address : customer.address.addressLine1) : 'Plot 42, Sidco Industrial Estate',
        city: customer ? (typeof customer.address === 'object' ? customer.address.city || '' : customer.city || 'Chennai') : 'Chennai',
        state: customer ? (typeof customer.address === 'object' ? customer.address.state : customer.state || 'Tamil Nadu') : 'Tamil Nadu',
        stateCode: customer ? (typeof customer.address === 'object' ? customer.address.gstStateCode || '33' : customer.stateCode || '33') : '33',
        gstin: customer ? customer.taxDetails?.gstin || customer.gstin || '' : '33AAACA1234A1Z5',
        pan: customer ? customer.taxDetails?.pan || customer.pan || '' : 'AAACA1234A'
      },
      lines: [
        {
          lineId: item.lineId,
          sourcePoLineId: item.lineId,
          description: `Washing Charges for ${item.po.itemName} (${item.po.styleNo})`,
          hsnSac: '998821',
          colour: item.colour,
          process: item.po.processCategory,
          qty: item.qty,
          unit: 'piece',
          rate: item.rate,
          amount: lineAmount,
          cgstRate: 2.5,
          cgstAmount: cgst,
          sgstRate: 2.5,
          sgstAmount: sgst,
          igstRate: 0,
          igstAmount: 0
        }
      ],
      subtotal: lineAmount,
      totalCgst: cgst,
      totalSgst: sgst,
      totalIgst: 0,
      roundOff: 0,
      finalTotal: total,
      amountInWords: numberToWordsIndian(total),
      status: 'Finalized',
      createdAt: new Date().toISOString(),
      createdBy: 'Active User'
    };

    onAddInvoice(newInvoice);
    setPreviewInvoice(newInvoice);
    setIsModalOpen(false);
  };

  const columns: Column<Invoice>[] = [
    { header: 'Invoice No', accessor: 'invoiceNo', className: 'font-bold text-[#1F4E79]' },
    { header: 'Invoice Date', accessor: (row) => formatDate(row.invoiceDate) },
    { header: 'Customer', accessor: (row) => row.customerSnapshot.companyName },
    { header: 'PO Number', accessor: 'poNumber' },
    { header: 'Style No', accessor: 'styleNo' },
    { header: 'Subtotal', accessor: (row) => formatCurrency(row.subtotal) },
    { header: 'Final Amount (Incl. GST)', accessor: (row) => formatCurrency(row.finalTotal), className: 'font-extrabold text-emerald-800' },
    { header: 'Status', accessor: (row) => <StatusChip status={row.status} /> },
    {
      header: 'Actions',
      accessor: (row) => (
        <Button size="sm" variant="outline" icon={<Printer className="w-3.5 h-3.5" />} onClick={() => setPreviewInvoice(row)}>
          View PDF Invoice
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79]">Tax Invoices</h2>
          <p className="text-xs text-slate-500">Generate printable GST invoices for approved reconciliation lines</p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setIsModalOpen(true)}
        >
          Generate Invoice ({eligibleLines.length} Approved Ready)
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={invoices} keyExtractor={(row) => row.id} />
      </Card>

      {/* Generate Invoice Selection Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Select Approved Statement Line to Invoice" maxWidth="lg">
        <div className="space-y-3">
          {eligibleLines.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">
              No approved statement lines pending invoice generation. Reconcile inward/outward and click "Approve to Invoice" first.
            </p>
          ) : (
            eligibleLines.map((item) => (
              <div key={item.lineId} className="flex items-center justify-between p-4 bg-[#EEF5FB] rounded-xl border border-blue-200">
                <div>
                  <h4 className="text-xs font-bold text-[#1F4E79]">{item.po.poNumber} • {item.colour}</h4>
                  <p className="text-[11px] text-slate-600">Style: {item.po.styleNo} | Qty: {formatQuantity(item.qty)} | Rate: {formatCurrency(item.rate)}</p>
                </div>
                <Button size="sm" variant="success" icon={<Receipt className="w-3.5 h-3.5" />} onClick={() => handleGenerateInvoice(item)}>
                  Generate Invoice
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Printable GST Tax Invoice Modal */}
      {previewInvoice && (
        <Modal isOpen={!!previewInvoice} onClose={() => setPreviewInvoice(null)} title={`Tax Invoice: ${previewInvoice.invoiceNo}`} maxWidth="4xl">
          <div className="bg-white p-8 border rounded-xl shadow-xs space-y-6 text-xs text-slate-800 printable-area">
            
            {/* Invoice Header */}
            <div className="flex justify-between items-start border-b pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-[#1F4E79] text-white flex items-center justify-center font-black text-lg">
                  PT
                </div>
                <div>
                  <h1 className="text-lg font-black text-[#1F4E79] uppercase">PERLA TEXTILES PROCESSOR</h1>
                  <p className="text-[10px] text-slate-600">Industrial Textile Processing (Washing & Dyeing)</p>
                  <p className="text-[10px] text-slate-500">SIDCO Industrial Estate, Thirumudivakkam, Chennai - 600132</p>
                  <p className="text-[10px] font-bold text-slate-700">GSTIN: 33AAAAA9999A1Z1 • State Code: 33 (TN)</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block bg-[#1F4E79] text-white text-xs font-bold px-3 py-1 rounded-md uppercase">
                  TAX INVOICE
                </span>
                <p className="font-bold text-slate-900 mt-2 text-sm">{previewInvoice.invoiceNo}</p>
                <p className="text-slate-500">Date: {formatDate(previewInvoice.invoiceDate)}</p>
              </div>
            </div>

            {/* Bill To Customer Details */}
            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#1F4E79] block mb-1">Billed To (Customer):</span>
                <p className="font-bold text-sm text-slate-900">{previewInvoice.customerSnapshot.companyName}</p>
                <p className="text-slate-600">{previewInvoice.customerSnapshot.address}, {previewInvoice.customerSnapshot.city}</p>
                <p className="text-slate-600">GSTIN: <strong className="text-slate-900">{previewInvoice.customerSnapshot.gstin}</strong></p>
                <p className="text-slate-600">State: {previewInvoice.customerSnapshot.state} ({previewInvoice.customerSnapshot.stateCode})</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-[#1F4E79] block mb-1">Order References:</span>
                <p className="text-slate-700">PO Number: <strong className="text-slate-900">{previewInvoice.poNumber}</strong></p>
                <p className="text-slate-700">Style Number: <strong className="text-slate-900">{previewInvoice.styleNo}</strong></p>
                <p className="text-slate-700">Payment Terms: 30 Days Net</p>
              </div>
            </div>

            {/* Line Items Table */}
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2 border">S.No</th>
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border">HSN/SAC</th>
                  <th className="p-2 border">Colour</th>
                  <th className="p-2 border">Quantity</th>
                  <th className="p-2 border">Rate (₹)</th>
                  <th className="p-2 border">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y border-t font-medium">
                {previewInvoice.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="p-2 border text-center">{i + 1}</td>
                    <td className="p-2 border">{l.description}</td>
                    <td className="p-2 border">{l.hsnSac}</td>
                    <td className="p-2 border">{l.colour}</td>
                    <td className="p-2 border font-bold">{formatQuantity(l.qty, l.unit)}</td>
                    <td className="p-2 border">{formatCurrency(l.rate)}</td>
                    <td className="p-2 border font-bold">{formatCurrency(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Invoice Calculations Breakdown */}
            <div className="flex justify-between items-start pt-2">
              <div className="max-w-md space-y-2">
                <div className="bg-slate-50 p-3 rounded-lg border text-[11px]">
                  <span className="font-bold text-slate-700 block">Bank Details for NEFT/RTGS:</span>
                  <p>Bank: HDFC Bank, Thirumudivakkam Branch</p>
                  <p>A/C Name: Perla Textiles Processor</p>
                  <p>A/C No: 50200012345678 | IFSC: HDFC0001234</p>
                </div>
                <p className="text-[10px] font-bold text-[#1F4E79]">Amount in Words: <span className="font-semibold text-slate-800">{previewInvoice.amountInWords}</span></p>
              </div>

              <div className="w-64 space-y-1.5 text-right font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span>{formatCurrency(previewInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>CGST (2.5%):</span>
                  <span>{formatCurrency(previewInvoice.totalCgst)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>SGST (2.5%):</span>
                  <span>{formatCurrency(previewInvoice.totalSgst)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-[#1F4E79] pt-2 border-t border-slate-300">
                  <span>Total Payable:</span>
                  <span>{formatCurrency(previewInvoice.finalTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-end pt-8 border-t">
              <div className="text-[10px] text-slate-400">
                This is a system generated computer invoice from Perla ERP.
              </div>
              <div className="text-center">
                <div className="h-10"></div>
                <span className="text-xs font-bold text-slate-800 border-t border-slate-300 pt-1 block">
                  Authorised Signatory for Perla Textiles
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <Button variant="outline" onClick={() => window.print()} icon={<Printer className="w-4 h-4" />}>
                Print Tax Invoice
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
