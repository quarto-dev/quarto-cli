const frameSkip = 3;
const filename = Deno.args[0];
const file = Deno.readTextFileSync(filename);

let longestCommonPrefix: string | undefined = undefined;
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

// add a sentinel stack to make sure the last stack is also output
stacks.push({
  frames: [],
  time,
  line: 0,
  category: ""
});

// convert these to chrome://tracing format
type Frame = {
  name: string;
  parent?: string;
}

type TraceEvent = {
  name: string;
  sf: string;
  ph: string;
  ts: number;
  cat?: string;
}

const stackFrames: Record<number, Frame> = {};
let stackNo = 0;
const traceEvents: TraceEvent[] = [];
let prevStack: LuaStackFrame[] = [];
let prevCat: string = "";
const perfettoStack: number[] = [];

for (const stack of stacks) {
  const thisStackFrames = stack.frames;
  thisStackFrames.reverse();

  let overlappingI = 0;
  while (overlappingI < thisStackFrames.length && overlappingI < prevStack.length) {
    if (thisStackFrames[overlappingI].location !== prevStack[overlappingI].location ||
      stack.category !== prevCat) {
      break;
    }
    overlappingI++;
  }
  // pop off the stack
  for (let i = prevStack.length - 1; i >= Math.max(frameSkip, overlappingI); --i) {
    const prevFrame = prevStack[i];
    traceEvents.push({
      ph: "E",
      name: prevFrame.location,
      sf: String(perfettoStack.pop()),
      ts: stack.time * 1000000,
      cat: prevCat !== "" ? prevCat : undefined
    });
  }

  // push on the stack
  for (let i = Math.max(frameSkip, overlappingI); i < thisStackFrames.length; ++i) {
    const nextFrame = thisStackFrames[i];
    stackFrames[stackNo] = {
      name: nextFrame.location,
      parent: perfettoStack.length ? String(perfettoStack[perfettoStack.length - 1]) : undefined
    }
    traceEvents.push({
      ph: "B",
      name: nextFrame.location,
      sf: String(stackNo),
      ts: stack.time * 1000000,
      cat: stack.category !== "" ? stack.category : undefined
    });
    perfettoStack.push(stackNo++);
  }
  prevStack = thisStackFrames;
  prevCat = stack.category;
}

console.log(JSON.stringify({ traceEvents, stackFrames }, null, 2));