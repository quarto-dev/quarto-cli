/*
* tree-sitter-annotated-yaml.js
* 
* Copyright (C) 2021 by RStudio, PBC
*
*/

/**
 * given a tree from tree-sitter-yaml and the mappedString
 * corresponding to the source, returns an AnnotatedParse (cf
 * `src/core/schema/annotated-yaml.ts`)
 */
export function buildAnnotated(tree, mappedSource)
{
  const singletonBuild = (node) => {
    return buildNode(node.firstChild);
  };
  const buildNode = (node) => {
    if (node === null) {
      // This can come up with parse errors
      return null;
    }
    if (dispatch[node.type] === undefined) {
      throw new Error(`Internal error: don't know how to build node of type ${node.type}`);
    }
    return dispatch[node.type](node);
  };

  const annotateEmpty = (position) => {
    const mappedPos = mappedSource.mapClosest(position);
    return {
      start: mappedPos,
      end: mappedPos,
      result: null,
      kind: "<<EMPTY>>",
      components: []
    };
  };
  
  const annotate = (node, result, components) => {
    return {
      start: mappedSource.mapClosest(node.startIndex),
      end: mappedSource.mapClosest(node.endIndex),
      result,
      kind: node.type, // FIXME this is almost certainly wrong because it doesn't match js-yaml.
      components
    };
  };
  
  const dispatch = {
    "stream": singletonBuild,
    "document": singletonBuild,
    "block_node": singletonBuild,
    "flow_node": singletonBuild,
    "block_sequence": (node) => {
      const result = [], components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type !== "block_sequence_item") {
          continue;
        }
        const component = buildNode(child);
        components.push(component);
        result.push(component.result);
      }
      return annotate(node, result, components);
    },
    "block_sequence_item": (node) => {
      if (node.childCount < 2) {
        return annotateEmpty(node.endIndex);
      } else {
        return buildNode(node.child(1));
      }
    },
    "double_quote_scalar": (node) => {
      return annotate(node, JSON.parse(node.text), []);
    },
    "plain_scalar": (node) => {
      // FIXME yuck, the yaml rules are ugly. I'm sure we'll get this wrong at first, oh well.
      function getV() {
        try {
          return JSON.parse(node.text); // this catches things like numbers, which YAML wants to convert to actual numbers
        } catch (e) {
          return node.text; // if that fails, return the actual string value.
        }
      }
      const v = getV();
      return annotate(node, v, []);
    },
    "flow_sequence": (node) => {
      const result = [], components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type !== "flow_node") {
          continue;
        }
        const component = buildNode(child);
        components.push(component);
        result.push(component.result);
      }
      return annotate(node, result, components);
    },
    "block_mapping": (node) => {
      const result = {}, components = [];
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
            value: value.result
          }, [key, value]);
        } else if (child.type !== "block_mapping_pair") {
          throw new Error(`Internal error: Expected a block_mapping_pair, got ${child.type} instead.`);
        } else {
          component = buildNode(child);
        }
        const { key, value } = component.result;
        // FIXME what do we do in the presence of parse errors that result empty keys?
        // if (key === null) { }
        result[key] = value;
        components.push(...component.components);
      }
      return annotate(node, result, components);
    },
    "block_mapping_pair": (node) => {
      let key, value;
      if (node.childCount === 3) {
        // when three children exist, we assume a good parse 
        key = annotate(node.child(0), node.child(0).text, []);
        value = buildNode(node.child(2));
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
        value: value.result
      }, [key, value]);
    }
  };
  
  return buildNode(tree.rootNode);
  
}


/** just like `src/core/schema/yaml-schema.ts:navigate`, but expects
 * the node kinds which come from tree-sitter-yaml parser
 */
export function navigate(path, annotation, pathIndex = 0)
{
  if (pathIndex >= path.length) {
    return annotation;
  }
  if (annotation.kind === "block_mapping") {
    const { components } = annotation;
    const searchKey = path[pathIndex];
    for (let i = 0; i < components.length; i += 2) {
      const key = components[i].result;
      if (key === searchKey) {
        return navigate(path, components[i + 1], pathIndex + 1);
      }
    }
    throw new Error("Internal error: searchKey not found in mapping object");
  } else if (annotation.kind === "block_sequence") {
    const searchKey = Number(path[pathIndex]);
    return navigate(path, annotation.components[searchKey], pathIndex + 1);
  } else {
    throw new Error(`Internal error: unexpected kind ${annotation.kind}`);
  }
}


// locateCursor is lenient wrt locating inside the last character of a
// range (by using position <= foo instead of position < foo).  That
// happens because tree-sitter's robust parsing sometimes returns
// "partial objects" which are missing parts of the tree.  In those
// cases, we want the cursor to be "inside a null value", and they
// correspond to the edges of an object, where position == range.end.
export function locateCursor(annotation, position)
{
  let failedLast = false;
  
  function locate(node, pathSoFar) {
    if (node.kind === "block_mapping" || node.kind === "flow_mapping") {
      for (let i = 0; i < node.components.length; i += 2) {
        const keyC = node.components[i],
              valueC = node.components[i+1];
        if (keyC.start <= position && position <= keyC.end) {
          return [keyC.result, pathSoFar];
        } else if (valueC.start <= position && position <= valueC.end) {
          return locate(valueC, [keyC.result, pathSoFar]);
        }
      }
      
      // FIXME: decide what to do if cursor lands exactly on ":"?

      // if we "fell through the pair cracks", that is, if the cursor is inside a mapping
      // but not inside any of the actual mapping pairs, then we stop the location at the
      // object itself, but report an error so that the recipients may handle it
      // case-by-base.

      failedLast = true;
      
      return pathSoFar;
      // throw new Error("Internal error: cursor outside bounds in mapping locate?");
    } else if (node.kind === "block_sequence" || node.kind === "flow_sequence") {
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
            return [i-1, pathSoFar];
          }
        }
      }

      throw new Error("Internal error: cursor outside bounds in sequence locate?");
    } else {
      if (node.kind !== "<<EMPTY>>") {
        return [node.result, pathSoFar];
      } else {
        // we're inside an error, don't report that.
        return pathSoFar;
      }
    }
  }
  const value = locate(annotation, []).flat(Infinity).reverse();
  return {
    withError: failedLast,
    value
  };
}
