import { runPurchaseOrderTests } from './poService.test';

async function main() {
  try {
    await runPurchaseOrderTests();
    (globalThis as any).process?.exit(0);
  } catch (error) {
    console.error('Test execution error:', error);
    (globalThis as any).process?.exit(1);
  }
}

main();
