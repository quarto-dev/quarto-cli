export type LuaStack = {
  frames: LuaStackFrame[];
  time: number;
  line: number;
  category: string;
}

export type LuaStackFrame = {
  location: string;
  // name: string;
  // source: string;
  // line: number;
}
