const filename = Deno.args[0];
const file = Deno.readTextFileSync(filename);

const strings: string[] = [];
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
}

type LuaStackFrame = {
  location: string;
  // name: string;
  // source: string;
  // line: number;
  category: string;
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
    if (stackNum === "") {
      stackNum = entries[0];
    } else if (stackNum !== entries[0]) {
      if (thisStack.length) {
        thisStack[0].location = `${thisStack[0].location}:${entries[3]}`;
      }
      stacks.push({
        frames: thisStack,
        time: Number(entries[1]),
        line: Number(entries[3])
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
      category
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
  line: 0
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
const perfettoStack: number[] = [];

for (const stack of stacks) {
  const thisStackFrames = stack.frames;
  thisStackFrames.reverse();

  // pop off the stack
  for (let i = prevStack.length - 1; i >= 0; --i) {
    const prevFrame = prevStack[i];
    traceEvents.push({
      ph: "E",
      name: prevFrame.location,
      sf: String(perfettoStack.pop()),
      ts: stack.time * 1000000,
      cat: prevFrame.category !== "" ? prevFrame.category : undefined
    });
  }
  // push on the stack
  for (let i = 0; i < thisStackFrames.length; i++) {
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
      cat: nextFrame.category !== "" ? nextFrame.category : undefined
    });
    perfettoStack.push(stackNo++);
  }
  prevStack = thisStackFrames;
}

console.log(JSON.stringify({ traceEvents, stackFrames }, null, 2));