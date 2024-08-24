import { withType } from './ast-utils.ts';

export const simplifyLineInfo = (outer: any) => 
  withType(outer, (node: any) => {
    const start = node?.start;
    const next = node?.next;

    return {
      ...node,
      start: undefined,
      next: undefined,
      line: start?.line,
      lineEnd: next?.line,
    }
  });

