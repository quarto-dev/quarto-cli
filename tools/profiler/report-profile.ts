import { loadProfilerData } from "./lua-profiler-data-loader.ts";
import { LuaStack } from "./types.ts";

const filename = Deno.args[0];
const frameSkip = Deno.args[1] === undefined ? 3 : Number(Deno.args[1]);
const stacks = loadProfilerData(filename, frameSkip);

const estimateSampleRate = (stacks: LuaStack[]) => {
  return (stacks[stacks.length - 1].time - stacks[0].time) / (stacks.length - 1);
}

const totalTime = stacks[stacks.length - 1].time - stacks[0].time;
const sampleRate = estimateSampleRate(stacks);

const selfTimes = new Map<string, number>();

for (const stack of stacks) {
  const topFrame = stack.frames[0];
  const location = topFrame.location;
  if (!selfTimes.has(location)) {
    selfTimes.set(location, 0);
  }
  selfTimes.set(location, selfTimes.get(location)! + sampleRate);
}

const roundToDigits = (num: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(num * factor) / factor;
}

console.log(
  Array.from(selfTimes.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([location, time]) => `${roundToDigits(100 * time / totalTime, 1)}% (${roundToDigits(time, 3)}): ${location}`).join("\n"));