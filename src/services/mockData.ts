import { PurchaseOrder } from '../types/po';
import { Vendor } from '../types/vendor';
import { InwardEntry, OutwardEntry } from '../types/inwardOutward';
import { InventoryItem, ChemicalEntry } from '../types/stock';

export const INITIAL_VENDORS: Vendor[] = [
  {
    id: 'v1',
    vendorId: 'v1',
    vendorCode: 'VND-000001',
    companyName: 'Apex Garments & Co.',
    legalCompanyName: 'Apex Garments & Co India Pvt Ltd',
    vendorType: 'customer',
    vendorCategory: 'main_company',
    parentVendorId: null,
    address: {
      addressLine1: 'Plot 42, Sidco Industrial Estate',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pinCode: '600044',
      country: 'India',
      gstStateCode: '33'
    },
    taxDetails: {
      gstRegistrationStatus: 'registered',
      gstin: '33AAACA1234A1Z5',
      pan: 'AAACA1234A'
    },
    financialDetails: {
      paymentTerms: '30_days',
      creditLimit: 2000000
    },
    communication: {
      officialEmail: 'accounts@apexgarments.com',
      officePhone: '+91 98401 23456'
    },
    status: 'active',
    createdAt: '2026-01-10T10:00:00Z',
    createdBy: 'admin-uid',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
    schemaVersion: 1,
    roles: ['Customer'],
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33',
    gstin: '33AAACA1234A1Z5',
    pan: 'AAACA1234A',
    paymentTerms: '30 Days Net',
    email: 'accounts@apexgarments.com',
    phone: '+91 98401 23456',
    active: true,
    primaryContactName: 'R. Sundaram',
    primaryContactPhone: '+91 98401 23456'
  },
  {
    id: 'v2',
    vendorId: 'v2',
    vendorCode: 'VND-000002',
    companyName: 'Royal Threads & Dyes Ltd',
    legalCompanyName: 'Royal Threads & Dyes Ltd',
    vendorType: 'supplier',
    vendorCategory: 'main_company',
    parentVendorId: null,
    address: {
      addressLine1: '12 Chempark Road',
      city: 'Ranipet',
      state: 'Tamil Nadu',
      pinCode: '632401',
      country: 'India',
      gstStateCode: '33'
    },
    taxDetails: {
      gstRegistrationStatus: 'registered',
      gstin: '33BBBCB5678B1Z2',
      pan: 'BBBCB5678B'
    },
    financialDetails: {
      paymentTerms: '15_days',
      creditLimit: 1500000
    },
    communication: {
      officialEmail: 'sales@royalthreads.com',
      officePhone: '+91 94432 88990'
    },
    status: 'active',
    createdAt: '2026-01-12T10:00:00Z',
    createdBy: 'admin-uid',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
    schemaVersion: 1,
    roles: ['Supplier'],
    city: 'Ranipet',
    state: 'Tamil Nadu',
    stateCode: '33',
    gstin: '33BBBCB5678B1Z2',
    pan: 'BBBCB5678B',
    paymentTerms: '15 Days',
    email: 'sales@royalthreads.com',
    phone: '+91 94432 88990',
    active: true,
    primaryContactName: 'K. Venkatesh',
    primaryContactPhone: '+91 94432 88990'
  },
  {
    id: 'v3',
    vendorId: 'v3',
    vendorCode: 'VND-000003',
    companyName: 'BlueSky Washing Subcontractors',
    legalCompanyName: 'BlueSky Washing Subcontractors LLP',
    vendorType: 'supplier',
    vendorCategory: 'subcontractor',
    parentVendorId: 'v1',
    address: {
      addressLine1: 'Thirumudivakkam Main Road',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pinCode: '600132',
      country: 'India',
      gstStateCode: '33'
    },
    taxDetails: {
      gstRegistrationStatus: 'registered',
      gstin: '33CCCC1122C1Z9',
      pan: 'CCCC1122C'
    },
    financialDetails: {
      paymentTerms: 'immediate'
    },
    communication: {
      officialEmail: 'blueskywash@gmail.com',
      officePhone: '+91 97910 55443'
    },
    status: 'active',
    createdAt: '2026-01-15T10:00:00Z',
    createdBy: 'admin-uid',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
    schemaVersion: 1,
    roles: ['SubContractor'],
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33',
    gstin: '33CCCC1122C1Z9',
    pan: 'CCCC1122C',
    paymentTerms: 'Immediate',
    email: 'blueskywash@gmail.com',
    phone: '+91 97910 55443',
    active: true,
    primaryContactName: 'M. BlueSky Contact',
    primaryContactPhone: '+91 97910 55443'
  }
];

export const INITIAL_POS: PurchaseOrder[] = [
  {
    id: 'po-1',
    poId: 'po-1',
    poNumber: 'PO/2026-27/0001',
    orderDate: '2026-02-01',
    deliveryDate: '2026-02-25',
    customerId: 'v1',
    customerVendorId: 'v1',
    customerCode: 'VND-000001',
    customerName: 'Apex Garments & Co.',
    customerCompanyNameSnapshot: 'Apex Garments & Co.',
    processCategory: 'Washing',
    styleNo: 'APX-DENIM-9021',
    styleNumber: 'APX-DENIM-9021',
    itemName: 'Mens Denim Jacket Washing',
    status: 'Approved',
    lines: [
      {
        id: 'pol-1',
        lineId: 'pol-1',
        colourName: 'Indio Ocean Blue',
        processType: 'Enzyme Bio Wash',
        quantity: 1200,
        unit: 'piece',
        rate: 42.0,
        rateBasis: 'per piece',
        lineAmount: 50400,
        amount: 50400
      },
      {
        id: 'pol-2',
        lineId: 'pol-2',
        colourName: 'Vintage Black Wash',
        processType: 'Enzyme Bio Wash',
        quantity: 800,
        unit: 'piece',
        rate: 45.0,
        rateBasis: 'per piece',
        lineAmount: 36000,
        amount: 36000
      }
    ],
    colourLines: [
      {
        id: 'pol-1',
        lineId: 'pol-1',
        colourName: 'Indio Ocean Blue',
        processType: 'Enzyme Bio Wash',
        quantity: 1200,
        unit: 'piece',
        rate: 42.0,
        rateBasis: 'per piece',
        lineAmount: 50400,
        amount: 50400
      },
      {
        id: 'pol-2',
        lineId: 'pol-2',
        colourName: 'Vintage Black Wash',
        processType: 'Enzyme Bio Wash',
        quantity: 800,
        unit: 'piece',
        rate: 45.0,
        rateBasis: 'per piece',
        lineAmount: 36000,
        amount: 36000
      }
    ],
    totalQtyByUnit: { piece: 2000, kg: 0 },
    totalQuantity: 2000,
    totalAmount: 86400,
    currency: 'INR',
    revision: 1,
    createdBy: 'admin-uid',
    createdById: 'admin-uid',
    createdByName: 'Admin',
    createdAt: '2026-02-01T09:30:00Z',
    schemaVersion: 1
  },
  {
    id: 'po-paramount-2467',
    poId: 'po-paramount-2467',
    poNumber: 'PO/2026-27/0002',
    customerId: 'v-102',
    customerVendorId: 'v-102',
    customerCode: 'VND-000002',
    customerName: 'Paramount Apparel Processing',
    customerCompanyNameSnapshot: 'Paramount Apparel Processing',
    processCategory: 'dyeing',
    styleNo: '2467',
    styleNumber: '2467',
    itemName: 'shoe',
    orderDate: '2026-10-11',
    deliveryDate: null,
    colourLines: [
      {
        id: '755fdd37-83ea-45d6-a69a-83a76eb26cf5',
        lineId: '755fdd37-83ea-45d6-a69a-83a76eb26cf5',
        colourName: 'pink',
        colourCode: null,
        processType: 'stoneWash',
        quantity: 2,
        unit: 'piece',
        rateBasis: 'perPiece',
        rate: 15,
        lineAmount: 30,
        amount: 30,
        notes: null
      }
    ],
    lines: [
      {
        id: '755fdd37-83ea-45d6-a69a-83a76eb26cf5',
        lineId: '755fdd37-83ea-45d6-a69a-83a76eb26cf5',
        colourName: 'pink',
        colourCode: null,
        processType: 'stoneWash',
        quantity: 2,
        unit: 'piece',
        rateBasis: 'perPiece',
        rate: 15,
        lineAmount: 30,
        amount: 30,
        notes: null
      }
    ],
    totalQtyByUnit: { piece: 2, kg: 0 },
    totalQuantity: 2,
    totalAmount: 30,
    currency: 'INR',
    status: 'approved',
    revision: 1,
    createdBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    createdById: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    createdByName: 'Pranav',
    createdAt: '2026-10-11T12:38:11.000Z',
    submittedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    submittedById: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    submittedAt: '2026-10-11T12:38:21.000Z',
    approvedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    approvedById: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    approvedAt: '2026-10-11T12:38:25.000Z',
    schemaVersion: 1
  }
];

export const INITIAL_INWARDS: InwardEntry[] = [
  {
    id: 'inw-paramount-0001',
    inwardId: 'inw-paramount-0001',
    inwardNo: 'INW/2026-27/0001',
    entryId: 'INW/2026-27/0001',
    poId: 'po-paramount-2467',
    poNumberSnapshot: 'PO/2026-27/0002',
    poNumber: 'PO/2026-27/0002',
    customerVendorId: 'v-102',
    customerId: 'v-102',
    customerCompanyNameSnapshot: 'Paramount Apparel Processing',
    customerName: 'Paramount Apparel Processing',
    styleNoSnapshot: '2467',
    styleNo: '2467',
    itemNameSnapshot: 'shoe',
    itemName: 'shoe',
    processCategorySnapshot: 'dyeing',
    processCategory: 'dyeing',
    customerDate: '2026-10-12',
    customerDcNo: 'DC-PAP-9901',
    inwardDate: '2026-10-12',
    status: 'posted',
    totalQtyByUnit: { piece: 2, kg: 0 },
    totalQuantity: 2,
    remarks: 'Sample delivery verified.',
    createdBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    createdByName: 'Pranav',
    createdAt: '2026-10-12T10:15:00.000Z',
    updatedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    updatedByName: 'Pranav',
    updatedAt: '2026-10-12T10:15:00.000Z',
    lines: [
      {
        inwardLineId: 'inwl-paramount-1',
        lineId: 'inwl-paramount-1',
        inwardId: 'inw-paramount-0001',
        poId: 'po-paramount-2467',
        poLineId: '755fdd37-83ea-45d6-a69a-83a76eb26cf5',
        colourNameSnapshot: 'pink',
        colour: 'pink',
        itemNameSnapshot: 'shoe',
        washTypeSnapshot: 'stoneWash',
        processType: 'stoneWash',
        orderedQtySnapshot: 2,
        unit: 'piece',
        previouslyReceivedQtySnapshot: 0,
        receivedQty: 2,
        cumulativeReceivedQtySnapshot: 2,
        balanceAfterReceiptSnapshot: 0
      }
    ],
    schemaVersion: 1
  },
  {
    id: 'inw-101',
    inwardId: 'inw-101',
    inwardNo: 'INW/2026-27/0002',
    entryId: 'INW/2026-27/0002',
    poId: 'po-1',
    poNumberSnapshot: 'PO/2026-27/0001',
    poNumber: 'PO/2026-27/0001',
    customerVendorId: 'v1',
    customerId: 'v1',
    customerCompanyNameSnapshot: 'Apex Garments & Co.',
    customerName: 'Apex Garments & Co.',
    styleNoSnapshot: 'APX-DENIM-9021',
    styleNo: 'APX-DENIM-9021',
    itemNameSnapshot: 'Denim Jacket',
    itemName: 'Denim Jacket',
    processCategorySnapshot: 'washing',
    processCategory: 'washing',
    customerDate: '2026-02-02',
    customerDcNo: 'DC-APX-8891',
    inwardDate: '2026-02-02',
    status: 'posted',
    totalQtyByUnit: { piece: 600, kg: 0 },
    totalQuantity: 600,
    createdBy: 'Thiru M. (Supervisor)',
    createdByName: 'Thiru M.',
    createdAt: '2026-02-02T11:00:00Z',
    updatedBy: 'Thiru M.',
    updatedByName: 'Thiru M.',
    updatedAt: '2026-02-02T11:00:00Z',
    lines: [
      {
        inwardLineId: 'inwl-1',
        lineId: 'inwl-1',
        inwardId: 'inw-101',
        poId: 'po-1',
        poLineId: 'pol-1',
        colourNameSnapshot: 'Indio Ocean Blue',
        colour: 'Indio Ocean Blue',
        itemNameSnapshot: 'Denim Jacket',
        washTypeSnapshot: 'Enzyme Bio Wash',
        processType: 'Enzyme Bio Wash',
        orderedQtySnapshot: 1200,
        unit: 'piece',
        previouslyReceivedQtySnapshot: 0,
        receivedQty: 600,
        cumulativeReceivedQtySnapshot: 600,
        balanceAfterReceiptSnapshot: 600
      }
    ],
    schemaVersion: 1
  }
];

export const INITIAL_OUTWARDS: OutwardEntry[] = [
  {
    id: 'out-201',
    outwardId: 'out-201',
    outwardNo: 'OUT/2026-27/0001',
    entryId: 'OUT/2026-27/0001',
    poId: 'po-1',
    poNumberSnapshot: 'PO/2026-27/0001',
    poNumber: 'PO/2026-27/0001',
    styleNoSnapshot: 'APX-DENIM-9021',
    styleNo: 'APX-DENIM-9021',
    itemNameSnapshot: 'Denim Garment',
    itemName: 'Denim Garment',
    processCategorySnapshot: 'washing',
    processCategory: 'washing',
    customerVendorId: 'v1',
    customerId: 'v1',
    customerCompanyNameSnapshot: 'Apex Garments & Co.',
    customerName: 'Apex Garments & Co.',
    outwardDate: '2026-02-10',
    ourDcNo: 'PERLA/OUT/0045',
    vehicleNumber: 'TN 37 AX 9911',
    vehicleNo: 'TN 37 AX 9911',
    status: 'posted',
    totalQtyByUnit: { piece: 400, kg: 0 },
    totalQuantity: 400,
    createdAt: '2026-02-10T15:30:00Z',
    createdBy: 'Prakash R.',
    updatedAt: '2026-02-10T15:30:00Z',
    updatedBy: 'Prakash R.',
    schemaVersion: 1,
    lines: [
      {
        outwardLineId: 'outl-1',
        lineId: 'outl-1',
        outwardId: 'out-201',
        poId: 'po-1',
        poLineId: 'pol-1',
        colourNameSnapshot: 'Indio Ocean Blue',
        colour: 'Indio Ocean Blue',
        itemNameSnapshot: 'Denim Garment',
        washTypeSnapshot: 'Enzyme Softener',
        orderedQtySnapshot: 1000,
        cumulativeInwardQtySnapshot: 1000,
        previouslyDispatchedQtySnapshot: 0,
        availableForDispatchSnapshot: 1000,
        dispatchQty: 400,
        remainingAfterDispatchSnapshot: 600,
        unit: 'piece'
      }
    ]
  }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'itm-1',
    itemId: 'itm-1',
    code: 'CHM-REAC-BLUE',
    name: 'Reactive Blue Wash Dye (Standard)',
    category: 'Chemical',
    baseUnit: 'kg',
    currentStock: 450,
    reorderLevel: 100,
    preferredSupplierName: 'Royal Threads & Dyes Ltd',
    active: true
  },
  {
    id: 'itm-2',
    itemId: 'itm-2',
    code: 'CHM-ENZ-BIO',
    name: 'Bio-Polishing Acid Enzyme Concentrate',
    category: 'Chemical',
    baseUnit: 'kg',
    currentStock: 85,
    reorderLevel: 150,
    preferredSupplierName: 'Perla Dyes & Auxiliaries Chemical Ltd',
    active: true
  },
  {
    id: 'itm-3',
    itemId: 'itm-3',
    code: 'FUL-WOOD-BOILER',
    name: 'Dry Casuarina Firewood (Boiler Fuel)',
    category: 'Firewood',
    baseUnit: 'kg',
    currentStock: 12500,
    reorderLevel: 5000,
    preferredSupplierName: 'Direct Purchase Local Wood Yard',
    active: true
  }
];

export const INITIAL_CHEMICAL_ENTRIES: ChemicalEntry[] = [
  {
    id: 'chm-log-01',
    entryId: 'chm-log-01',
    poId: 'po-1',
    poNumber: 'PO/2026-27/0001',
    poLineId: 'pol-1',
    styleNo: 'APX-DENIM-9021',
    colour: 'Indio Ocean Blue',
    processType: 'Washing',
    machineNo: 'M/C-02 (Horizontal Drum 500Kg)',
    operatorName: 'Senthil M.',
    lotNo: 'LOT-2026-001',
    processedQty: 400,
    unit: 'piece',
    startTime: '09:00',
    endTime: '11:30',
    date: '2026-02-05',
    consumptions: [
      { chemicalItemId: 'itm-2', chemicalName: 'Bio-Polishing Acid Enzyme Concentrate', quantity: 12, unit: 'kg' },
      { chemicalItemId: 'itm-1', chemicalName: 'Reactive Blue Wash Dye (Standard)', quantity: 5, unit: 'kg' }
    ],
    createdBy: 'Thiru M.',
    createdAt: '2026-02-05T11:30:00Z'
  }
];

export const INITIAL_EMPLOYEES = [
  { id: 'emp-1', name: 'M. Palanisamy', role: 'Machine Operator', department: 'Washing Floor', shift: 'Shift-1', phone: '9842211000', status: 'Present' },
  { id: 'emp-2', name: 'K. Subramani', role: 'Hydro Extractor Handler', department: 'Washing Floor', shift: 'Shift-1', phone: '9842211001', status: 'Present' },
  { id: 'emp-3', name: 'S. Ramasamy', role: 'Boiler Attendant', department: 'Utilities', shift: 'Shift-1', phone: '9842211002', status: 'Present' }
];

export const INITIAL_EB_ENTRIES = [
  { id: 'eb-1', month: 'January 2026', meterReadingKwh: 45200, totalCost: 384200, status: 'Paid' },
  { id: 'eb-2', month: 'February 2026', meterReadingKwh: 48900, totalCost: 415650, status: 'Pending' }
];

export const INITIAL_TRANSPORT = [
  { id: 'tr-1', date: '2026-02-10', vehicleNo: 'TN 37 AX 9911', transporterName: 'Lalitha Logistics Transporters', challanNo: 'PERLA/OUT/0045', freightAmount: 3500, paymentStatus: 'Paid' }
];
