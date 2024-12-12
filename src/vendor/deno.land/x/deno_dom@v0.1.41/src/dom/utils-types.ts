import type { Element } from "./element.ts";
import type { Document } from "./document.ts";
import type { DocumentFragment } from "./document-fragment.ts";

/**
 * Ugly solution to circular imports... FIXME: Make this better
 */
export default {
  Element: null as any as typeof Element,
  Document: null as any as typeof Document,
  DocumentFragment: null as any as typeof DocumentFragment,
};
