import { unitTest } from "../test.ts";
import { assert } from "testing/asserts";
import {
  FormatDescriptor,
  parseFormatString,
} from "../../src/core/pandoc/pandoc-formats.ts";

unitTest(
  "pandoc-format",
  // deno-lint-ignore require-await
  async () => {
    const tests: Record<string, FormatDescriptor> = {
      "pdf": {
        baseFormat: "pdf",
        variants: [],
        modifiers: [],
        formatWithVariants: "pdf",
      },
      "acm-pdf": {
        baseFormat: "pdf",
        extension: "acm",
        variants: [],
        modifiers: [],
        formatWithVariants: "pdf",
      },
      "acm-pdf+draft": {
        baseFormat: "pdf",
        extension: "acm",
        variants: [],
        modifiers: ["+draft"],
        formatWithVariants: "pdf",
      },
      "acm-2023-pdf+draft": {
        baseFormat: "pdf",
        extension: "acm-2023",
        variants: [],
        modifiers: ["+draft"],
        formatWithVariants: "pdf",
      },
      "gfm-rebase_relative_paths": {
        baseFormat: "gfm",
        variants: ["-rebase_relative_paths"],
        modifiers: [],
        formatWithVariants: "gfm-rebase_relative_paths",
      },
      "gfm-rebase_relative_paths+markdown_in_html_blocks": {
        baseFormat: "gfm",
        variants: ["-rebase_relative_paths", "+markdown_in_html_blocks"],
        modifiers: [],
        formatWithVariants: "gfm-rebase_relative_paths+markdown_in_html_blocks",
      },
    };

    Object.keys(tests).forEach((test) => {
      const parsed = parseFormatString(test);
      assertDescriptorsEqual(parsed, tests[test]);
    });
  },
);

function assertDescriptorsEqual(
  desc1: FormatDescriptor,
  desc2: FormatDescriptor,
) {
  const msg = (text: string) => {
    return `${text}\n${JSON.stringify(desc1, undefined, 2)}\n${
      JSON.stringify(desc2, undefined, 2)
    }`;
  };

  assert(
    desc1.baseFormat === desc2.baseFormat,
    msg("mismatching base format"),
  );
  assert(
    desc1.formatWithVariants === desc2.formatWithVariants,
    msg("mismatching format variant string"),
  );
  assert(
    arraysEqual(desc1.modifiers, desc2.modifiers),
    msg("mismatching modifiers"),
  );
  assert(
    arraysEqual(desc1.variants, desc2.variants),
    msg("mismatching variants"),
  );
  assert(
    desc1.extension === desc2.extension,
    msg("mismatching format extension"),
  );
}

function arraysEqual(arr1: string[], arr2: string[]) {
  if (arr1.length !== arr2.length) {
    return false;
  }

  const filtered = arr1.filter((val, i) => {
    return val === arr2[i];
  });
  return filtered.length === arr1.length;
}
