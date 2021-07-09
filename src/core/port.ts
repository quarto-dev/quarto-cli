/*
* port.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { getAvailablePortSync, isPortAvailableSync } from "port/mod.ts";

export const kLocalhost = "127.0.0.1";

export function findOpenPort(defaultPort: number): number {
  if (isPortAvailableSync({ port: defaultPort, hostname: kLocalhost })) {
    return defaultPort;
  } else {
    while (true) {
      const port = getAvailablePortSync({
        port: { start: 3000, end: 8000 },
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
