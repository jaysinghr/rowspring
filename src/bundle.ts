/**
 * Single entry point bundled by esbuild into addon/Core.generated.js.
 * Apps Script files share one global scope and can't use ES modules, so
 * everything the add-on needs from the tested core/ logic is exported from
 * this module. esbuild's `--global-name=Rowspring` turns those named exports
 * into direct properties on the Apps Script global (`Rowspring.planSync`,
 * `Rowspring.readSheetRows`, and so on).
 */
import { planSync } from './core/planner';
import { runChunk } from './core/jobRunner';
import { applyPlan } from './core/applyPlan';
import { readSheetRows } from './core/readSheetRows';
import { buildWriteback } from './core/buildWriteback';

export {
  planSync,
  runChunk,
  applyPlan,
  readSheetRows,
  buildWriteback,
};
