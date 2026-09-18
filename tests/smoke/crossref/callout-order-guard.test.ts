/*
 * callout-order-guard.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * T3.5: `callout_title_prefix` (modules/callouts.lua) is missing the
 * `order == nil` guard that its float-side analog (`float_title_prefix`,
 * crossref/tables.lua) already has. That guard is unreachable through
 * quarto's own CLI today -- `enable-crossref: false` early-returns before
 * it, and default mode always assigns an `order` -- but it becomes
 * reachable once a caller sets `crossref-numbering: external`, which
 * keeps crossref decoration on (`crossref_present()`) while turning off
 * quarto's own number assignment (`assign_crossref_numbers()`), so a
 * labeled callout can reach render-decoration with no `order`.
 *
 * quarto-cli's `render` CLI has no YAML key for `crossref-numbering` yet
 * (that lands in a later task), so this test drives the discriminating
 * state directly: it renders the fixture normally to capture the exact
 * pandoc invocation quarto would issue (via QUARTO_CAPTURE_RENDER_COMMAND,
 * an existing debug capability of src/command/render/pandoc.ts that
 * dumps a replayable {cmd, args, cwd, env} to a temp dir), patches only
 * `crossref-numbering` to `"external"` in the captured QUARTO_FILTER_PARAMS
 * blob, and replays the identical pandoc command. Everything else --
 * main.lua, the real filter chain, real pandoc -- is unmodified.
 */

import { join } from "../../../src/deno_ral/path.ts";
import { decodeBase64, encodeBase64 } from "../../../src/deno_ral/encoding.ts";
import { assert, assertEquals } from "testing/asserts";
import { execProcess } from "../../../src/core/process.ts";
import { unitTest } from "../../test.ts";
import { quartoDevCmd, docs, outputForInput } from "../../utils.ts";
import { quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import { withDocxContent } from "../../verify.ts";

unitTest(
  "crossref - callout order-nil guard warns instead of aborting under external numbering (A7)",
  async () => {
    const input = docs("crossrefs/callout-order-guard.qmd");
    const output = outputForInput(input, "docx");
    const captureDir = Deno.makeTempDirSync({ prefix: "quarto-capture-" });

    try {
      // Step 1: render normally, capturing the exact pandoc invocation.
      const captureResult = await execProcess({
        cmd: quartoDevCmd(),
        args: ["render", input, "--to", "docx"],
        ...quartoSpawnEnvOptions({
          QUARTO_CAPTURE_RENDER_COMMAND: captureDir,
        }),
      });
      assert(
        captureResult.success,
        `Baseline capture render failed (exit ${captureResult.code}):\n${captureResult.stderr ?? ""}`,
      );

      const capturedPath = join(captureDir, "render-command.json");
      assert(
        existsSyncOrFail(capturedPath),
        `QUARTO_CAPTURE_RENDER_COMMAND did not write ${capturedPath}`,
      );
      // deno-lint-ignore no-explicit-any
      const captured: any = JSON.parse(Deno.readTextFileSync(capturedPath));

      // Step 2: patch only crossref-numbering into the captured filter
      // params. enable-crossref is untouched (defaults to true), so
      // crossref_present() stays true (decoration still runs) while
      // assign_crossref_numbers() flips to false (quarto never assigns
      // callout.order) -- the exact discriminating state for A7.
      // deno-lint-ignore no-explicit-any
      const filterParams: any = JSON.parse(
        new TextDecoder().decode(
          decodeBase64(captured.env["QUARTO_FILTER_PARAMS"]),
        ),
      );
      filterParams["crossref-numbering"] = "external";
      captured.env["QUARTO_FILTER_PARAMS"] = encodeBase64(
        JSON.stringify(filterParams),
      );

      // The captured render-command.json's small "env" overlay doesn't
      // include QUARTO_FILTER_DEPENDENCY_FILE -- that scratch path lives in
      // "ourEnv" (the calling quarto process's own ambient env) and points
      // into that process's session temp dir, which is removed once that
      // process exits. Point the replay at a fresh scratch file instead of
      // relying on the original path surviving past capture.
      const dependencyFile = join(captureDir, "dependencies.jsonstream");
      Deno.writeTextFileSync(dependencyFile, "");

      // Step 3: replay the identical pandoc command with the patched env.
      const replay = await execProcess({
        cmd: captured.cmd,
        args: captured.args,
        cwd: captured.cwd,
        env: {
          ...captured.env,
          "QUARTO_FILTER_DEPENDENCY_FILE": dependencyFile,
        },
      });

      assertEquals(
        replay.code,
        0,
        `pandoc exited ${replay.code} under crossref-numbering=external ` +
          `(A7 reverted would abort here instead of warning):\n${
            replay.stderr ?? ""
          }`,
      );
      assert(
        (replay.stderr ?? "").includes(
          "field 'order' is missing from callout",
        ),
        `Expected A7's warning in stderr, got:\n${replay.stderr ?? ""}`,
      );

      await withDocxContent(output.outputPath, async (xml) => {
        assert(
          !/>Note ?\d+/.test(xml),
          "callout title should render with no Note+NBSP+number prefix " +
            "when order is nil under external numbering",
        );
        return Promise.resolve();
      });
    } finally {
      Deno.removeSync(captureDir, { recursive: true });
      try {
        Deno.removeSync(output.outputPath);
      } catch {
        // best effort
      }
      try {
        Deno.removeSync(output.supportPath, { recursive: true });
      } catch {
        // no supporting files dir for this fixture
      }
    }
  },
);

function existsSyncOrFail(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
}
