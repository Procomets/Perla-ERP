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
    customerName: 'Apex Garments & Co.',
    processCategory: 'Washing',
    styleNo: 'APX-DENIM-9021',
    itemName: 'Mens Denim Jacket Washing',
    status: 'In Progress',
    lines: [
      {
        lineId: 'pol-1',
        colourName: 'Indio Ocean Blue',
        processType: 'Enzyme Bio Wash',
        quantity: 1200,
        unit: 'piece',
        rate: 42.0,
        rateBasis: 'per piece',
        amount: 50400
      },
      {
        lineId: 'pol-2',
        colourName: 'Vintage Black Wash',
        processType: 'Enzyme Bio Wash',
        quantity: 800,
        unit: 'piece',
        rate: 45.0,
        rateBasis: 'per piece',
        amount: 36000
      }
    ],
    totalQuantity: 2000,
    totalAmount: 86400,
    createdBy: 'admin-uid',
    createdAt: '2026-02-01T09:30:00Z'
  }
];

export const INITIAL_INWARDS: InwardEntry[] = [
  {
    id: 'inw-101',
    entryId: 'inw-101',
    poId: 'po-1',
    poNumber: 'PO/2026-27/0001',
    styleNo: 'APX-DENIM-9021',
    customerId: 'v1',
    customerName: 'Apex Garments & Co.',
    customerDate: '2026-02-02',
    customerDcNo: 'DC-APX-8891',
    createdAt: '2026-02-02T11:00:00Z',
    createdBy: 'Thiru M. (Supervisor)',
    lines: [
      {
        lineId: 'inwl-1',
        poLineId: 'pol-1',
        colour: 'Indio Ocean Blue',
        receivedQty: 600,
        unit: 'piece'
      }
    ]
  }
];

export const INITIAL_OUTWARDS: OutwardEntry[] = [
  {
    id: 'out-201',
    entryId: 'out-201',
    poId: 'po-1',
    poNumber: 'PO/2026-27/0001',
    styleNo: 'APX-DENIM-9021',
    customerId: 'v1',
    customerName: 'Apex Garments & Co.',
    ourDate: '2026-02-10',
    ourDcNo: 'PERLA/OUT/0045',
    vehicleNo: 'TN 37 AX 9911',
    createdAt: '2026-02-10T15:30:00Z',
    createdBy: 'Prakash R.',
    lines: [
      {
        lineId: 'outl-1',
        poLineId: 'pol-1',
        colour: 'Indio Ocean Blue',
        dispatchQty: 400,
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
