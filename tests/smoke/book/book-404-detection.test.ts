import { testQuartoCmd } from "../../test.ts";
import { fileExists, noErrorsOrWarnings } from "../../verify.ts";
import { existsSync } from "../../../src/deno_ral/fs.ts";
import { join } from "../../../src/deno_ral/path.ts";
import { docs } from "../../utils.ts";

// Test that book 404 page with .ipynb extension is detected
const inputIpynb = docs("books/book-404-detection");
const outputDirIpynb = join(inputIpynb, "_book");

testQuartoCmd(
  "render",
  [inputIpynb],
  [
    noErrorsOrWarnings,
    fileExists(join(outputDirIpynb, "index.html")),
    fileExists(join(outputDirIpynb, "chapter1.html")),
    fileExists(join(outputDirIpynb, "404.html")),
    fileExists(join(outputDirIpynb, "search.json")),
  ],
  {
    teardown: async () => {
      if (existsSync(outputDirIpynb)) {
        await Deno.remove(outputDirIpynb, { recursive: true });
      }
    },
  },
);

// Test that book 404 page with .rmd extension is detected
const inputRmd = docs("books/book-404-rmd");
const outputDirRmd = join(inputRmd, "_book");

testQuartoCmd(
  "render",
  [inputRmd],
  [
    noErrorsOrWarnings,
    fileExists(join(outputDirRmd, "index.html")),
    fileExists(join(outputDirRmd, "chapter1.html")),
    fileExists(join(outputDirRmd, "404.html")),
    fileExists(join(outputDirRmd, "search.json")),
  ],
  {
    teardown: async () => {
      if (existsSync(outputDirRmd)) {
        await Deno.remove(outputDirRmd, { recursive: true });
      }
    },
  },
);
