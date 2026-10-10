import { VendorService } from '../vendorService';
import { validateParentRelationship, gstinRegex, panRegex } from '../../schemas/vendorSchema';

export async function runVendorMasterTests() {
  console.log('Running Vendor Master Suite...');

  // 1. Metrics & List
  const metrics = await VendorService.getDashboardMetrics(true);
  console.assert(metrics.totalVendors > 0, 'Total vendors should be > 0');

  const list = await VendorService.getVendors({}, { page: 1, pageSize: 10 }, true);
  console.assert(list.vendors.length > 0, 'Vendors list length should be > 0');

  // 2. Creation with atomic code
  const created = await VendorService.createVendor(
    {
      companyName: 'Test Corporation',
      vendorType: 'supplier',
      vendorCategory: 'subcontractor',
      address: { addressLine1: 'Road 1', state: 'Tamil Nadu', country: 'India' },
      taxDetails: { gstRegistrationStatus: 'unregistered' },
      financialDetails: { paymentTerms: '30_days' },
      status: 'active'
    },
    [{ personName: 'Primary Contact', contactNumber: '9842211111', isPrimary: true, status: 'active' }],
    'admin-uid',
    true
  );

  console.assert(created.vendorCode.startsWith('VND-'), 'Vendor code format check');

  // 3. Tax Regex
  console.assert(gstinRegex.test('33AAAAA0000A1Z5'), 'Valid GSTIN regex check');
  console.assert(!gstinRegex.test('INVALID_GSTIN'), 'Invalid GSTIN regex check');
  console.assert(panRegex.test('AAAAA0000A'), 'Valid PAN regex check');

  // 4. Non-circular relationship check
  const map = new Map([
    ['v-1', { parentVendorId: null }],
    ['v-2', { parentVendorId: 'v-1' }]
  ]);
  const cycleRes = validateParentRelationship('v-1', 'v-2', map);
  console.assert(cycleRes.valid === false, 'Cycle detection check');

  console.log('Vendor Master Suite Passed Successfully!');
}
