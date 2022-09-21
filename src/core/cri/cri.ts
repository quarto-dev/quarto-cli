/**
 * cri.ts
 *
 * Chrome Remote Interface
 *
 * Copyright (c) 2022 by RStudio, PBC.
 */

import { decode } from "encoding/base64.ts";
import cdp from "./deno-cri/index.js";
import { getBrowserExecutablePath } from "../puppeteer.ts";
import { Semaphore } from "../lib/semaphore.ts";
import { findOpenPort } from "../port.ts";
import { getNamedLifetime, ObjectWithLifetime } from "../lifetimes.ts";

async function waitForServer(port: number, timeout = 3000) {
  const interval = 50;
  let soFar = 0;

  do {
    try {
      const response = await fetch(`http://localhost:${port}/json/list`);
      if (response.status !== 200) {
        throw new Error("");
      }
      return true;
    } catch (_e) {
      soFar += interval;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  } while (soFar < timeout);
  return false;
}

const criSemaphore = new Semaphore(1);

export type CriClient = Awaited<ReturnType<typeof criClient>>;

export function withCriClient<T>(
  fn: (client: CriClient) => Promise<T>,
  appPath?: string,
  port?: number,
): Promise<T> {
  if (port === undefined) {
    port = findOpenPort(9222);
  }

  return criSemaphore.runExclusive(async () => {
    const lifetime = getNamedLifetime("render-file");
    if (lifetime === undefined) {
      throw new Error("Internal Error: named lifetime render-file not found");
    }
    let client: CriClient;
    if (lifetime.get("cri-client") === undefined) {
      client = await criClient(appPath, port);
      lifetime.attach({
        client,
        async cleanup() {
          await client.close();
        },
      } as ObjectWithLifetime, "cri-client");
    } else {
      // deno-lint-ignore no-explicit-any
      client = (lifetime.get("cri-client") as any).client as CriClient;
    }

    // this must be awaited since we're in runExclusive.
    return await fn(client);
  });
}

export async function criClient(appPath?: string, port?: number) {
  if (port === undefined) {
    port = findOpenPort(9222);
  }
  if (appPath === undefined) {
    appPath = await getBrowserExecutablePath();
  }

  const cmd = [
    appPath as string,
    "--headless",
    "--no-sandbox",
    "--single-process",
    "--disable-gpu",
    `--remote-debugging-port=${port}`,
  ];
  const browser = Deno.run({ cmd, stdout: "piped", stderr: "piped" });

  if (!(await waitForServer(port as number))) {
    let msg = "Couldn't find open server.";
    // Printing more error information if chrome process errored
    if (!(await browser.status()).success) {
      const rawError = await browser.stderrOutput();
      const errorString = new TextDecoder().decode(rawError);
      msg = msg + "\n" + `Chrome process error: ${errorString}`;
    }

    throw new Error(msg);
  }

  // deno-lint-ignore no-explicit-any
  let client: any;

  const result = {
    close: async () => {
      await client.close();
      browser.close();
    },

    rawClient: () => client,

    open: async (url: string) => {
      client = await cdp();
      const { Network, Page } = client;
      await Network.enable();
      await Page.enable();
      await Page.navigate({ url });
      return new Promise((fulfill, _reject) => {
        Page.loadEventFired(() => {
          fulfill(null);
        });
      });
    },

    docQuerySelectorAll: async (cssSelector: string): Promise<number[]> => {
      await client.DOM.enable();
      const doc = await client.DOM.getDocument();
      const nodeIds = await client.DOM.querySelectorAll({
        nodeId: doc.root.nodeId,
        selector: cssSelector,
      });
      return nodeIds.nodeIds;
    },

    contents: async (cssSelector: string): Promise<string[]> => {
      const nodeIds = await result.docQuerySelectorAll(cssSelector);
      return Promise.all(
        // deno-lint-ignore no-explicit-any
        nodeIds.map(async (nodeId: any) => {
          return (await client.DOM.getOuterHTML({ nodeId })).outerHTML;
        }),
      );
    },

    // defaults to screenshotting at 4x scale = 392dpi.
    screenshots: async (
      cssSelector: string,
      scale = 4,
    ): Promise<{ nodeId: number; data: Uint8Array }[]> => {
      const nodeIds = await result.docQuerySelectorAll(cssSelector);
      const lst: { nodeId: number; data: Uint8Array }[] = [];
      for (const nodeId of nodeIds) {
        // the docs say that inline elements might return more than one box
        // TODO what do we do in that case?
        let quad;
        try {
          quad = (await client.DOM.getContentQuads({ nodeId })).quads[0];
        } catch (_e) {
          // TODO report error?
          continue;
        }
        const minX = Math.min(quad[0], quad[2], quad[4], quad[6]);
        const maxX = Math.max(quad[0], quad[2], quad[4], quad[6]);
        const minY = Math.min(quad[1], quad[3], quad[5], quad[7]);
        const maxY = Math.max(quad[1], quad[3], quad[5], quad[7]);
        try {
          const screenshot = await client.Page.captureScreenshot({
            clip: {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
              scale,
            },
            fromSurface: true,
            captureBeyondViewport: true,
          });
          const buf = decode(screenshot.data);
          lst.push({ nodeId, data: buf });
        } catch (_e) {
          // TODO report error?
          continue;
        }
      }
      return lst;
    },
  };
  return result;
}
