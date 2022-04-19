/*
* annotated-yaml.js
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { lines, matchAll } from "../text.ts";
import { AnnotatedParse, JSONValue } from "../yaml-schema/types.ts";

import { asMappedString, MappedString, mappedString } from "../mapped-text.ts";
import { getTreeSitterSync } from "./parsing.ts";

import { load as jsYamlParse } from "../external/js-yaml.js";

import { QuartoJSONSchema } from "./js-yaml-schema.ts";

// deno-lint-ignore no-explicit-any
type TreeSitterParse = any;
// deno-lint-ignore no-explicit-any
type TreeSitterNode = any;

export function readAnnotatedYamlFromString(yml: string) {
  return readAnnotatedYamlFromMappedString(asMappedString(yml))!;
}

export function readAnnotatedYamlFromMappedString(
  mappedSource: MappedString,
) {
  /*
   * We use both tree-sitter-yaml and js-yaml to get the
   * best that both offer. tree-sitter offers error resiliency
   * but reports unrecoverable parse errors poorly.
   *
   * In addition, tree-sitter-yaml fails to parse some valid yaml, see https://github.com/ikatyang/tree-sitter-yaml/issues/29
   *
   * In case tree-sitter-yaml fails, then, we use js-yaml.
   */
  const parser = getTreeSitterSync();
  const tree = parser.parse(mappedSource.value);
  const treeSitterAnnotation = buildTreeSitterAnnotation(tree, mappedSource);
  if (treeSitterAnnotation) {
    return treeSitterAnnotation;
  }
  return buildJsYamlAnnotation(mappedSource);
}

export function buildJsYamlAnnotation(mappedYaml: MappedString) {
  const yml = mappedYaml.value;

  // deno-lint-ignore no-explicit-any
  const stack: any[] = [];
  const results: AnnotatedParse[] = [];

  // deno-lint-ignore no-explicit-any
  function listener(what: string, state: any) {
    const { result, position, kind } = state;
    if (what === "close") {
      const { position: openPosition } = stack.pop();
      if (results.length > 0) {
        const last = results[results.length - 1];
        // sometimes we get repeated instances of (start, end) pairs
        // (probably because of recursive calls in parse() that don't
        // consume the string) so we skip those explicitly here
        if (last.start === openPosition && last.end === position) {
          return;
        }
      }
      // deno-lint-ignore no-explicit-any
      const components: any[] = [];
      while (results.length > 0) {
        const last = results[results.length - 1];
        if (last.end <= openPosition) {
          break;
        }
        components.push(results.pop());
      }
      components.reverse();

      const rawRange = yml.substring(openPosition, position);
      // trim spaces if needed
      const leftTrim = rawRange.length - rawRange.trimLeft().length;
      const rightTrim = rawRange.length - rawRange.trimRight().length;

      if (rawRange.trim().length === 0) {
        // special case for when string is empty
        results.push({
          start: position - rightTrim,
          end: position - rightTrim,
          result: result as JSONValue,
          components,
          kind,
          source: mappedString(mappedYaml, [{
            start: position - rightTrim,
            end: position - rightTrim,
          }]),
        });
      } else {
        results.push({
          start: openPosition + leftTrim,
          end: position - rightTrim,
          result: result,
          components,
          kind,
          source: mappedString(mappedYaml, [{
            start: position + leftTrim,
            end: position - rightTrim,
          }]),
        });
      }
    } else {
      stack.push({ position });
    }
  }

  jsYamlParse(yml, { listener, schema: QuartoJSONSchema });

  if (results.length === 0) {
    return {
      start: 0,
      end: 0,
      result: null,
      kind: "null",
      components: [],
      source: mappedString(mappedYaml, [{ start: 0, end: 0 }]),
    };
  }
  if (results.length !== 1) {
    throw new Error(
      `Internal Error - expected a single result, got ${results.length} instead`,
    );
  }

  JSON.stringify(results[0]); // this is here so that we throw on circular structures
  return results[0];
}

export function buildTreeSitterAnnotation(
  tree: TreeSitterParse,
  mappedSource: MappedString,
): AnnotatedParse | null {
  const errors: { start: number; end: number; message: string }[] = [];
  const singletonBuild = (node: TreeSitterNode) => {
    // some singleton nodes can contain more than one child, especially in the case of comments.
    // So we find the first non-comment to return.
    let tag: TreeSitterNode | undefined = undefined;
    for (const child of node.children) {
      if (child.type === "tag") {
        tag = child;
        continue;
      }
      if (child.type !== "comment") {
        const result = buildNode(child, node.endIndex);
        if (tag) {
          return annotateTag(result, tag, node);
        } else {
          return result;
        }
      }
    }
    // if there's only comments, we fail.
    return annotateEmpty(node.endIndex);
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

  const annotateError = (
    start: number,
    end: number,
    message: string,
  ): AnnotatedParse => {
    errors.push({ start, end, message });
    return {
      start,
      end,
      result: null,
      kind: "<<ERROR>>",
      components: [],
      source: mappedString(mappedSource, [{ start, end }]),
    };
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

  const annotateTag = (
    innerParse: AnnotatedParse,
    tagNode: TreeSitterNode,
    outerNode: TreeSitterNode,
  ): AnnotatedParse => {
    const tagParse = annotate(tagNode, tagNode.text, []);
    const result = annotate(outerNode, {
      tag: tagNode.text,
      value: innerParse.result,
    }, [tagParse, innerParse]);
    return result;
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
      // block scalar style
      if (!node.text.startsWith("|") && !node.text.startsWith(">")) {
        return annotateError(
          node.startIndex,
          node.endIndex,
          "Block scalar must start with either `|` or `>`",
        );
      }
      const joinString = node.text.startsWith("|") ? "\n" : "";

      const ls = lines(node.text);

      // block chomping
      let chompChar = "";
      if (ls[0].endsWith("-")) {
        // strip
        while (ls[ls.length - 1] === "") {
          ls.pop();
        }
      } else if (ls[1].endsWith("+")) {
        // keep
        chompChar = "\n";
      } else {
        // clip
        while (ls[ls.length - 1] === "") {
          ls.pop();
        }
        chompChar = "\n";
      }

      if (ls.length < 2) {
        // throw new Error(
        //   `Internal error: can only handle block_scalar of multiline strings`,
        // );
        return annotateEmpty(node.endIndex);
      }
      const indent = ls[1].length - ls[1].trimStart().length;
      const result = ls.slice(1).map((l: string) => l.slice(indent)).join(
        joinString,
      ) + chompChar;
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
  if (errors.length) {
    result.errors = errors;
  }

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
  kind?: "key" | "value";
  annotation?: AnnotatedParse;
}

export function locateCursor(
  annotation: AnnotatedParse,
  position: number,
): LocateCursorResult {
  let failedLast = false;
  let innermostAnnotation: AnnotatedParse;
  let keyOrValue: "key" | "value";
  const result: (string | number)[] = [];
  const kInternalLocateError =
    "Internal error: cursor outside bounds in sequence locate?";

  function locate(node: AnnotatedParse): void {
    if (
      node.kind === "block_mapping" || node.kind === "flow_mapping" ||
      node.kind === "mapping"
    ) {
      for (let i = 0; i < node.components.length; i += 2) {
        const keyC = node.components[i],
          valueC = node.components[i + 1];
        if (keyC.start <= position && position <= keyC.end) {
          innermostAnnotation = keyC;
          result.push(keyC.result as string);
          keyOrValue = "key";
          return;
        } else if (valueC.start <= position && position <= valueC.end) {
          result.push(keyC.result as string);
          innermostAnnotation = valueC;
          return locate(valueC);
        }
      }

      // TODO decide what to do if cursor lands exactly on ":"?

      // if we "fell through the pair cracks", that is, if the cursor is inside a mapping
      // but not inside any of the actual mapping pairs, then we stop the location at the
      // object itself, but report an error so that the recipients may handle it
      // case-by-base.

      failedLast = true;

      return;
      // throw new Error("Internal error: cursor outside bounds in mapping locate?");
    } else if (
      node.kind === "block_sequence" || node.kind === "flow_sequence"
    ) {
      for (let i = 0; i < node.components.length; ++i) {
        const valueC = node.components[i];
        if (valueC.start <= position && position <= valueC.end) {
          result.push(i);
          innermostAnnotation = valueC;
          return locate(valueC);
        }
        if (valueC.start > position) {
          // We went too far: that means we're caught in between entries. Assume
          // that we're inside the previous element but that we can't navigate any further
          // If we're at the beginning of the sequence, assume that we're done exactly here.
          if (i === 0) {
            return;
          } else {
            result.push(i - 1);
            return;
          }
        }
      }

      throw new Error(kInternalLocateError);
    } else {
      if (node.kind !== "<<EMPTY>>") {
        keyOrValue = "value";
        return;
      } else {
        // we're inside an error, don't report that.
        return;
      }
    }
  }
  try {
    locate(annotation);
    return {
      withError: failedLast,
      value: result,
      kind: keyOrValue!,
      annotation: innermostAnnotation!,
    };
  } catch (e) {
    if (e.message === kInternalLocateError) {
      return {
        withError: true,
      };
    } else {
      throw e;
    }
  }
}

export function locateAnnotation(
  annotation: AnnotatedParse,
  position: (number | string)[],
  kind?: "key" | "value",
): AnnotatedParse {
  // FIXME we temporarily work around AnnotatedParse bugs
  // here

  const originalSource = annotation.source.originalString;

  kind = kind || "value";
  for (let i = 0; i < position.length; ++i) {
    const value = position[i];
    if (typeof value === "number") {
      const inner = annotation.components[value];
      if (inner === undefined) {
        throw new Error("Internal Error: invalid path for locateAnnotation");
      }
      annotation = inner;
    } else {
      let found = false;
      for (let j = 0; j < annotation.components.length; j += 2) {
        if (
          originalSource.substring(
            annotation.components[j].start,
            annotation.components[j].end,
          ).trim() ===
            value
        ) {
          // on last entry, we discriminate between key and value contexts
          if (i === position.length - 1) {
            if (kind === "key") {
              annotation = annotation.components[j];
            } else {
              annotation = annotation.components[j + 1];
            }
          }
          found = true;
          break;
        }
      }
      if (!found) {
        throw new Error("Internal Error: invalid path for locateAnnotation");
      }
    }
  }
  return annotation;
}
