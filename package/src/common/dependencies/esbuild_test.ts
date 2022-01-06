import { assertEquals } from "testing/asserts.ts";
import { esBuild } from "./esbuild.ts";

Deno.test("esbuild arm and x86 urls are created properly", async () => {
  // using the esbuild version configured as of 2022-01-06
  // the constructed URLs can also be compared seeing docs at:
  // https://esbuild.github.io/getting-started/#download-a-build
  const vals = await esBuild("0.12.10");
  const linuxURLs = [
    vals.architectureDependencies["x86_64"]["linux"].url,
    vals.architectureDependencies["aarch64"]["linux"].url,
  ];
  const windowsURL = vals.architectureDependencies["x86_64"]["windows"].url;
  const macURL = vals.architectureDependencies["aarch64"]["darwin"].url;
  // these URL's were all confirmed on 2022-01-06 by @dpastoor to be valid downloads
  // rather than fetching each time since is ~ 4MB each DL
  assertEquals(linuxURLs, [
    "https://registry.npmjs.org/esbuild-linux-64/-/esbuild-linux-64-0.12.10.tgz",
    "https://registry.npmjs.org/esbuild-linux-arm64/-/esbuild-linux-arm64-0.12.10.tgz",
  ]);
  assertEquals(
    macURL,
    "https://registry.npmjs.org/esbuild-darwin-arm64/-/esbuild-darwin-arm64-0.12.10.tgz",
  );
  assertEquals(
    windowsURL,
    "https://registry.npmjs.org/esbuild-windows-64/-/esbuild-windows-64-0.12.10.tgz",
  );
});
