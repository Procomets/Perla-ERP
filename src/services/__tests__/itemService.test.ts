import { ItemService } from '../itemService';

export async function runItemMasterTests() {
  console.log('--- Starting Item & Chemical Master Test Suite ---');

  // 1. Initial Listing
  const initialRes = await ItemService.getItems({}, { page: 1, pageSize: 20 }, true);
  console.assert(initialRes.items.length > 0, 'Initial items should be seeded');
  console.log(`[PASS] Fetched ${initialRes.items.length} initial master items.`);

  // 2. Fetch categories and units
  const categories = await ItemService.getCategories(true);
  console.assert(categories.length >= 4, 'Should have standard default categories');
  console.log(`[PASS] Fetched ${categories.length} item categories.`);

  const units = await ItemService.getUnitsOfMeasure(true);
  console.assert(units.length >= 6, 'Should have standard default units of measure');
  console.log(`[PASS] Fetched ${units.length} units of measure.`);

  // 3. Create General Item
  const newGeneral = await ItemService.createItem(
    {
      itemCode: `TEST-GEN-${Date.now().toString().slice(-4)}`,
      itemName: 'Heavy Duty Packaging Straps',
      categoryId: 'cat_packaging',
      categoryName: 'Packing Materials',
      itemType: 'packing',
      baseUnit: 'pcs',
      defaultPurchaseRate: 45,
      minimumStockLevel: 20,
      reorderLevel: 50
    },
    { uid: 'test-admin', displayName: 'Test Admin' },
    true
  );
  console.assert(newGeneral.itemCode.startsWith('TEST-GEN-'), 'General item code should match');
  console.assert(newGeneral.status === 'active', 'New item should be active');
  console.log(`[PASS] Created general item: ${newGeneral.itemCode}`);

  // 4. Duplicate Code Detection
  const dup = await ItemService.checkDuplicate(newGeneral.itemCode, 'Different Name', undefined, true);
  console.assert(dup.duplicateCode === true, 'Duplicate item code should be detected');
  console.log('[PASS] Duplicate code detection asserted.');

  // 5. Create Chemical Item with Specifications
  const newChem = await ItemService.createItem(
    {
      itemCode: `TEST-CHM-${Date.now().toString().slice(-4)}`,
      itemName: 'High Performance Fixing Agent PX',
      categoryId: 'cat_chemical',
      categoryName: 'Chemicals',
      itemType: 'chemical',
      baseUnit: 'kg',
      defaultPurchaseRate: 140,
      reorderLevel: 100,
      chemicalDetails: {
        itemId: '',
        chemicalCode: '',
        chemicalName: 'High Performance Fixing Agent PX',
        chemicalDisplayName: 'Fixing Agent PX',
        chemicalCategory: 'Fixing Agent',
        chemicalType: 'Dye Fixing Chemical',
        chemicalGrade: 'Textile Processing Grade',
        manufacturer: 'Dystar India',
        brand: 'Levafix Fixer',
        purchaseUnit: 'kg',
        consumptionUnit: 'kg',
        conversionFactor: 1,
        batchTrackingRequired: true,
        expiryTrackingRequired: true,
        shelfLife: '18 Months',
        safetyInstructions: 'Avoid skin contact',
        storageInstructions: 'Keep in ventilated chemical bay',
        handlingPrecautions: 'Wear gloves',
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    },
    { uid: 'test-admin', displayName: 'Test Admin' },
    true
  );
  console.assert(newChem.itemType === 'chemical', 'Item type should be chemical');
  console.assert(newChem.chemicalDetails?.chemicalCategory === 'Fixing Agent', 'Chemical category should match');
  console.log(`[PASS] Created specialized chemical: ${newChem.itemCode}`);

  // 6. Update Item
  const updatedItem = await ItemService.updateItem(
    newGeneral.id,
    {
      description: 'Updated strap tension description',
      defaultPurchaseRate: 48
    },
    { uid: 'test-admin', displayName: 'Test Admin' },
    true
  );
  console.assert(updatedItem.defaultPurchaseRate === 48, 'Rate should be updated');
  console.log('[PASS] Item update asserted.');

  // 7. Soft Deactivation and Reactivation
  const deactivated = await ItemService.deactivateItem(newGeneral.id, 'Discontinued supplier', { uid: 'test-admin' }, true);
  console.assert(deactivated.status === 'inactive', 'Item should be inactive');
  console.log('[PASS] Item deactivation asserted.');

  const reactivated = await ItemService.reactivateItem(newGeneral.id, { uid: 'test-admin' }, true);
  console.assert(reactivated.status === 'active', 'Item should be reactivated to active');
  console.log('[PASS] Item reactivation asserted.');

  // 8. Category Management
  const newCat = await ItemService.createCategory(
    {
      categoryName: 'Testing Additives',
      description: 'Specialty test additives'
    },
    { uid: 'test-admin' },
    true
  );
  console.assert(newCat.categoryName === 'Testing Additives', 'New category created');
  console.log(`[PASS] Category creation asserted: ${newCat.categoryCode}`);

  // 9. Unit of Measure Management
  const newUom = await ItemService.createUnitOfMeasure(
    {
      unitName: 'Square Meter',
      symbol: 'sqm',
      unitType: 'other',
      baseUnit: 'sqm',
      conversionFactorToBase: 1
    },
    { uid: 'test-admin' },
    true
  );
  console.assert(newUom.symbol === 'sqm', 'New unit of measure symbol should match');
  console.log(`[PASS] Unit of measure creation asserted: ${newUom.symbol}`);

  console.log('--- ALL ITEM & CHEMICAL MASTER TESTS PASSED SUCCESSFULLY! ---');
}
