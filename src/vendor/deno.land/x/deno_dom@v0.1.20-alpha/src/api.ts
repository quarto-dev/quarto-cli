export { nodesFromString } from "./deserialize.ts";
export * from "./dom/node.ts";
export * from "./dom/element.ts";
export * from "./dom/document.ts";
export * from "./dom/dom-parser.ts";

// Re-export private constructors without constructor signature
import {
  Node as ConstructibleNode,
  CharacterData as ConstructibleCharacterData
} from "./dom/node.ts"

import {
  HTMLDocument as ConstructibleHTMLDocument,
} from "./dom/document.ts"

import {
  Element as ConstructibleElement,
  Attr as ConstructibleAttr
} from "./dom/element.ts"

export const Node: Pick<
  typeof ConstructibleNode,
  keyof typeof ConstructibleNode
> & Function = ConstructibleNode;
export type Node = ConstructibleNode;

export const HTMLDocument: Pick<
  typeof ConstructibleHTMLDocument,
  keyof typeof ConstructibleHTMLDocument
> & Function = ConstructibleHTMLDocument;
export type HTMLDocument = ConstructibleHTMLDocument;

export const CharacterData: Pick<
  typeof ConstructibleCharacterData,
  keyof typeof ConstructibleCharacterData
> & Function = ConstructibleCharacterData;
export type CharacterData = ConstructibleCharacterData;

export const Element: Pick<
  typeof ConstructibleElement, keyof typeof ConstructibleElement
> & Function = ConstructibleElement;
export type Element = ConstructibleElement;

export const Attr: Pick<
  typeof ConstructibleAttr, keyof typeof ConstructibleAttr
> & Function = ConstructibleAttr;
export type Attr = ConstructibleAttr;

export { NodeListPublic as NodeList } from "./dom/node-list.ts";
export { HTMLCollectionPublic as HTMLCollection } from "./dom/html-collection.ts";

import { NodeList } from "./dom/node-list.ts";
import { HTMLCollection } from "./dom/html-collection.ts";

// Prevent childNodes and HTMLCollections from being seen as an arrays
const oldHasInstance = Array[Symbol.hasInstance];
Object.defineProperty(Array, Symbol.hasInstance, {
  value(value: any): boolean {
    switch (value?.constructor) {
      case HTMLCollection:
      case NodeList:
        return false;
      default:
        return oldHasInstance.call(this, value);
    }
  },
});

const oldIsArray = Array.isArray;
Object.defineProperty(Array, "isArray", {
  value: (value: any): boolean => {
    switch (value?.constructor) {
      case HTMLCollection:
      case NodeList:
        return false;
      default:
        return oldIsArray.call(Array, value);
    }
  },
});

