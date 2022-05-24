/**
 * Copyright 2020 Google Inc. All rights reserved.
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

import { debug } from "../../vendor/puppeteer-core/puppeteer/common/Debug.js";
import { assert } from "../../vendor/puppeteer-core/puppeteer/common/assert.js";
import {
  debugError,
  helper,
} from "../../vendor/puppeteer-core/puppeteer/common/helper.js";
import { LaunchOptions } from "./LaunchOptions.ts";
import { Connection } from "../../vendor/puppeteer-core/puppeteer/common/Connection.js";
import { BrowserWebSocketTransport } from "../../vendor/puppeteer-core/puppeteer/common/BrowserWebSocketTransport.js";
import { TimeoutError } from "../../vendor/puppeteer-core/puppeteer/common/Errors.js";
import { readLines } from "../../vendor/puppeteer-core/vendor/std.ts";

const debugLauncher = debug("puppeteer:launcher");
const PROCESS_ERROR_EXPLANATION = `Puppeteer was unable to kill the process which ran the browser binary.
This means that, on future Puppeteer launches, Puppeteer might not be able to launch the browser.
Please check your open processes and ensure that the browser processes that Puppeteer launched have been killed.
If you think this is a bug, please report it on the Puppeteer issue tracker.`;

export class BrowserRunner {
  private _executablePath: string;
  private _processArguments: string[];
  private _tempDirectory?: string;

  proc: Deno.Process | undefined = undefined;
  connection: Connection | undefined = undefined;

  private _closed = true;
  private _listeners = [];
  private _processClosing!: Promise<void>;

  constructor(
    executablePath: string,
    processArguments: string[],
    tempDirectory?: string
  ) {
    this._executablePath = executablePath;
    this._processArguments = processArguments;
    this._tempDirectory = tempDirectory;
  }

  start(options: LaunchOptions): void {
    const { env, dumpio } = options;
    assert(!this.proc, "This process has previously been started.");
    debugLauncher(
      `Calling ${this._executablePath} ${this._processArguments.join(" ")}`
    );
    this.proc = Deno.run({
      cmd: [this._executablePath, ...this._processArguments],
      env,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });
    this._closed = false;
    this._processClosing = this.proc.status().then(async (status) => {
      this._closed = true;
      try {
        if (this.proc) {
          if (!status.success && dumpio) {
            await Deno.copy(this.proc.stdout!, Deno.stdout);
            await Deno.copy(this.proc.stderr!, Deno.stderr);
          }
          this.proc.stdin!.close();
          this.proc.stdout!.close();
          this.proc.stderr!.close();
          this.proc.close();
        }
      } catch (err) {
        if (!(err instanceof Deno.errors.BadResource)) {
          throw err;
        }
      }
      if (this._tempDirectory) {
        await Deno.remove(this._tempDirectory, {
          recursive: true,
        }).catch((error) => {});
      }
    });
  }

  close(): Promise<void> {
    if (this._closed) return Promise.resolve();
    if (this._tempDirectory) {
      this.kill();
    } else if (this.connection) {
      // Attempt to close the browser gracefully
      this.connection.send("Browser.close").catch((error) => {
        debugError(error);
        this.kill();
      });
    }
    // Cleanup this listener last, as that makes sure the full callback runs. If we
    // perform this earlier, then the previous function calls would not happen.
    helper.removeEventListeners(this._listeners);
    return this._processClosing;
  }

  kill(): void {
    // Attempt to remove temporary profile directory to avoid littering.
    try {
      if (this._tempDirectory) {
        Deno.removeSync(this._tempDirectory, { recursive: true });
      }
    } catch (error) {}

    // If the process failed to launch (for example if the browser executable path
    // is invalid), then the process does not get a pid assigned. A call to
    // `proc.kill` would error, as the `pid` to-be-killed can not be found.
    if (this.proc && this.proc.pid && !this._closed) {
      try {
        this.proc.kill("SIGKILL");
      } catch (error) {
        throw new Error(
          `${PROCESS_ERROR_EXPLANATION}\nError cause: ${error.stack}`
        );
      }
    }
    // Cleanup this listener last, as that makes sure the full callback runs. If we
    // perform this earlier, then the previous function calls would not happen.
    helper.removeEventListeners(this._listeners);
  }

  async setupConnection(options: {
    timeout: number;
    slowMo: number;
    preferredRevision: string;
  }): Promise<Connection> {
    const { timeout, slowMo, preferredRevision } = options;
    const browserWSEndpoint = await waitForWSEndpoint(
      this.proc!,
      timeout,
      preferredRevision
    );
    const transport = await BrowserWebSocketTransport.create(browserWSEndpoint);
    this.connection = new Connection(browserWSEndpoint, transport, slowMo);
    return this.connection;
  }
}

async function waitForWSEndpoint(
  browserProcess: Deno.Process,
  timeout: number,
  preferredRevision: string
): Promise<string> {
  const timeId = setTimeout(() => {
    throw new TimeoutError(
      `Timed out after ${timeout} ms while trying to connect to the browser! Only Chrome at revision r${preferredRevision} is guaranteed to work.`
    );
  }, timeout);

  for await (const line of readLines(browserProcess.stderr!)) {
    const match = line.match(/^DevTools listening on (ws:\/\/.*)$/);
    if (match) {
      clearTimeout(timeId);
      return match[1];
    }
  }

  clearTimeout(timeId);
  throw new Error(
    [
      "Failed to launch the browser process!" + "",
      "TROUBLESHOOTING: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md",
      "",
    ].join("\n")
  );
}
