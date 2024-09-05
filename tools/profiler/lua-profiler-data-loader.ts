import { LuaStack } from "./types.ts";

export const loadProfilerData = (filename: string, frameSkip: number = 3): LuaStack[] => {
  let longestCommonPrefix: string | undefined = undefined;
  const file = Deno.readTextFileSync(filename);
  // find the longest common prefix for source to trim
  for (const fileLine of file.split("\n")) {
    if (fileLine === "") 
      continue;
    const entries = fileLine.split(" ");
    if (entries.length === 4) {
      continue;
    }
    const [_name, source] = fileLine.split(" ");
    if (source === "=[C]") continue;
  
    if (longestCommonPrefix === undefined) {
      longestCommonPrefix = source;
    } else {
      // find the longest common prefix
      let i = 0;
      while (i < longestCommonPrefix.length && longestCommonPrefix[i] === source[i]) {
        i++;
      }
      longestCommonPrefix = longestCommonPrefix.slice(0, i);
    }
  }
  
  if (longestCommonPrefix === undefined) {
    throw new Error("Internal error: no common prefix found");
  }
  
  type LuaStack = {
    frames: LuaStackFrame[];
    time: number;
    line: number;
    category: string;
  }
  
  type LuaStackFrame = {
    location: string;
    // name: string;
    // source: string;
    // line: number;
  }
  
  const stacks: LuaStack[] = [];
  let stackNum = "";
  let time = 0;
  let thisStack: LuaStackFrame[] = [];
  let category = "";
  
  for (const fileLine of file.split("\n")) {
    if (fileLine === "") continue;
    const entries = fileLine.split(" ");
    if (entries.length === 4) {
      category = entries[2];
      if (stackNum !== entries[0]) {
        if (thisStack.length) {
          thisStack[0].location = `${thisStack[0].location}:${entries[3]}`;
        }
        stacks.push({
          frames: thisStack,
          time: Number(entries[1]),
          line: Number(entries[3]),
          category
        });
        thisStack = [];
        stackNum = entries[0];
      }
      continue;
    }
    const [name, source, line] = fileLine.split(" ");
    try {
      const frame: LuaStackFrame = {
        location: `${source.slice(longestCommonPrefix.length)}:${line}:${name}`,
      };
      thisStack.push(frame);
    } catch (_e) {
      throw new Error(`Error parsing line: ${fileLine}`);
    }
  }

  return stacks;
}
