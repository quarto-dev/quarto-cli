/*
* tree-sitter-annotated-yaml.js
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { lines, matchAll } from "../text.ts";
import { AnnotatedParse, JSONValue } from "../yaml-validation/types.ts";

import { MappedString, mappedString } from "../mapped-text.ts";

/**
 * given a tree from tree-sitter-yaml and the mappedString
 * corresponding to the source, returns an AnnotatedParse
 */

// deno-lint-ignore no-explicit-any
type TreeSitterParse = any;
// deno-lint-ignore no-explicit-any
type TreeSitterNode = any;

export function buildAnnotated(
  tree: TreeSitterParse,
  mappedSource: MappedString,
): AnnotatedParse | null {
  const singletonBuild = (node: TreeSitterNode) => {
    return buildNode(node.firstChild, node.endIndex);
  };
  const buildNode = (
    node: TreeSitterNode,
    endIndex?: number,
  ): AnnotatedParse => {
    if (node === null) {
      // This can come up with parse errors
      return annotateEmpty(endIndex === undefined ? -1 : endIndex);
    }
    if (dispatch[node.type] === undefined) {
      // we don't support this construction, but let's try not to crash.
      return annotateEmpty(endIndex || node.endIndex || -1);
    }
    return dispatch[node.type](node);
  };

  const annotateEmpty = (position: number): AnnotatedParse => {
    return {
      start: position,
      end: position,
      result: null,
      kind: "<<EMPTY>>",
      components: [],
      source: mappedString(mappedSource, [{ start: position, end: position }]),
    };
  };

  const annotate = (
    node: TreeSitterNode,
    // deno-lint-ignore no-explicit-any
    result: any,
    components: AnnotatedParse[],
  ): AnnotatedParse => {
    return {
      start: node.startIndex,
      end: node.endIndex,
      result: result as JSONValue,
      kind: node.type, // NB this doesn't match js-yaml, so you need
      // to make sure your annotated walkers know
      // about tree-sitter and js-yaml both.
      components,
      source: mappedString(mappedSource, [{
        start: node.startIndex,
        end: node.endIndex,
      }]),
    };
  };

  const buildPair = (node: TreeSitterNode) => {
    let key, value;
    if (node.childCount === 3) {
      // when three children exist, we assume a good parse
      key = annotate(node.child(0), node.child(0).text, []);
      value = buildNode(node.child(2), node.endIndex);
    } else if (node.childCount === 2) {
      // when two children exist, we assume a bad parse with missing value
      key = annotate(node.child(0), node.child(0).text, []);
      value = annotateEmpty(node.endIndex);
    } else {
      // otherwise, we assume a bad parse, return empty on both key and value
      key = annotateEmpty(node.endIndex);
      value = annotateEmpty(node.endIndex);
    }

    return annotate(node, {
      key: key.result,
      value: value.result,
    }, [key, value]);
  };

  const dispatch: Record<string, (node: TreeSitterNode) => AnnotatedParse> = {
    "stream": singletonBuild,
    "document": singletonBuild,
    "block_node": singletonBuild,
    "flow_node": singletonBuild,
    "block_scalar": (node) => {
      if (!node.text.startsWith("|")) {
        // throw new Error(
        //   `Internal error: can only build block_scalar if content starts with | (got "${
        //     node.text[0]
        //   }" instead)`,
        // );
        return annotateEmpty(node.endIndex);
      }
      const ls = lines(node.text);
      if (ls.length < 2) {
        // throw new Error(
        //   `Internal error: can only handle block_scalar of multiline strings`,
        // );
        return annotateEmpty(node.endIndex);
      }
      const indent = ls[1].length - ls[1].trimStart().length;
      const result = ls.slice(1).map((l: string) => l.slice(indent)).join("\n");
      return annotate(node, result, []);
    },
    "block_sequence": (node) => {
      const result = [], components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type !== "block_sequence_item") {
          continue;
        }
        const component = buildNode(child, node.endIndex);
        components.push(component);
        result.push(component && component.result);
      }
      return annotate(node, result, components);
    },
    "block_sequence_item": (node) => {
      if (node.childCount < 2) {
        return annotateEmpty(node.endIndex);
      } else {
        return buildNode(node.child(1), node.endIndex);
      }
    },
    "double_quote_scalar": (node) => {
      return annotate(node, JSON.parse(node.text), []);
    },
    "single_quote_scalar": (node) => {
      // apparently YAML single-quoted scalars quote single quotes by doubling the quote,
      // but YAML double-quoted scalars quote double quotes with backslashes.
      //
      // consistency, hobgoblins, little minds, etc
      const str = node.text.slice(1, -1);
      const matches = [
        -2,
        ...Array.from(matchAll(str, /''/g)).map((x) => x.index),
        str.length,
      ];
      const lst = [];
      for (let i = 0; i < matches.length - 1; ++i) {
        lst.push(str.substring(matches[i] + 2, matches[i + 1]));
      }
      const result = lst.join("'");
      return annotate(node, result, []);
    },
    "plain_scalar": (node) => {
      // TODO yuck, the yaml rules are ugly. We're using JSON.parse as a proxy but that's probably not exact.
      function getV() {
        try {
          return JSON.parse(node.text); // this catches things like numbers, which YAML wants to convert to actual numbers
        } catch (_e) {
          return node.text; // if that fails, return the actual string value.
        }
      }
      const v = getV();
      return annotate(node, v, []);
    },
    "flow_sequence": (node) => {
      // deno-lint-ignore no-explicit-any
      const result: any[] = [], components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type !== "flow_node") {
          continue;
        }
        const component = buildNode(child, node.endIndex);
        components.push(component);
        result.push(component.result);
      }
      return annotate(node, result, components);
    },
    "block_mapping": (node) => {
      // deno-lint-ignore no-explicit-any
      const result: Record<string, any> = {}, components: AnnotatedParse[] = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        let component;
        if (child.type === "ERROR") {
          // attempt to recover from error
          result[child.text] = "<<ERROR>>";
          const key = annotate(child, child.text, []);
          const value = annotateEmpty(child.endIndex);
          component = annotate(child, {
            key: key.result,
            value: value.result,
          }, [key, value]);
        } else if (child.type !== "block_mapping_pair") {
          continue;
        } else {
          component = buildNode(child, node.endIndex);
        }
        const { key, value } = component.result as { [key: string]: JSONValue };
        // TODO what do we do in the presence of parse errors that produce empty keys?
        // if (key === null) { }
        result[String(key)] = value;
        components.push(...(component.components!));
      }
      return annotate(node, result, components);
    },
    "flow_pair": buildPair,
    "flow_mapping": (node) => {
      // deno-lint-ignore no-explicit-any
      const result: Record<string, any> = {}, components: AnnotatedParse[] = [];
      // skip flow_nodes at the boundary
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type === "flow_node") {
          continue;
        }
        if (child.type === "flow_pair") {
          const component = buildNode(child, node.endIndex);
          const { key, value } = component.result as {
            [key: string]: JSONValue;
          };
          result[String(key)] = value;
          components.push(...(component.components!));
        }
      }
      return annotate(node, result, components);
    },
    "block_mapping_pair": buildPair,
  };

  const result = buildNode(tree.rootNode, tree.rootNode.endIndex);

  // some tree-sitter "error-tolerant parses" are particularly bad
  // for us here. We must guard against "partial" parses where
  // tree-sitter doesn't consume the entire string, since this is
  // symptomatic of a bad object. When this happens, bail on the
  // current parse.
  //
  // There's an added complication in that it seems that sometimes
  // treesitter consumes line breaks at the end of the file, and
  // sometimes it doesn't. So exact checks don't quite work. We're
  // then resigned to a heuristic that is bound to sometimes
  // fail. That heuristic is, roughly, that we consider something a
  // failed parse if it misses more than 5% of the characters in the
  // original string span.
  //
  // This is, clearly, a terrible hack.
  //
  // I really ought to consider rebuilding this whole infrastructure
  const parsedSize = tree.rootNode.text.trim().length;
  const codeSize = mappedSource.value.trim().length;
  const lossage = parsedSize / codeSize;

  if (lossage < 0.95) {
    return null;
  }

  return result;
}

// locateCursor is lenient wrt locating inside the last character of a
// range (by using position <= foo instead of position < foo).  That
// happens because tree-sitter's robust parsing sometimes returns
// "partial objects" which are missing parts of the tree.  In those
// cases, we want the cursor to be "inside a null value", and they
// correspond to the edges of an object, where position == range.end.
export interface LocateCursorResult {
  withError: boolean;
  value?: (string | number)[];
}

export function locateCursor(
  annotation: AnnotatedParse,
  position: number,
): LocateCursorResult {
  let failedLast = false;
  const kInternalLocateError =
    "Internal error: cursor outside bounds in sequence locate?";

  // deno-lint-ignore no-explicit-any
  function locate(node: AnnotatedParse, pathSoFar: any[]): any[] {
    if (node.kind === "block_mapping" || node.kind === "flow_mapping") {
      for (let i = 0; i < node.components.length; i += 2) {
        const keyC = node.components[i],
          valueC = node.components[i + 1];
        if (keyC.start <= position && position <= keyC.end) {
          return [keyC.result, pathSoFar];
        } else if (valueC.start <= position && position <= valueC.end) {
          return locate(valueC, [keyC.result, pathSoFar]);
        }
      }

      // TODO decide what to do if cursor lands exactly on ":"?

      // if we "fell through the pair cracks", that is, if the cursor is inside a mapping
      // but not inside any of the actual mapping pairs, then we stop the location at the
      // object itself, but report an error so that the recipients may handle it
      // case-by-base.

      failedLast = true;

      return pathSoFar;
      // throw new Error("Internal error: cursor outside bounds in mapping locate?");
    } else if (
      node.kind === "block_sequence" || node.kind === "flow_sequence"
    ) {
      for (let i = 0; i < node.components.length; ++i) {
        const valueC = node.components[i];
        if (valueC.start <= position && position <= valueC.end) {
          return locate(valueC, [i, pathSoFar]);
        }
        if (valueC.start > position) {
          // We went too far: that means we're caught in between entries. Assume
          // that we're inside the previous element but that we can't navigate any further
          // If we're at the beginning of the sequence, assume that we're done exactly here.
          if (i === 0) {
            return pathSoFar;
          } else {
            return [i - 1, pathSoFar];
          }
        }
      }

      throw new Error(kInternalLocateError);
    } else {
      if (node.kind !== "<<EMPTY>>") {
        return [node.result, pathSoFar];
      } else {
        // we're inside an error, don't report that.
        return pathSoFar;
      }
    }
  }
  try {
    const value = locate(annotation, []).flat(Infinity).reverse();
    return {
      withError: failedLast,
      value: value as (string | number)[],
    };
  } catch (e) {
    if (e.message === kInternalLocateError) {
      return {
        withError: true,
        value: undefined,
      };
    } else {
      throw e;
    }
  }
}
