/*
 * tar-command.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import {
  makeTarballCommand,
  resolveTarBinary,
  tarCompressFlag,
  unTarCommand,
  windowsSystemTar,
} from "../../package/src/util/tar.ts";

unitTest("windowsSystemTar - builds the System32 path", async () => {
  assertEquals(
    windowsSystemTar("C:\\WINDOWS"),
    "C:\\WINDOWS\\System32\\tar.exe",
  );
});

unitTest(
  "windowsSystemTar - falls back to C:\\Windows when unset or empty",
  async () => {
    assertEquals(windowsSystemTar(), "C:\\Windows\\System32\\tar.exe");
    assertEquals(windowsSystemTar(""), "C:\\Windows\\System32\\tar.exe");
  },
);

unitTest("windowsSystemTar - honours a relocated system root", async () => {
  assertEquals(windowsSystemTar("D:\\Win"), "D:\\Win\\System32\\tar.exe");
});

unitTest(
  "resolveTarBinary - windows prefers System32 bsdtar when present",
  async () => {
    assertEquals(
      resolveTarBinary("windows", "C:\\WINDOWS\\System32\\tar.exe"),
      "C:\\WINDOWS\\System32\\tar.exe",
    );
  },
);

unitTest(
  "resolveTarBinary - windows falls back to PATH when System32 tar is absent",
  async () => {
    assertEquals(resolveTarBinary("windows", undefined), "tar");
  },
);

unitTest(
  "resolveTarBinary - other platforms keep the bare binary",
  async () => {
    assertEquals(resolveTarBinary("linux", "irrelevant"), "tar");
    assertEquals(resolveTarBinary("linux", undefined), "tar");
    assertEquals(resolveTarBinary("darwin", "irrelevant"), "tar");
  },
);

unitTest("tarCompressFlag - zip gets no compression flag", async () => {
  assertEquals(tarCompressFlag("dart-sass-1.101.0-windows-x64.zip"), "");
  assertEquals(tarCompressFlag("typst-x86_64-pc-windows-msvc.zip"), "");
  assertEquals(
    tarCompressFlag("typst-gather-x86_64-pc-windows-msvc.zip"),
    "",
  );
});

unitTest("tarCompressFlag - zip detection is case insensitive", async () => {
  assertEquals(tarCompressFlag("ARCHIVE.ZIP"), "");
});

unitTest("tarCompressFlag - xz and bz2 keep their own flags", async () => {
  assertEquals(tarCompressFlag("typst-x86_64-unknown-linux-musl.tar.xz"), "J");
  assertEquals(tarCompressFlag("something.tar.bz2"), "j");
});

unitTest("tarCompressFlag - gzip forms stay gzip", async () => {
  assertEquals(tarCompressFlag("dart-sass-1.101.0-linux-x64.tar.gz"), "z");
  assertEquals(tarCompressFlag("esbuild-win32-x64.tgz"), "z");
  assertEquals(
    tarCompressFlag("typst-gather-x86_64-unknown-linux-gnu.tar.gz"),
    "z",
  );
});

const kSystemTar = "C:\\WINDOWS\\System32\\tar.exe";

unitTest("unTarCommand - windows zip gets no gzip flag", async () => {
  assertEquals(
    unTarCommand(kSystemTar, "C:\\tools\\typst-x86_64-pc-windows-msvc.zip"),
    [kSystemTar, "-xvf", "C:\\tools\\typst-x86_64-pc-windows-msvc.zip"],
  );
});

unitTest("unTarCommand - linux tar.gz is unchanged from today", async () => {
  assertEquals(
    unTarCommand("tar", "/tools/dart-sass-1.101.0-linux-x64.tar.gz"),
    ["tar", "-xvzf", "/tools/dart-sass-1.101.0-linux-x64.tar.gz"],
  );
});

unitTest("unTarCommand - darwin tar.xz keeps the J flag", async () => {
  assertEquals(
    unTarCommand("tar", "/tools/typst-x86_64-apple-darwin.tar.xz"),
    ["tar", "-xvJf", "/tools/typst-x86_64-apple-darwin.tar.xz"],
  );
});

unitTest("unTarCommand - a directory appends --directory", async () => {
  assertEquals(
    unTarCommand(
      kSystemTar,
      "C:\\tools\\dart-sass-1.101.0-windows-x64.zip",
      "C:\\tools\\x86_64",
    ),
    [
      kSystemTar,
      "-xvf",
      "C:\\tools\\dart-sass-1.101.0-windows-x64.zip",
      "--directory",
      "C:\\tools\\x86_64",
    ],
  );
});

unitTest(
  "makeTarballCommand - darwin form is unchanged from today",
  async () => {
    assertEquals(
      makeTarballCommand("tar", "/src/payload", "/out/bundle.tar.gz", false),
      ["tar", "czvf", "/out/bundle.tar.gz", "/src/payload"],
    );
  },
);

unitTest(
  "makeTarballCommand - changewd wraps the input with -C and dot",
  async () => {
    assertEquals(
      makeTarballCommand("tar", "/src/payload", "/out/bundle.tar.gz", true),
      ["tar", "czvf", "/out/bundle.tar.gz", "-C", "/src/payload", "."],
    );
  },
);

unitTest(
  "makeTarballCommand - carries whatever binary it is handed",
  async () => {
    assertEquals(
      makeTarballCommand(
        kSystemTar,
        "C:\\src\\payload",
        "C:\\out\\bundle.tar.gz",
        false,
      ),
      [kSystemTar, "czvf", "C:\\out\\bundle.tar.gz", "C:\\src\\payload"],
    );
  },
);
