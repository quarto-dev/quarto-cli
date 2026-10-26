import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {parseCell} from "@observablehq/parser";

(async () => {
  for (const file of fs.readdirSync(path.join("test", "input"))) {
    it(`parse ${file}`, () => {
      const extension = file.substring(file.indexOf(".")); // path.extname, but taking the first dot
      const infile = path.join("test", "input", file);
      const outfile = path.resolve(path.join("test", "output"), `${file}.json`);

      const input = fs.readFileSync(infile, "utf8");
      let cell;
      try {
        cell = parseCell(input, {
          globals: null,
          tag:
            extension === ".sql"
              ? "db.sql"
              : extension === ".db.sql"
              ? `(await DatabaseClient("database")).sql`
              : extension === ".html"
              ? "htl.html"
              : extension === ".tex"
              ? "tex.block"
              : extension === ".md"
              ? "md"
              : undefined,
          raw: extension == ".tex"
        });
      } catch (error) {
        if (
          error instanceof ReferenceError ||
          error instanceof SyntaxError ||
          error instanceof TypeError
        ) {
          if (!error.loc) throw error; // internal unexpected error
          cell = {
            error: {
              type: error.constructor.name,
              message: error.message,
              pos: error.pos,
              loc: {
                line: error.loc.line,
                column: error.loc.column
              }
            }
          };
        } else {
          throw error;
        }
      }

      const actual = JSON.stringify(cell, stringify, 2);

      let expected;
      try {
        expected = fs.readFileSync(outfile, "utf8");
      } catch (error) {
        if (error.code === "ENOENT" && process.env.CI !== "true") {
          console.warn(`! generating ${outfile}`);
          fs.writeFileSync(outfile, actual, "utf8");
          return;
        } else {
          throw error;
        }
      }

      assert.strictEqual(actual, expected, `${file} must match snapshot`);
    });
  }
})();

// Convert to a serializable representation.
function stringify(key, value) {
  return typeof value === "bigint" ? value.toString()
    : value instanceof Map ? [...value]
    : value;
}
