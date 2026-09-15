/*
 * gha-grouping.ts
 *
 * Per-file GitHub Actions grouping for harness-owned test runs.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { endGroup, harnessOwnsStep, startGroup } from "../src/tools/github.ts";

// Injected emitters keep the state machine independent of the environment.
export class GroupEmitter {
  private openFile: string | undefined = undefined;

  constructor(
    private readonly gate: () => boolean,
    private readonly onStart: (title: string) => void,
    private readonly onEnd: () => void,
  ) {}

  // Keep at most one group open and reuse it across a file's tests.
  enterFile(file: string): void {
    if (!this.gate()) return;
    if (this.openFile === file) return;
    if (this.openFile !== undefined) this.onEnd();
    this.onStart(file);
    this.openFile = file;
  }

  // Closing an already closed emitter is a no-op.
  close(): void {
    if (!this.gate()) return;
    if (this.openFile !== undefined) {
      this.onEnd();
      this.openFile = undefined;
    }
  }

  currentFile(): string | undefined {
    return this.openFile;
  }
}

// Return the first `.test.ts` file URL in a V8 stack, without its location.
export function testFileUrlFromStack(
  stack: string | undefined,
): string | undefined {
  if (stack === undefined) return undefined;
  const match = stack.match(/file:\/\/\/?\S*?\.test\.ts/);
  return match?.[0];
}

const emitter = new GroupEmitter(harnessOwnsStep, startGroup, endGroup);

export function enterTestFileGroup(file: string): void {
  emitter.enterFile(file);
}

export function closeTestFileGroup(): void {
  emitter.close();
}
