/**
 * cri.ts
 *
 * Chrome Remote Interface
 *
 * Copyright (c) 2022 by RStudio, PBC.
 */

import cdp from "./deno-cri/index.js";
import { decode } from "encoding/base64.ts";
import { getBrowserExecutablePath } from "../puppeteer.ts";
import { Semaphore } from "../lib/semaphore.ts";

async function waitForServer(port: number, timeout = 3000) {
  const interval = 500;
  let soFar = 0;

  do {
    try {
      const response = await fetch(`http://localhost:${port}/json/list`);
      if (response.status !== 200) {
        soFar += interval;
        await new Promise((resolve) => setTimeout(resolve, interval));
        continue;
      } else {
        return true;
      }
    } catch (_e) {
      soFar += interval;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  } while (soFar < timeout);
  return false;
}

const criSemaphore = new Semaphore(1);

export function withCriClient<T>(
  fn: (client: Awaited<ReturnType<typeof criClient>>) => Promise<T>,
  appPath?: string,
  port = 9222,
): Promise<T> {
  return criSemaphore.runExclusive(async () => {
    const client = await criClient(appPath, port);
    try {
      const result = await fn(client);
      await client.close();
      return result;
    } catch (e) {
      await client.close();
      throw e;
    }
  });
}

export async function criClient(appPath?: string, port = 9222) {
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

  if (!(await waitForServer(port))) {
    throw new Error("Couldn't find open server");
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
