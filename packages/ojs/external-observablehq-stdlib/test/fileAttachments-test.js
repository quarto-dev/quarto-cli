import assert from "assert";
import {enforceSchema} from "../src/fileAttachment.js";
import {FileAttachments} from "../src/index.js";
import {inferSchema} from "../src/table.js";

it("FileAttachments is exported by stdlib", () => {
  assert.strictEqual(typeof FileAttachments, "function");
  assert.strictEqual(FileAttachments.name, "FileAttachments");
});

it("FileAttachment ensures that URLs are strings", async () => {
  const FileAttachment = FileAttachments((name) =>
    new URL(`https://example.com/${name}.js`)
  );
  const file = FileAttachment("filename");
  assert.strictEqual(file.constructor.name, "FileAttachment");
  assert.strictEqual(await file.url(), "https://example.com/filename.js");
});

it("FileAttachment returns instances of FileAttachment", async () => {
  const FileAttachment = FileAttachments((name) =>
    new URL(`https://example.com/${name}.js`)
  );
  const file = FileAttachment("filename");
  assert.ok(file instanceof FileAttachment);
});

it("FileAttachment cannot be used as a constructor", async () => {
  const FileAttachment = FileAttachments((name) =>
    new URL(`https://example.com/${name}.js`)
  );
  assert.throws(() => new FileAttachment("filename"), /FileAttachment is not a constructor/);
});

it("FileAttachment works with Promises that resolve to URLs", async () => {
  const FileAttachment = FileAttachments(async (name) =>
    new URL(`https://example.com/${name}.js`)
  );
  const file = FileAttachment("otherfile");
  assert.strictEqual(file.constructor.name, "FileAttachment");
  assert.strictEqual(await file.url(), "https://example.com/otherfile.js");
});

it("enforceSchema coerces an array of objects", () => {
  const source = [{a: "0", b: "1", c: "2"}];
  assert.deepStrictEqual(
    enforceSchema(source, inferSchema(source)),
    Object.assign(
      [{a: 0, b: 1, c: 2}],
      {schema: [
        {
          inferred: "integer",
          name: "a",
          type: "integer"
        },
        {
          inferred: "integer",
          name: "b",
          type: "integer"
        },
        {
          inferred: "integer",
          name: "c",
          type: "integer"
        }
      ]}
    )
  );
});
