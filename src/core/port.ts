/*
* port.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { getAvailablePortSync, isPortAvailableSync } from "port/mod.ts";

import { ld } from "lodash/mod.ts";

import { randomInt } from "./random.ts";

export const kLocalhost = "127.0.0.1";

const kMinPort = 3000;
const kMaxPort = 8000;

export function findOpenPort(defaultPort?: number): number {
  defaultPort = defaultPort || randomInt(kMinPort, kMaxPort);
  if (isPortAvailableSync({ port: defaultPort, hostname: kLocalhost })) {
    return defaultPort;
  } else {
    let ports = new Array<number>(kMaxPort - kMinPort);
    for (let i = 0; i < ports.length; i++) {
      ports[i] = kMinPort + i;
    }
    ports = ld.shuffle(ports);
    while (true) {
      const port = getAvailablePortSync({
        port: ports,
        hostname: kLocalhost,
      });
      if (port === undefined) {
        throw new Error("Unabled to find open port for serve");
      }
      // don't use ports considered unsafe by chrome
      if (
        ![3659, 4045, 6000, 6665, 6666, 6667, 6668, 6669, 6697].includes(
          port,
        )
      ) {
        return port;
      }
    }
  }
}
