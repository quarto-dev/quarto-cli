import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "testing/asserts.ts";
import { download, downloadFile } from "./utils.ts";
import { Buffer } from "io/buffer.ts";
import { join } from "path/mod.ts";

// 560 byte text file
const validTextDl =
  "https://github.com/quarto-dev/quarto-cli/releases/download/v0.2.418/quarto-0.2.418-checksums.txt";

const validZipDl =
  "https://github.com/tidyverse/dplyr/archive/refs/tags/v1.0.7.zip";
Deno.test("download works", async () => {
  const tfilestr = await Deno.makeTempFile();
  const tfile = await Deno.open(tfilestr, {
    read: true,
    write: true,
  });
  // just picked a random, small, accessible file in the repo
  await download(
    validTextDl,
    tfile,
  );

  // file should already be closed
  assertThrows(tfile.close);
  const fileInfo = await Deno.lstat(tfilestr);
  // the checksums.txt file is 560 bytes according to github assets
  assertEquals(fileInfo.size, 560);
});

Deno.test("download can write to buffer", async () => {
  const buff = new Buffer();
  // just picked a random, small, accessible file in the repo
  await download(
    validTextDl,
    buff,
  );

  // file should already be closed
  assertEquals(buff.bytes().length, 560);
  assertStringIncludes(
    new TextDecoder().decode(buff.bytes()),
    "quarto-0.2.418",
  );
});

Deno.test("download properly throws", async () => {
  const tfile = await Deno.open(await Deno.makeTempFile(), {
    read: true,
    write: true,
  });

  // just picked a random, small, accessible file in the repo
  await assertRejects(
    () => {
      return download(
        "https://github.com/thisdefinitely/wontexist/as/a/url",
        tfile,
      );
    },
  );
  // this should still be closed even though couldn't write to it
  assertThrows(tfile.close);
});

Deno.test("download closes writer unless explicitly set", async () => {
  const tfilestr = await Deno.makeTempFile();
  const tfile = await Deno.open(tfilestr, {
    read: true,
    write: true,
  });
  // just picked a random, small, accessible file in the repo
  await download(
    validTextDl,
    tfile,
    undefined,
    { autoClose: false },
  );

  // this is the key to this test, see below comment when dl fails
  // for why this will work (tl;dr this will cause test to fail if
  // autoclose behavior is not correct)
  tfile.close();
  const fileInfo = await Deno.lstat(tfilestr);
  // the checksums.txt file is 560 bytes according to github assets
  assertEquals(fileInfo.size, 560);
});

Deno.test("download closes writer unless explicitly set, even when dl fails", async () => {
  const tfile = await Deno.open(await Deno.makeTempFile(), {
    read: true,
    write: true,
  });

  // just picked a random, small, accessible file in the repo
  await assertRejects(
    () => {
      return download(
        "https://github.com/thisdefinitely/wontexist/as/a/url",
        tfile,
        undefined,
        { autoClose: false },
      );
    },
  );
  tfile.close();
  // closing this with autoClose default behavior of true will
  // cause the test to throw with a bad resource ID error

  // if you don't close this the test will still fail with:

  //   AssertionError: Test case is leaking resources.
  // Before: {
  //   "0": "stdin",
  //   "1": "stdout",
  //   "2": "stderr"
  // }
  // After: {
  //   "0": "stdin",
  //   "1": "stdout",
  //   "2": "stderr",
  //   "3": "fsFile"
  // }

  // Make sure to close all open resource handles returned from Deno APIs before
  // finishing test case.
});

Deno.test("validator func can check response", async () => {
  const buff = new Buffer();
  const errorToThrow = new Error("response type is bad");
  let actualError;
  // this would otherwise succeed, but
  // will be of type application/octet-stream
  // generally would want to check to make sure it was indeed such
  // a type, however in this case we'll just look for a nonsense
  // content-type and throw the error
  try {
    await download(
      validTextDl,
      buff,
      (resp) => {
        if (resp.headers.get("content-type") != "bad") {
          throw errorToThrow;
        }
      },
    );
  } catch (err) {
    actualError = err;
  }
  assertEquals(actualError, errorToThrow);
});

Deno.test("downloadFile works for zip file in nested dir", async () => {
  const nestedFile = join(
    await Deno.makeTempDir(),
    "another",
    "dir",
    "file.zip",
  );
  await downloadFile(validZipDl, nestedFile);
  const res = await Deno.lstat(nestedFile);
  assertEquals(res.size, 846670);
});

Deno.test("downloadFile errors on bad dl's gracefully", async () => {
  const nestedFile = join(
    await Deno.makeTempDir(),
    "another",
    "dir",
    "file.zip",
  );
  let actualError;
  try {
    await downloadFile(
      "https://github.com/tidyverse/dplyr/archive/refs/tags/notreal.zip",
      nestedFile,
    );
  } catch (err) {
    actualError = err;
  }
  assertStringIncludes(actualError.message, "unable to download");
});
Deno.test("downloadFile errors on non-file dls gracefully", async () => {
  const nestedFile = join(
    await Deno.makeTempDir(),
    "file.zip",
  );
  let actualError;
  try {
    await downloadFile(
      "https://github.com",
      nestedFile,
    );
  } catch (err) {
    actualError = err;
  }
  assertStringIncludes(actualError.message, "content-type not valid");
});
