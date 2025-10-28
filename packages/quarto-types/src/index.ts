/**
 * @quarto/types
 * TypeScript type definitions for Quarto execution engines
 */

// Export text types
export * from './text-types';

// Export constants
export * from './constants';

// Export metadata types
export * from './metadata-types';

// Export project context types
export * from './project-context';

// Export execution engine types
export * from './execution-engine';

// Export external engine types
export * from './external-engine';

// Export Quarto API types
export * from './quarto-api';

/**
 * Utility to check if a project context satisfies EngineProjectContext interface
 */
import { EngineProjectContext } from './project-context';

export function isEngineProjectContext(
  ctx: unknown
): ctx is EngineProjectContext {
  if (!ctx) return false;

  const context = ctx as Partial<EngineProjectContext>;

  return (
    typeof context.dir === 'string' &&
    typeof context.isSingleFile === 'boolean' &&
    context.fileInformationCache instanceof Map &&
    typeof context.resolveFullMarkdownForFile === 'function' &&
    typeof context.getOutputDirectory === 'function' &&
    !!context.quarto
  );
}

/**
 * Utility to get the output directory from a project context
 */
import { kProjectOutputDir } from './constants';
import { resolve, join, isAbsolute } from 'path';

export function projectOutputDir(context: EngineProjectContext): string {
  let outputDir = context.config?.project?.[kProjectOutputDir];

  if (outputDir) {
    if (!isAbsolute(outputDir)) {
      outputDir = join(context.dir, outputDir);
    }
  } else {
    outputDir = context.dir;
  }

  // Normalize the path
  return resolve(outputDir);
}