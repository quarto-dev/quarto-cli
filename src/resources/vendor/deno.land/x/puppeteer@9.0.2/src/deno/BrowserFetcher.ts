/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Product } from "../../vendor/puppeteer-core/puppeteer/common/Product.js";
import { debug } from "../../vendor/puppeteer-core/puppeteer/common/Debug.js";
import { assert } from "../../vendor/puppeteer-core/puppeteer/common/assert.js";
import {
  copyDir,
  exists,
  existsSync,
  pathJoin,
  pathResolve,
  sprintf,
} from "../../vendor/puppeteer-core/vendor/std.ts";
import { readZip } from "../../vendor/puppeteer-core/vendor/zip/mod.ts";
import { cachedir } from "../../vendor/puppeteer-core/vendor/cache.ts";

const debugFetcher = debug(`puppeteer:fetcher`);

const downloadURLs = {
  chrome: {
    linux: "%s/chromium-browser-snapshots/Linux_x64/%d/%s.zip",
    mac: "%s/chromium-browser-snapshots/Mac/%d/%s.zip",
    win32: "%s/chromium-browser-snapshots/Win/%d/%s.zip",
    win64: "%s/chromium-browser-snapshots/Win_x64/%d/%s.zip",
  },
  firefox: {
    linux: "%s/firefox-%s.en-US.%s-x86_64.tar.bz2",
    mac: "%s/firefox-%s.en-US.%s.dmg",
    win32: "%s/firefox-%s.en-US.%s.zip",
    win64: "%s/firefox-%s.en-US.%s.zip",
  },
} as const;

const browserConfig = {
  chrome: {
    host: "https://storage.googleapis.com",
    destination: "chromium",
  },
  firefox: {
    host:
      "https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central",
    destination: "firefox",
  },
} as const;

/**
 * Supported platforms.
 * @public
 */
export type Platform = "linux" | "mac" | "win32" | "win64";

function archiveName(
  product: Product,
  platform: Platform,
  revision: string
): string {
  if (product === "chrome") {
    if (platform === "linux") return "chrome-linux";
    if (platform === "mac") return "chrome-mac";
    if (platform === "win32" || platform === "win64") {
      // Windows archive name changed at r591479.
      return parseInt(revision, 10) > 591479 ? "chrome-win" : "chrome-win32";
    }
  } else if (product === "firefox") {
    return platform;
  }
  throw new Error(`Unknown product: ${product}`);
}

/**
 * @internal
 */
function downloadURL(
  product: Product,
  platform: Platform,
  host: string,
  revision: string
): string {
  const url = sprintf(
    downloadURLs[product][platform],
    host,
    revision,
    archiveName(product, platform, revision)
  );
  return url;
}

/**
 * @internal
 */
async function handleArm64(): Promise<void> {
  const stats = await Deno.stat("/usr/bin/chromium-browser");
  if (stats === undefined) {
    console.error(`The chromium binary is not available for arm64: `);
    console.error(`If you are on Ubuntu, you can install with: `);
    console.error(`\n apt-get install chromium-browser\n`);
    throw new Error();
  }
}

/**
 * @public
 */
export interface BrowserFetcherOptions {
  platform?: Platform;
  product?: string;
  path?: string;
  host?: string;
}

/**
 * @public
 */
export interface BrowserFetcherRevisionInfo {
  folderPath: string;
  executablePath: string;
  url: string;
  local: boolean;
  revision: string;
  product: string;
}
/**
 * BrowserFetcher can download and manage different versions of Chromium and Firefox.
 *
 * @remarks
 * BrowserFetcher operates on revision strings that specify a precise version of Chromium, e.g. `"533271"`. Revision strings can be obtained from {@link http://omahaproxy.appspot.com/ | omahaproxy.appspot.com}.
 * In the Firefox case, BrowserFetcher downloads Firefox Nightly and
 * operates on version numbers such as `"75"`.
 *
 * @example
 * An example of using BrowserFetcher to download a specific version of Chromium
 * and running Puppeteer against it:
 *
 * ```js
 * const browserFetcher = puppeteer.createBrowserFetcher();
 * const revisionInfo = await browserFetcher.download('533271');
 * const browser = await puppeteer.launch({executablePath: revisionInfo.executablePath})
 * ```
 *
 * **NOTE** BrowserFetcher is not designed to work concurrently with other
 * instances of BrowserFetcher that share the same downloads directory.
 *
 * @public
 */

export class BrowserFetcher {
  private _product: Product;
  private _downloadsFolder: string;
  private _downloadHost: string;
  private _platform!: Platform;

  /**
   * @internal
   */
  constructor(options: BrowserFetcherOptions = {}) {
    this._product = (options.product || "chrome").toLowerCase() as Product;
    assert(
      this._product === "chrome" || this._product === "firefox",
      `Unknown product: "${options.product}"`
    );

    this._downloadsFolder =
      options.path ||
      pathJoin(
        cachedir(),
        "deno_puppeteer",
        browserConfig[this._product].destination
      );
    this._downloadHost = options.host || browserConfig[this._product].host;
    this.setPlatform(options.platform);
    assert(
      downloadURLs[this._product][this._platform],
      "Unsupported platform: " + this._platform
    );
  }

  private setPlatform(platformFromOptions?: Platform): void {
    if (platformFromOptions) {
      this._platform = platformFromOptions;
      return;
    }

    const platform = Deno.build.os;
    if (platform === "darwin") this._platform = "mac";
    else if (platform === "linux") this._platform = "linux";
    else if (platform === "windows") {
      this._platform = Deno.build.arch === "x86_64" ? "win64" : "win32";
    } else assert(this._platform, "Unsupported platform: " + Deno.build.os);
  }

  /**
   * @returns Returns the current `Platform`.
   */
  platform(): Platform {
    return this._platform;
  }

  /**
   * @returns Returns the current `Product`.
   */
  product(): Product {
    return this._product;
  }

  /**
   * @returns The download host being used.
   */
  host(): string {
    return this._downloadHost;
  }

  /**
   * Initiates a HEAD request to check if the revision is available.
   * @remarks
   * This method is affected by the current `product`.
   * @param revision - The revision to check availability for.
   * @returns A promise that resolves to `true` if the revision could be downloaded
   * from the host.
   */
  async canDownload(revision: string): Promise<boolean> {
    const url = downloadURL(
      this._product,
      this._platform,
      this._downloadHost,
      revision
    );
    const req = await fetch(url, { method: "head" });
    return req.status == 200;
  }

  /**
   * Initiates a GET request to download the revision from the host.
   * @remarks
   * This method is affected by the current `product`.
   * @param revision - The revision to download.
   * @param progressCallback - A function that will be called with two arguments:
   * How many bytes have been downloaded and the total number of bytes of the download.
   * @returns A promise with revision information when the revision is downloaded
   * and extracted.
   */
  async download(
    revision: string,
    progressCallback: (x: number, y: number) => void = (): void => {}
  ): Promise<BrowserFetcherRevisionInfo> {
    const url = downloadURL(
      this._product,
      this._platform,
      this._downloadHost,
      revision
    );
    const fileName = url.split("/").pop()!;
    const archivePath = pathJoin(this._downloadsFolder, fileName);
    const outputPath = this._getFolderPath(revision);
    if (await exists(outputPath)) return this.revisionInfo(revision);
    if (!(await exists(this._downloadsFolder))) {
      await Deno.mkdir(this._downloadsFolder, { recursive: true });
    }
    if ((Deno.build.arch as string) === "arm64") {
      // handleArm64();
      // return;
      console.error("arm64 downloads not supported.");
      console.error(
        "Use PUPPETEER_EXECUTABLE_PATH to specify an executable path."
      );
      throw new Error();
    }
    try {
      await downloadFile(url, archivePath, progressCallback);
      await install(archivePath, outputPath);
    } finally {
      if (await exists(archivePath)) {
        await Deno.remove(archivePath, { recursive: true });
      }
    }
    const revisionInfo = this.revisionInfo(revision);
    if (revisionInfo && Deno.build.os !== "windows") {
      await Deno.chmod(revisionInfo.executablePath, 0o755);
      if (Deno.build.os === "darwin" && this._product === "chrome") {
        await macOSMakeChromiumHelpersExecutable(revisionInfo.executablePath);
      }
    }
    return revisionInfo;
  }

  /**
   * @remarks
   * This method is affected by the current `product`.
   * @returns A promise with a list of all revision strings (for the current `product`)
   * available locally on disk.
   */
  async localRevisions(): Promise<string[]> {
    if (!(await exists(this._downloadsFolder))) return [];
    const fileNames = [];
    for await (const file of Deno.readDir(this._downloadsFolder)) {
      fileNames.push(file.name);
    }
    return fileNames
      .map((fileName) => parseName(this._product, fileName))
      .filter((entry) => entry && entry.platform === this._platform)
      .map((entry) => entry!.revision);
  }

  /**
   * @remarks
   * This method is affected by the current `product`.
   * @param revision - A revision to remove for the current `product`.
   * @returns A promise that resolves when the revision has been removes or
   * throws if the revision has not been downloaded.
   */
  async remove(revision: string): Promise<void> {
    const folderPath = this._getFolderPath(revision);
    assert(
      await exists(folderPath),
      `Failed to remove: revision ${revision} is not downloaded`
    );
    await Deno.remove(folderPath, { recursive: true });
  }

  /**
   * @param revision - The revision to get info for.
   * @returns The revision info for the given revision.
   */
  revisionInfo(revision: string): BrowserFetcherRevisionInfo {
    const folderPath = this._getFolderPath(revision);
    let executablePath = "";
    if (this._product === "chrome") {
      if (this._platform === "mac") {
        executablePath = pathJoin(
          folderPath,
          archiveName(this._product, this._platform, revision),
          "Chromium.app",
          "Contents",
          "MacOS",
          "Chromium"
        );
      } else if (this._platform === "linux") {
        executablePath = pathJoin(
          folderPath,
          archiveName(this._product, this._platform, revision),
          "chrome"
        );
      } else if (this._platform === "win32" || this._platform === "win64") {
        executablePath = pathJoin(
          folderPath,
          archiveName(this._product, this._platform, revision),
          "chrome.exe"
        );
      } else throw new Error("Unsupported platform: " + this._platform);
    } else if (this._product === "firefox") {
      if (this._platform === "mac") {
        executablePath = pathJoin(
          folderPath,
          "Firefox Nightly.app",
          "Contents",
          "MacOS",
          "firefox"
        );
      } else if (this._platform === "linux") {
        executablePath = pathJoin(folderPath, "firefox", "firefox");
      } else if (this._platform === "win32" || this._platform === "win64") {
        executablePath = pathJoin(folderPath, "firefox", "firefox.exe");
      } else throw new Error("Unsupported platform: " + this._platform);
    } else {
      throw new Error("Unsupported product: " + this._product);
    }
    const url = downloadURL(
      this._product,
      this._platform,
      this._downloadHost,
      revision
    );
    const local = existsSync(folderPath);
    debugFetcher({
      revision,
      executablePath,
      folderPath,
      local,
      url,
      product: this._product,
    });
    return {
      revision,
      executablePath,
      folderPath,
      local,
      url,
      product: this._product,
    };
  }

  /**
   * @internal
   */
  _getFolderPath(revision: string): string {
    return pathJoin(this._downloadsFolder, this._platform + "-" + revision);
  }
}

function parseName(
  product: Product,
  name: string
): { product: string; platform: string; revision: string } | null {
  const splits = name.split("-");
  if (splits.length !== 2) return null;
  const [platform, revision] = splits;
  if (!downloadURLs[product]?.[platform as "linux"]) return null;
  return { product, platform, revision };
}

/**
 * @internal
 */
async function downloadFile(
  url: string,
  destinationPath: string,
  progressCallback: (x: number, y: number) => void
): Promise<void> {
  debugFetcher(`Downloading binary from ${url}`);

  const response = await fetch(url, { method: "GET" });

  if (response.status !== 200) {
    const error = new Error(
      `Download failed: server returned code ${response.status}. URL: ${url}`
    );

    // consume response data to free up memory
    await response.arrayBuffer();
    throw error;
  }

  const totalBytes = parseInt(response.headers.get("content-length") ?? "", 10);
  let downloadedBytes = 0;

  const file = await Deno.create(destinationPath);

  // @ts-ignore because in lib.dom ReadableStream is not an async iterator yet
  for await (const chunk of response.body!) {
    downloadedBytes += chunk.length;
    progressCallback?.(downloadedBytes, totalBytes);
    await Deno.writeAll(file, chunk);
  }
}

function install(archivePath: string, folderPath: string): Promise<unknown> {
  debugFetcher(`Installing ${archivePath} to ${folderPath}`);
  if (archivePath.endsWith(".zip")) return extractZip(archivePath, folderPath);
  else if (archivePath.endsWith(".tar.bz2")) {
    return extractTar(archivePath, folderPath);
  } else if (archivePath.endsWith(".dmg")) {
    return Deno.mkdir(folderPath, { recursive: true }).then(() =>
      installDMG(archivePath, folderPath)
    );
  } else throw new Error(`Unsupported archive format: ${archivePath}`);
}

async function extractZip(zipPath: string, folderPath: string): Promise<void> {
  const z = await readZip(zipPath);
  await z.unzip(folderPath);
}

/**
 * @internal
 */
async function extractTar(tarPath: string, folderPath: string): Promise<void> {
  console.log(folderPath);
  await Deno.mkdir(folderPath, { recursive: true });

  const bzcat = Deno.run({
    cmd: ["bzcat", tarPath],
    stdout: "piped",
  });
  const tmp = await Deno.makeTempFile();
  const file = await Deno.create(tmp);
  await Deno.copy(bzcat.stdout, file);
  assert((await bzcat.status()).success, "failed bzcat");
  bzcat.close();

  const untar = Deno.run({
    cmd: ["tar", "-C", folderPath, "-xvf", tmp],
  });
  assert((await untar.status()).success, "failed untar");
  untar.close();
}

/**
 * @internal
 */
async function installDMG(dmgPath: string, folderPath: string): Promise<void> {
  let mountPath;
  try {
    const proc = Deno.run({
      cmd: ["hdiutil", "attach", "-nobrowse", "-noautoopen", dmgPath],
    });
    const stdout = new TextDecoder().decode(await proc.output());
    proc.close();
    const volumes = stdout.match(/\/Volumes\/(.*)/m);
    if (!volumes) throw new Error(`Could not find volume path in ${stdout}`);
    mountPath = volumes[0];

    let appName = undefined;
    for await (const file of Deno.readDir(mountPath)) {
      if (file.name.endsWith(".app")) {
        appName = file.name;
        break;
      }
    }
    if (!appName) throw new Error(`Cannot find app in ${mountPath}`);
    copyDir(pathJoin(mountPath, appName), folderPath);
  } finally {
    if (mountPath) {
      const proc = Deno.run({
        cmd: ["hdiutil", "detach", mountPath, "-quiet"],
      });
      debugFetcher(`Unmounting ${mountPath}`);
      const status = await proc.status();
      proc.close();
      assert(status.success, "unmounting failed");
    }
  }
}

/**
 * @internal
 */
async function macOSMakeChromiumHelpersExecutable(executablePath: string) {
  const helperApps = [
    "Chromium Helper",
    "Chromium Helper (GPU)",
    "Chromium Helper (Plugin)",
    "Chromium Helper (Renderer)",
  ];

  const frameworkPath = pathResolve(
    executablePath,
    pathJoin("..", "..", "Frameworks", "Chromium Framework.framework", "Versions"),
  );
  const versionPath = pathJoin(frameworkPath, "Current");

  try {
    const version = await Deno.readTextFile(versionPath);

    for (const helperApp of helperApps) {
      const helperAppPath = pathJoin(
        frameworkPath,
        version,
        "Helpers",
        helperApp + ".app",
        "Contents",
        "MacOS",
        helperApp,
      );
      await Deno.chmod(helperAppPath, 0o755);
    }
  } catch (err) {
    console.error('Failed to make Chromium Helpers executable', String(err));
  }
}
