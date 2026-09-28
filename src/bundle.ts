/**
 * Single entry point bundled by esbuild into addon/Core.generated.js.
 * Apps Script files share one global scope and can't use ES modules, so
 * everything the add-on needs from the tested core/ logic is exposed here
 * under one global namespace (`Rowspring`) instead of many bare names.
 */
import { planSync } from './core/planner';
import { runChunk } from './core/jobRunner';
import { applyPlan } from './core/applyPlan';
import { readSheetRows } from './core/readSheetRows';
import { buildWriteback } from './core/buildWriteback';

export const Rowspring = {
  planSync,
  runChunk,
  applyPlan,
  readSheetRows,
  buildWriteback,
};
