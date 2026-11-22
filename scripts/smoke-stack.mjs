import { smoke } from "./conference-stack.mjs";

try {
  await smoke();
} catch (error) {
  console.error("FAIL " + error.message);
  process.exitCode = 1;
}
