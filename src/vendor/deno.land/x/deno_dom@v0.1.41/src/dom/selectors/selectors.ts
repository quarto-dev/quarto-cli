import { DOM as NWAPI } from "./nwsapi-types.ts";
import { DOM as Sizzle } from "./sizzle-types.ts";
import type { Element } from "../element.ts";
import type { Document } from "../document.ts";

export type Selector = (doc: Document) => {
  first(
    selector: string,
    context: Element | Document,
    callback?: (element: Element) => void,
  ): Element | null;
  match(
    selector: string,
    context: Element | Document,
    callback?: (element: Element) => void,
  ): boolean;
  select(
    selector: string,
    context: Element | Document,
    callback?: (element: Element) => void,
  ): Element[];
};
export type SelectorApi = ReturnType<Selector>;

let codeGenerationAllowed: boolean | null = null;

export function getSelectorEngine(): Selector {
  if (codeGenerationAllowed === null) {
    try {
      new Function("");
      codeGenerationAllowed = true;
    } catch (e) {
      codeGenerationAllowed = false;
    }
  }

  if (codeGenerationAllowed) {
    return NWAPI;
  } else {
    return Sizzle;
  }
}

/**
 * Explicitly disable querySelector/All code generation with the `Function`
 * constructor forcing the Sizzle engine. Enables those APIs on platforms
 * like Deno Deploy that don't allow code generation.
 */
export function disableCodeGeneration() {
  codeGenerationAllowed = false;
}
