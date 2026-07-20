/*
 * gha-grouping.ts
 *
 * Per-test-file GitHub Actions `::group::` emission for the default
 * (non-bucketed) test run (Phase 2 of dev-docs/ci-test-log-grouping-design.md).
 *
 * The GitHub Actions runner cannot nest groups: a second `::group::`
 * implicitly closes the first, and content after the inner group ends up
 * outside any group. So there must be exactly one owner of grouping per code
 * path. The harness owns grouping ONLY when nothing else does — on CI, with no
 * outer orchestrator claiming the step (the YAML bucket loop sets
 * QUARTO_TESTS_GHA_ORCHESTRATED and emits its own groups). That ownership test
 * is harnessOwnsStep() from src/tools/github.ts, the same switch Phase 1 uses.
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { endGroup, harnessOwnsStep, startGroup } from "../src/tools/github.ts";

// Per-file grouping state machine. Emits group markers through injected
// callbacks so unit tests drive it without touching the environment or
// capturing console output. Enforces the single-open-group invariant: entering
// a new file closes the previous file's group before opening the next, and a
// group is only ever closed if one is actually open (no stray `::endgroup::`).
// The `gate` decides ownership per call, so a run where the harness never owns
// the step never emits or mutates state.
export class GroupEmitter {
  private openFile: string | undefined = undefined;

  constructor(
    private readonly gate: () => boolean,
    private readonly onStart: (title: string) => void,
    private readonly onEnd: () => void,
  ) {}

  // Open the group for `file`, closing the previous file's group first. A
  // repeated call for the same still-open file is a no-op — the group stays
  // open across all of that file's tests.
  enterFile(file: string): void {
    if (!this.gate()) return;
    if (this.openFile === file) return;
    if (this.openFile !== undefined) this.onEnd();
    this.onStart(file);
    this.openFile = file;
  }

  // Close the current group if one is open (failure path, and unload). Safe to
  // call when nothing is open — no marker is emitted then, so the failure
  // path's close followed by the unload close never double-emits.
  close(): void {
    if (!this.gate()) return;
    if (this.openFile !== undefined) {
      this.onEnd();
      this.openFile = undefined;
    }
  }

  // The file whose group is currently open, if any (inspection/tests).
  currentFile(): string | undefined {
    return this.openFile;
  }
}

// Module singleton wired to the real workflow-command emitters and gated on
// harnessOwnsStep(). startGroup/endGroup additionally no-op off CI, so this is
// doubly safe: local runs never emit, and orchestrated (bucket) runs stay
// byte-identical because the gate is false there.
const emitter = new GroupEmitter(harnessOwnsStep, startGroup, endGroup);

// Open (or transition to) the group for a test file. Call at the start of each
// harness test's fn, before any output; `file` is the tests-relative
// forward-slash path used as the group title.
export function enterTestFileGroup(file: string): void {
  emitter.enterFile(file);
}

// Close any open group. Call on the failure path (before fail() throws, so the
// FAILED line lands outside the group) and at unload (so the terminal
// ERRORS/FAILURES/summary sections are never grouped).
export function closeTestFileGroup(): void {
  emitter.close();
}
