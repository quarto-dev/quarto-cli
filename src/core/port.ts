/*
 * port.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import * as ld from "./lodash.ts";

import { randomInt } from "./random.ts";
import { sleep } from "./wait.ts";

import { kLocalhost } from "./port-consts.ts";

const kMinPort = 3000;
const kMaxPort = 8000;

function isPortSafe(port: number): boolean {
  // cf https://superuser.com/a/188070
  // excludes port numbers that chrome considers unsafe
  return ![
    3659, // apple-sasl / PasswordServer
    4045, // lockd
    5060, // sip
    5061, // sips
    6000, // X11
    6566, // sane-port
    6665, // Alternate IRC [Apple addition]
    6666, // Alternate IRC [Apple addition]
    6667, // Standard IRC [Apple addition]
    6668, // Alternate IRC [Apple addition]
    6669, // Alternate IRC [Apple addition]
    6697, // IRC + TLS
  ].includes(port);
}

function randomSafePort(): number {
  let result: number;
  do {
    result = randomInt(kMinPort, kMaxPort);
  } while (!isPortSafe(result));
  return result;
}

export function findOpenPort(defaultPort?: number): number {
  defaultPort = defaultPort || randomSafePort();
  if (isPortAvailableSync({ port: defaultPort, hostname: kLocalhost })) {
    return defaultPort;
  } else {
    let ports: number[] = [];
    for (let i = kMinPort; i < kMaxPort; ++i) {
      if (isPortSafe(i)) {
        ports.push(i);
      }
    }
    while (true) {
      ports = ld.shuffle(ports);
      const port = getAvailablePortSync({
        port: ports,
        hostname: kLocalhost,
      });
      if (port === undefined) {
        throw new Error("Unable to find open port");
      }
      // don't use ports considered unsafe by chrome
      if (isPortSafe(port)) {
        return port;
      }
    }
  }
}

// forked from https://github.com/piyush-bhatt/deno-port b/c it became
// incompatible with updates to deno std library updating from 0.97 to 0.117

interface IPortRange {
  start: number;
  end: number;
}

interface IListenerOptions {
  port: number;
  hostname?: string;
  transport?: "tcp";
}

interface IOptions {
  port?: number[] | IPortRange;
  hostname?: string;
  transport?: "tcp";
}

// wait for a port for specified internval
export async function waitForPort(
  options: IListenerOptions,
  timeout = 5000,
): Promise<boolean> {
  const kWaitInterval = 200;
  let waited = 0;
  while (waited <= timeout) {
    if (
      isPortAvailableSync(options)
    ) {
      return true;
    }
    await sleep(kWaitInterval);
    waited += kWaitInterval;
  }
  return false;
}

/**
 * Checks if a port is available
 * Requires `--allow-net` flag
 * @param options
 */
export function isPortAvailableSync(options: IListenerOptions): boolean {
  try {
    const listener = Deno.listen({
      port: options.port,
      ...(options.hostname ? { hostname: options.hostname } : {}),
      ...(options.transport ? { transport: options.transport } : {}),
    });
    listener.close();
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.AddrInUse) {
      return false;
    }
    throw error;
  }
}

/**
 * Finds a free port based on the options
 * Requires `--allow-net` flag
 * @param options
 */
export function getAvailablePortSync(
  options: IOptions = { transport: "tcp" },
): number | undefined {
  if (options.port === undefined) {
    return getRandomPortSync(options);
  } else if (Array.isArray(options.port)) {
    const portList = options.port;
    for (let i = 0; i < portList.length; i++) {
      if (withinRange(portList[i])) {
        const portAvailable = isPortAvailableSync({
          port: portList[i],
          ...(options.hostname ? { hostname: options.hostname } : {}),
          ...(options.transport ? { transport: options.transport } : {}),
        });
        if (portAvailable) {
          return portList[i];
        } else {
          continue;
        }
      } else {
        continue;
      }
    }
  } else if (
    options.port.start !== undefined &&
    options.port.end !== undefined
  ) {
    const start = options.port.start;
    const end = options.port.end;
    if (start >= 0 && end <= 65535 && start <= end) {
      for (let p = start; p <= end; p++) {
        const portAvailable = isPortAvailableSync({
          port: p,
          ...(options.hostname ? { hostname: options.hostname } : {}),
          ...(options.transport ? { transport: options.transport } : {}),
        });
        if (portAvailable) {
          return p;
        } else {
          continue;
        }
      }
    } else {
      throw new Error(
        "Range should be between 0 - 65535 and start should be less than end",
      );
    }
  }
}

/**
 * Finds a random available port in range 0-65535
 * @param options
 */
function getRandomPortSync(options: IOptions): number {
  const randomPort = random(0, 65535);

  const restrictedPorts = [
    // from https://chromium.googlesource.com/chromium/src.git/+/refs/heads/master/net/base/port_util.cc
    // as of 2023-02-23.
    1719, // h323gatestat
    1720, // h323hostcall
    1723, // pptp
    2049, // nfs
    3659, // apple-sasl / PasswordServer
    4045, // lockd
    5060, // sip
    5061, // sips
    6000, // X11
    6566, // sane-port
    6665, // Alternate IRC [Apple addition]
    6666, // Alternate IRC [Apple addition]
    6667, // Standard IRC [Apple addition]
    6668, // Alternate IRC [Apple addition]
    6669, // Alternate IRC [Apple addition]
    6697, // IRC + TLS
    10080, // Amanda
  ];

  if (
    isPortAvailableSync({
      port: randomPort,
      ...(options.hostname ? { hostname: options.hostname } : {}),
      ...(options.transport ? { transport: options.transport } : {}),
    }) && !(restrictedPorts.includes(randomPort)) // https://github.com/quarto-dev/quarto-cli/issues/4514
  ) {
    return randomPort;
  } else {
    return getRandomPortSync(options);
  }
}

/**
 * Finds a random number between the given range
 * @param min
 * @param max
 */
function random(min: number, max: number): number {
  return Math.round(Math.random() * (max - min)) + min;
}

/**
 * Checks if the given port is within range of 0-65535
 * @param port
 */
function withinRange(port: number): boolean {
  return port >= 0 && port <= 65535;
}
