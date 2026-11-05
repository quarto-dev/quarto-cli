import {tokTypes as tt, Parser} from "acorn";

const STATE_START = Symbol("start");
const STATE_MODIFIER = Symbol("modifier");
const STATE_FUNCTION = Symbol("function");
const STATE_NAME = Symbol("name");

/*
                       ┌─────┐
           ┌───────────│START│─function|class
           │           └─────┘             │
viewof|mutable|async      │                ▼
           │              │           ┌────────┐     ┌─┐
           ▼              │           │FUNCTION│◀───▶│*│
      ┌────────┐          │           └────────┘     └─┘
      │MODIFIER│          │                │
      └────────┘        name             name
           │              │                │
           └──name─┐      │                ▼
                   ▼      │         ┌─────────────┐
              ┌────────┐  │         │FUNCTION_NAME│
              │  NAME  │◀─┘         └─────────────┘
              └────────┘
                   │
                   =
                   ▼
              ┌────────┐
              │   EQ   │
              └────────┘
*/

export function peekId(input) {
  let state = STATE_START;
  let name;
  try {
    for (const token of Parser.tokenizer(input, {ecmaVersion: 11})) {
      switch (state) {
        case STATE_START:
        case STATE_MODIFIER: {
          if (token.type === tt.name) {
            if (
              state === STATE_START &&
              (token.value === "viewof" ||
                token.value === "mutable" ||
                token.value === "async")
            ) {
              state = STATE_MODIFIER;
              continue;
            }
            state = STATE_NAME;
            name = token;
            continue;
          }
          if (token.type === tt._function || token.type === tt._class) {
            state = STATE_FUNCTION;
            continue;
          }
          break;
        }
        case STATE_NAME: {
          if (token.type === tt.eq) return name.value;
          break;
        }
        case STATE_FUNCTION: {
          if (token.type === tt.star) continue;
          if (token.type === tt.name && token.end < input.length)
            return token.value;
          break;
        }
      }
      return;
    }
  } catch (ignore) {
    return;
  }
}
