// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// @ts-nocheck Bypass static errors for missing --unstable.

export type HttpClient = Deno.HttpClient;
export type UnixConnectOptions = Deno.UnixConnectOptions;
export type UnixListenOptions = Deno.UnixListenOptions;
export type DatagramConn = Deno.DatagramConn;

export function addSignalListener(
  ...args: Parameters<typeof Deno.addSignalListener>
): ReturnType<typeof Deno.addSignalListener> {
  if (typeof Deno.addSignalListener == "function") {
    return Deno.addSignalListener(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function createHttpClient(
  ...args: Parameters<typeof Deno.createHttpClient>
): ReturnType<typeof Deno.createHttpClient> {
  if (typeof Deno.createHttpClient == "function") {
    return Deno.createHttpClient(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function consoleSize(
  ...args: Parameters<typeof Deno.consoleSize>
): ReturnType<typeof Deno.consoleSize> {
  if (typeof Deno.consoleSize == "function") {
    return Deno.consoleSize(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function futime(
  ...args: Parameters<typeof Deno.futime>
): ReturnType<typeof Deno.futime> {
  if (typeof Deno.futime == "function") {
    return Deno.futime(...args);
  } else {
    return Promise.reject(new TypeError("Requires --unstable"));
  }
}

export function futimeSync(
  ...args: Parameters<typeof Deno.futimeSync>
): ReturnType<typeof Deno.futimeSync> {
  if (typeof Deno.futimeSync == "function") {
    return Deno.futimeSync(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function getUid(
  ...args: Parameters<typeof Deno.getUid>
): ReturnType<typeof Deno.getUid> {
  if (typeof Deno.getUid == "function") {
    return Deno.getUid(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function hostname(
  ...args: Parameters<typeof Deno.hostname>
): ReturnType<typeof Deno.hostname> {
  if (typeof Deno.hostname == "function") {
    return Deno.hostname(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function loadavg(
  ...args: Parameters<typeof Deno.loadavg>
): ReturnType<typeof Deno.loadavg> {
  if (typeof Deno.loadavg == "function") {
    return Deno.loadavg(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function osRelease(
  ...args: Parameters<typeof Deno.osRelease>
): ReturnType<typeof Deno.osRelease> {
  if (typeof Deno.osRelease == "function") {
    return Deno.osRelease(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function removeSignalListener(
  ...args: Parameters<typeof Deno.removeSignalListener>
): ReturnType<typeof Deno.removeSignalListener> {
  if (typeof Deno.removeSignalListener == "function") {
    return Deno.removeSignalListener(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function setRaw(
  ...args: Parameters<typeof Deno.setRaw>
): ReturnType<typeof Deno.setRaw> {
  if (typeof Deno.setRaw == "function") {
    return Deno.setRaw(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function systemMemoryInfo(
  ...args: Parameters<typeof Deno.systemMemoryInfo>
): ReturnType<typeof Deno.systemMemoryInfo> {
  if (typeof Deno.systemMemoryInfo == "function") {
    return Deno.systemMemoryInfo(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function utime(
  ...args: Parameters<typeof Deno.utime>
): ReturnType<typeof Deno.utime> {
  if (typeof Deno.utime == "function") {
    return Deno.utime(...args);
  } else {
    return Promise.reject(new TypeError("Requires --unstable"));
  }
}

export function utimeSync(
  ...args: Parameters<typeof Deno.utimeSync>
): ReturnType<typeof Deno.utimeSync> {
  if (typeof Deno.utimeSync == "function") {
    return Deno.utimeSync(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function networkInterfaces(
  ...args: Parameters<typeof Deno.networkInterfaces>
): ReturnType<typeof Deno.networkInterfaces> {
  if (typeof Deno.networkInterfaces == "function") {
    return Deno.networkInterfaces(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export async function connect(
  options: UnixConnectOptions,
): Promise<Deno.UnixConn> {
  return await Deno.connect(options);
}

export function listen(
  options: UnixListenOptions & { transport: "unix" },
): ReturnType<typeof Deno.listen> {
  return Deno.listen(options);
}

export function listenDatagram(
  options: Deno.ListenOptions & { transport: "udp" },
): ReturnType<typeof Deno.listenDatagram> {
  return Deno.listenDatagram(options);
}

export function ListenerRef(
  listener: Deno.Listener,
  ...args: Parameters<Deno.Listener["ref"]>
): ReturnType<Deno.Listener["ref"]> {
  if (typeof listener.ref == "function") {
    return listener.ref(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}

export function ListenerUnref(
  listener: Deno.Listener,
  ...args: Parameters<Deno.Listener["unref"]>
): ReturnType<Deno.Listener["unref"]> {
  if (typeof listener.unref == "function") {
    return listener.unref(...args);
  } else {
    throw new TypeError("Requires --unstable");
  }
}
