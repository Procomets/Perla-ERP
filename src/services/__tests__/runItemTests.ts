import { runItemMasterTests } from './itemService.test';

async function main() {
  try {
    await runItemMasterTests();
    (globalThis as any).process?.exit(0);
  } catch (error) {
    console.error('Item master tests failed:', error);
    (globalThis as any).process?.exit(1);
  }
}

main();
