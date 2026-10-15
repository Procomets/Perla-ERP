import { runOutwardTests } from './outwardService.test';

async function main() {
  try {
    const res = await runOutwardTests();
    if (res.failed > 0) {
      (globalThis as any).process?.exit(1);
    } else {
      (globalThis as any).process?.exit(0);
    }
  } catch (error) {
    console.error('Test execution error:', error);
    (globalThis as any).process?.exit(1);
  }
}

main();
