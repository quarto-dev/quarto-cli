/*
 * timing.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { execProcess } from "./process.ts";

interface TimingNode {
  name: string;
  start: number;
  end: number;
  elapsed?: number;
  children: TimingNode[];
}

const nodeStack: TimingNode[] = [{
  name: "global",
  children: [{
    name: "deno-init",
    start: 0,
    end: performance.now(),
    elapsed: performance.now(),
    children: [],
  }],
  start: 0,
  end: 0,
}];

export function withTiming<T>(
  name: string,
  fun: () => T,
): T {
  push(name);
  try {
    const result = fun();
    return result;
  } finally {
    pop();
  }
}

export async function withTimingAsync<T>(
  name: string,
  fun: () => T | Promise<T>,
): Promise<T> {
  push(name);
  try {
    const result = await fun();
    pop();
    return result;
  } catch (e) {
    pop();
    throw e;
  }
}

export function init() {
  nodeStack[0].start = performance.now();
}

export function push(name: string) {
  nodeStack.push({
    name,
    start: performance.now(),
    end: 0,
    children: [],
  });
}

export function pop(at?: number) {
  if (nodeStack.length <= 1) {
    throw new Error("Can't pop top node");
  }
  const node = nodeStack.pop()!;
  node.end = at ?? performance.now();
  node.elapsed = node.end - node.start;
  nodeStack[nodeStack.length - 1].children.push(node);
}

export function getData() {
  nodeStack[0].end = performance.now();
  nodeStack[0].elapsed = nodeStack[0].end - nodeStack[0].start;
  return nodeStack[0];
}

export interface ExplicitTimingEntry {
  time: number;
  name: string;
}

export function insertExplicitTimingEntries(
  start: [number, number],
  end: [number, number],
  entries: ExplicitTimingEntry[],
  groupName: string,
) {
  const [theirStart, ourStart] = start;
  const [theirEnd, _] = end;
  nodeStack.push({
    name: groupName,
    start: ourStart,
    end: 0,
    children: [],
  });

  let prevTime = ourStart;

  // "_start" is a special case that indicates
  // an untracked chunk of time that exists only for alignment purposes.
  if (entries.length && entries[0].name === "_start") {
    prevTime = entries[0].time - theirStart + ourStart;
    entries = entries.slice(1);
  }

  for (const entry of entries) {
    nodeStack.push({
      name: entry.name,
      start: prevTime,
      end: 0,
      children: [],
    });
    prevTime = entry.time - theirStart + ourStart;
    pop(prevTime);
  }

  prevTime = theirEnd - theirStart + ourStart;
  pop(prevTime);
}

export async function getLuaTiming(): Promise<[number, number]> {
  if (Deno.env.get("QUARTO_PROFILER_OUTPUT")) {
    return [
      Number(
        (await execProcess("python", {
          args: ["-c", "import time; print(time.time() * 1000)"],
          stdout: "piped",
        })).stdout!,
      ),
      performance.now(),
    ];
  } else {
    return [0, 0];
  }
}
