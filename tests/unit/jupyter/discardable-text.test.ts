/*
 * discardable-text.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { isDiscardableTextExecuteResult } from "../../../src/core/jupyter/jupyter.ts";
import { kTextPlain } from "../../../src/core/mime.ts";
import { JupyterOutput } from "../../../src/core/jupyter/types.ts";

// An execute_result whose only mime bundle is text/plain, stored as the
// per-line array Jupyter emits.
const execResult = (textPlainLines: string[]): JupyterOutput => ({
  output_type: "execute_result",
  data: { [kTextPlain]: textPlainLines },
});

// text/plain reprs that top-level plotting expressions echo under
// ipynb-shell-interactivity: all. The matplotlib reprs below are captured
// verbatim from the executed 11150.quarto_ipynb (keep-ipynb: true) — Jupyter
// emits text/plain as a per-line array, so multi-line reprs have length > 1.
const boxplotDict = [
  "{'whiskers': [<matplotlib.lines.Line2D at 0x17685b54980>,\n",
  "  <matplotlib.lines.Line2D at 0x17685b54ad0>],\n",
  " 'caps': [<matplotlib.lines.Line2D at 0x17685b54c20>,\n",
  "  <matplotlib.lines.Line2D at 0x17685b54d70>],\n",
  " 'boxes': [<matplotlib.lines.Line2D at 0x17685b54830>],\n",
  " 'medians': [<matplotlib.lines.Line2D at 0x17685b54ec0>],\n",
  " 'fliers': [<matplotlib.lines.Line2D at 0x17685b55010>],\n",
  " 'means': []}",
];
// A single-line dict of matplotlib artists (small enough that IPython does not
// pretty-print it across lines). Unambiguous plotting noise.
const singleLineDict = ["{'line': <matplotlib.lines.Line2D at 0x1407>}"];
const titleText = ["Text(0.5, 1.0, 'Test')"];
const axesRepr = ["<Axes: title={'center': 'Test'}>"];
const line2DRepr = ["<matplotlib.lines.Line2D at 0x14071bc7e00>"];
// A DataFrame echoed alongside the figure: multi-line text/plain plus text/html
// (also captured from 11150.quarto_ipynb). Two mime keys -> must be kept.
const dataFrameText = [
  "    day  total_bill\n",
  "0   Fri   17.151579\n",
  "1   Sat   20.441379\n",
  "2   Sun   21.410000\n",
  "3  Thur   17.682742",
];

unitTest(
  "jupyter - isDiscardableTextExecuteResult drops plotting-call reprs only alongside an image",
  // deno-lint-ignore require-await
  async () => {
    // Discard plotting-object noise when the cell also emitted an image.
    assertEquals(
      isDiscardableTextExecuteResult(execResult(titleText), true),
      true,
      "plt.title()/set_title() Text repr should be discarded",
    );
    assertEquals(
      isDiscardableTextExecuteResult(execResult(boxplotDict), true),
      true,
      "plt.boxplot() multi-line dict of Line2D should be discarded",
    );
    assertEquals(
      isDiscardableTextExecuteResult(execResult(axesRepr), true),
      true,
      "seaborn/pandas Axes repr should be discarded",
    );
    assertEquals(
      isDiscardableTextExecuteResult(execResult(line2DRepr), true),
      true,
      "bare Line2D repr should be discarded",
    );
    assertEquals(
      isDiscardableTextExecuteResult(execResult(singleLineDict), true),
      true,
      "single-line dict of matplotlib artists should be discarded",
    );

    // Gate: with no image in the cell, nothing here is discarded — a cell
    // that only echoed these values (no figure) must keep them.
    assertEquals(
      isDiscardableTextExecuteResult(execResult(titleText), false),
      false,
      "Text repr must be kept when the cell has no image",
    );
    assertEquals(
      isDiscardableTextExecuteResult(execResult(boxplotDict), false),
      false,
      "boxplot dict must be kept when the cell has no image",
    );

    // No over-suppression: legitimate output survives even alongside an image.
    // A Name(...) repr that is not a matplotlib Text must not be swept up.
    assertEquals(
      isDiscardableTextExecuteResult(
        execResult(["datetime.datetime(2020, 1, 1, 0, 0)"]),
        true,
      ),
      false,
      "non-matplotlib single-line Name(...) repr must be kept",
    );
    // A non-matplotlib Text( repr (e.g. rich.text.Text -> Text('...')) has no
    // leading coordinate, so it must be kept.
    assertEquals(
      isDiscardableTextExecuteResult(execResult(["Text('hello world')"]), true),
      false,
      "non-matplotlib Text('...') repr must be kept",
    );
    // A multi-line bracketed value (list/tuple) with no matplotlib reference
    // must survive — the discard heuristic must not widen to arbitrary brackets.
    assertEquals(
      isDiscardableTextExecuteResult(
        execResult(["[1, 2, 3,\n", " 4, 5, 6]"]),
        true,
      ),
      false,
      "multi-line list with no matplotlib reference must be kept",
    );
    // An arbitrary multi-line repr with no matplotlib reference must survive.
    assertEquals(
      isDiscardableTextExecuteResult(
        execResult(["MyResult(\n", "  value=42,\n", ")"]),
        true,
      ),
      false,
      "multi-line custom repr with no matplotlib reference must be kept",
    );
    // Multiple mime types (e.g. a DataFrame's text/plain + text/html) -> keep.
    assertEquals(
      isDiscardableTextExecuteResult(
        {
          output_type: "execute_result",
          data: { [kTextPlain]: dataFrameText, "text/html": ["<table>"] },
        },
        true,
      ),
      false,
      "multi-mime output (DataFrame text/plain + text/html) must be kept",
    );

    // Only execute_result is ever discardable.
    assertEquals(
      isDiscardableTextExecuteResult(
        { output_type: "display_data", data: { [kTextPlain]: titleText } },
        true,
      ),
      false,
      "display_data must never be discarded",
    );
    assertEquals(
      isDiscardableTextExecuteResult(
        { output_type: "stream", name: "stdout", text: titleText },
        true,
      ),
      false,
      "stream output must never be discarded",
    );
  },
);
