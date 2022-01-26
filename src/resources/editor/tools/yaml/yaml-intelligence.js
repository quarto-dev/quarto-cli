// ../binary-search.ts
function glb(array, value, compare) {
  compare = compare || ((a, b) => a - b);
  if (array.length === 0) {
    return -1;
  }
  if (array.length === 1) {
    if (compare(value, array[0]) < 0) {
      return -1;
    } else {
      return 0;
    }
  }
  let left = 0;
  let right = array.length - 1;
  const vLeft = array[left], vRight = array[right];
  if (compare(value, vRight) >= 0) {
    return right;
  }
  if (compare(value, vLeft) < 0) {
    return -1;
  }
  while (right - left > 1) {
    const center = left + (right - left >> 1);
    const vCenter = array[center];
    const cmp = compare(value, vCenter);
    if (cmp < 0) {
      right = center;
    } else if (cmp === 0) {
      left = center;
    } else {
      left = center;
    }
  }
  return left;
}

// ../external/colors.ts
var Deno;
try {
  Deno = globalThis.Deno;
} catch (_e) {
}
var noColor = typeof (Deno && Deno.noColor) === "boolean" ? Deno.noColor : true;
var enabled = !noColor;
function code(open, close) {
  return {
    open: `[${open.join(";")}m`,
    close: `[${close}m`,
    regexp: new RegExp(`\\x1b\\[${close}m`, "g")
  };
}
function run(str, code2) {
  return enabled ? `${code2.open}${str.replace(code2.regexp, code2.open)}${code2.close}` : str;
}
function red(str) {
  return run(str, code([31], 39));
}
function blue(str) {
  return run(str, code([34], 39));
}
function clampAndTruncate(n, max = 255, min = 0) {
  return Math.trunc(Math.max(Math.min(n, max), min));
}
function rgb24(str, color) {
  if (typeof color === "number") {
    return run(str, code([38, 2, color >> 16 & 255, color >> 8 & 255, color & 255], 39));
  }
  return run(str, code([
    38,
    2,
    clampAndTruncate(color.r),
    clampAndTruncate(color.g),
    clampAndTruncate(color.b)
  ], 39));
}
var ANSI_PATTERN = new RegExp([
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
  "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
].join("|"), "g");

// ../errors.ts
function tidyverseInfo(msg) {
  return `${blue("\u2139")} ${msg}`;
}
function tidyverseError(msg) {
  return `${red("\u2716")} ${msg}`;
}
function tidyverseFormatError(msg) {
  let { heading, error, info } = msg;
  if (msg.location) {
    heading = `${locationString(msg.location)} ${heading}`;
  }
  if (msg.fileName) {
    heading = `In file ${msg.fileName} ${heading}`;
  }
  const strings = [
    heading,
    msg.sourceContext,
    ...error.map(tidyverseError),
    ...info.map(tidyverseInfo)
  ];
  return strings.join("\n");
}
function quotedStringColor(msg) {
  return rgb24(msg, 12369186);
}
function addFileInfo(msg, src) {
  if (src.fileName !== void 0) {
    msg.fileName = src.fileName;
  }
}
function addInstancePathInfo(msg, instancePath) {
  if (instancePath !== "") {
    const niceInstancePath = instancePath.trim().slice(1).split("/").map((s) => blue(s)).join(":");
    msg.info.push(`The error happened in location ${niceInstancePath}.`);
  }
}
function locationString(loc) {
  const { start, end } = loc;
  const locStr = start.line === end.line ? `(line ${start.line + 1}, columns ${start.column + 1}--${end.column + 1})` : `(line ${start.line + 1}, column ${start.column + 1} through line ${end.line + 1}, column ${end.column + 1})`;
  return locStr;
}

// ../text.ts
function lines(text) {
  return text.split(/\r?\n/);
}
function* matchAll(text, regexp) {
  if (!regexp.global) {
    throw new Error("matchAll requires global regexps");
  }
  let match;
  while ((match = regexp.exec(text)) !== null) {
    yield match;
  }
}
function* lineOffsets(text) {
  yield 0;
  for (const match of matchAll(text, /\r?\n/g)) {
    yield match.index + match[0].length;
  }
}
function indexToRowCol(text) {
  const offsets = Array.from(lineOffsets(text));
  return function(offset) {
    if (offset === 0) {
      return {
        line: 0,
        column: 0
      };
    }
    const startIndex = glb(offsets, offset);
    return {
      line: startIndex,
      column: offset - offsets[startIndex]
    };
  };
}
function rowColToIndex(text) {
  const offsets = Array.from(lineOffsets(text));
  return function(position) {
    return offsets[position.row] + position.column;
  };
}
function formatLineRange(text, firstLine, lastLine) {
  const lineWidth = Math.max(String(firstLine + 1).length, String(lastLine + 1).length);
  const pad = " ".repeat(lineWidth);
  const ls = lines(text);
  const result = [];
  for (let i = firstLine; i <= lastLine; ++i) {
    const numberStr = `${pad}${i + 1}: `.slice(-(lineWidth + 2));
    const lineStr = ls[i];
    result.push({
      lineNumber: i,
      content: numberStr + quotedStringColor(lineStr),
      rawLine: ls[i]
    });
  }
  return {
    prefixWidth: lineWidth + 2,
    lines: result
  };
}

// tree-sitter-annotated-yaml.ts
function buildAnnotated(tree, mappedSource2) {
  const singletonBuild = (node) => {
    return buildNode(node.firstChild, node.endIndex);
  };
  const buildNode = (node, endIndex) => {
    if (node === null) {
      return annotateEmpty(endIndex === void 0 ? -1 : endIndex);
    }
    if (dispatch[node.type] === void 0) {
      return annotateEmpty(endIndex || node.endIndex || -1);
    }
    return dispatch[node.type](node);
  };
  const annotateEmpty = (position) => {
    return {
      start: position,
      end: position,
      result: null,
      kind: "<<EMPTY>>",
      components: []
    };
  };
  const annotate = (node, result2, components) => {
    return {
      start: node.startIndex,
      end: node.endIndex,
      result: result2,
      kind: node.type,
      components
    };
  };
  const buildPair = (node) => {
    let key, value;
    if (node.childCount === 3) {
      key = annotate(node.child(0), node.child(0).text, []);
      value = buildNode(node.child(2), node.endIndex);
    } else if (node.childCount === 2) {
      key = annotate(node.child(0), node.child(0).text, []);
      value = annotateEmpty(node.endIndex);
    } else {
      key = annotateEmpty(node.endIndex);
      value = annotateEmpty(node.endIndex);
    }
    return annotate(node, {
      key: key.result,
      value: value.result
    }, [key, value]);
  };
  const dispatch = {
    "stream": singletonBuild,
    "document": singletonBuild,
    "block_node": singletonBuild,
    "flow_node": singletonBuild,
    "block_scalar": (node) => {
      if (!node.text.startsWith("|")) {
        return annotateEmpty(node.endIndex);
      }
      const ls = lines(node.text);
      if (ls.length < 2) {
        return annotateEmpty(node.endIndex);
      }
      const indent = ls[1].length - ls[1].trimStart().length;
      const result2 = ls.slice(1).map((l) => l.slice(indent)).join("\n");
      return annotate(node, result2, []);
    },
    "block_sequence": (node) => {
      const result2 = [], components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type !== "block_sequence_item") {
          continue;
        }
        const component = buildNode(child, node.endIndex);
        components.push(component);
        result2.push(component && component.result);
      }
      return annotate(node, result2, components);
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
      const str = node.text.slice(1, -1);
      const matches = [
        -2,
        ...Array.from(matchAll(str, /''/g)).map((x) => x.index),
        str.length
      ];
      const lst = [];
      for (let i = 0; i < matches.length - 1; ++i) {
        lst.push(str.substring(matches[i] + 2, matches[i + 1]));
      }
      const result2 = lst.join("'");
      return annotate(node, result2, []);
    },
    "plain_scalar": (node) => {
      function getV() {
        try {
          return JSON.parse(node.text);
        } catch (_e) {
          return node.text;
        }
      }
      const v = getV();
      return annotate(node, v, []);
    },
    "flow_sequence": (node) => {
      const result2 = [], components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type !== "flow_node") {
          continue;
        }
        const component = buildNode(child, node.endIndex);
        components.push(component);
        result2.push(component.result);
      }
      return annotate(node, result2, components);
    },
    "block_mapping": (node) => {
      const result2 = {}, components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        let component;
        if (child.type === "ERROR") {
          result2[child.text] = "<<ERROR>>";
          const key2 = annotate(child, child.text, []);
          const value2 = annotateEmpty(child.endIndex);
          component = annotate(child, {
            key: key2.result,
            value: value2.result
          }, [key2, value2]);
        } else if (child.type !== "block_mapping_pair") {
          continue;
        } else {
          component = buildNode(child, node.endIndex);
        }
        const { key, value } = component.result;
        result2[String(key)] = value;
        components.push(...component.components);
      }
      return annotate(node, result2, components);
    },
    "flow_pair": buildPair,
    "flow_mapping": (node) => {
      const result2 = {}, components = [];
      for (let i = 0; i < node.childCount; ++i) {
        const child = node.child(i);
        if (child.type === "flow_node") {
          continue;
        }
        if (child.type === "flow_pair") {
          const component = buildNode(child, node.endIndex);
          const { key, value } = component.result;
          result2[String(key)] = value;
          components.push(...component.components);
        }
      }
      return annotate(node, result2, components);
    },
    "block_mapping_pair": buildPair
  };
  const result = buildNode(tree.rootNode, tree.rootNode.endIndex);
  const parsedSize = tree.rootNode.text.trim().length;
  const codeSize = mappedSource2.value.trim().length;
  const lossage = parsedSize / codeSize;
  if (lossage < 0.95) {
    return null;
  }
  return result;
}
function locateCursor(annotation, position) {
  let failedLast = false;
  const kInternalLocateError = "Internal error: cursor outside bounds in sequence locate?";
  function locate(node, pathSoFar) {
    if (node.kind === "block_mapping" || node.kind === "flow_mapping") {
      for (let i = 0; i < node.components.length; i += 2) {
        const keyC = node.components[i], valueC = node.components[i + 1];
        if (keyC.start <= position && position <= keyC.end) {
          return [keyC.result, pathSoFar];
        } else if (valueC.start <= position && position <= valueC.end) {
          return locate(valueC, [keyC.result, pathSoFar]);
        }
      }
      failedLast = true;
      return pathSoFar;
    } else if (node.kind === "block_sequence" || node.kind === "flow_sequence") {
      for (let i = 0; i < node.components.length; ++i) {
        const valueC = node.components[i];
        if (valueC.start <= position && position <= valueC.end) {
          return locate(valueC, [i, pathSoFar]);
        }
        if (valueC.start > position) {
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
        return pathSoFar;
      }
    }
  }
  try {
    const value = locate(annotation, []).flat(Infinity).reverse();
    return {
      withError: failedLast,
      value
    };
  } catch (e) {
    if (e.message === kInternalLocateError) {
      return {
        withError: true,
        value: void 0
      };
    } else {
      throw e;
    }
  }
}

// paths.ts
var mainPath = "";
function setMainPath(path) {
  mainPath = path;
}
function getLocalPath(filename) {
  const result = new URL(mainPath);
  result.pathname = [...result.pathname.split("/").slice(0, -1), filename].join("/");
  return result.toString();
}

// ../mapped-text.ts
function mappedString(source, pieces, fileName) {
  if (typeof source === "string") {
    const offsetInfo = [];
    let offset = 0;
    const resultList = pieces.filter((piece) => typeof piece === "string" || piece.start !== piece.end).map((piece) => {
      if (typeof piece === "string") {
        offsetInfo.push({
          fromSource: false,
          length: piece.length,
          offset
        });
        offset += piece.length;
        return piece;
      } else {
        const resultPiece = source.substring(piece.start, piece.end);
        offsetInfo.push({
          fromSource: true,
          length: resultPiece.length,
          offset,
          range: {
            start: piece.start,
            end: piece.end
          }
        });
        offset += resultPiece.length;
        return resultPiece;
      }
    });
    const value = resultList.join("");
    const map = (targetOffset) => {
      const ix = glb(offsetInfo, { offset: targetOffset }, (a, b) => a.offset - b.offset);
      if (ix < 0) {
        return void 0;
      }
      const info = offsetInfo[ix];
      if (!info.fromSource) {
        return void 0;
      }
      const localOffset = targetOffset - info.offset;
      if (localOffset >= info.length) {
        return void 0;
      }
      return info.range.start + localOffset;
    };
    const mapClosest = (targetOffset) => {
      if (offsetInfo.length === 0 || targetOffset < 0) {
        return void 0;
      }
      const firstIx = glb(offsetInfo, { offset: targetOffset }, (a, b) => a.offset - b.offset);
      let ix = firstIx;
      let smallestSourceInfo = void 0;
      while (ix >= 0) {
        const info = offsetInfo[ix];
        if (!info.fromSource) {
          ix--;
          continue;
        }
        smallestSourceInfo = info;
        if (ix === firstIx) {
          const localOffset = targetOffset - info.offset;
          if (localOffset < info.length) {
            return info.range.start + localOffset;
          }
        }
        return info.range.end - 1;
      }
      if (smallestSourceInfo === void 0) {
        return void 0;
      } else {
        return smallestSourceInfo.range.start;
      }
    };
    return {
      value,
      originalString: source,
      fileName,
      map,
      mapClosest
    };
  } else {
    const {
      value,
      originalString,
      map: previousMap,
      mapClosest: previousMapClosest,
      fileName: previousFileName
    } = source;
    const {
      value: resultValue,
      map: nextMap,
      mapClosest: nextMapClosest
    } = mappedString(value, pieces);
    const composeMap = (offset) => {
      const v = nextMap(offset);
      if (v === void 0) {
        return v;
      }
      return previousMap(v);
    };
    const composeMapClosest = (offset) => {
      const v = nextMapClosest(offset);
      if (v === void 0) {
        return v;
      }
      return previousMapClosest(v);
    };
    return {
      value: resultValue,
      originalString,
      map: composeMap,
      mapClosest: composeMapClosest,
      fileName: previousFileName
    };
  }
}
function asMappedString(str, fileName) {
  if (typeof str === "string") {
    return {
      value: str,
      originalString: str,
      map: (x) => x,
      mapClosest: (x) => x,
      fileName
    };
  } else if (fileName !== void 0) {
    throw new Error("Internal error: can't change the fileName of an existing MappedString");
  } else {
    return str;
  }
}
function mappedIndexToRowCol(eitherText) {
  const text = asMappedString(eitherText);
  const f = indexToRowCol(text.originalString);
  return function(offset) {
    const n = text.mapClosest(offset);
    if (n === void 0) {
      throw new Error("Internal Error: bad offset in mappedIndexRowCol");
    }
    return f(n);
  };
}

// ../ranged-text.ts
function matchAll2(str, regex) {
  let match;
  regex = new RegExp(regex);
  const result = [];
  while ((match = regex.exec(str)) != null) {
    result.push(match);
  }
  return result;
}
function rangedLines(text, includeNewLines = false) {
  const regex = /\r?\n/g;
  const result = [];
  let startOffset = 0;
  if (!includeNewLines) {
    for (const r of matchAll2(text, regex)) {
      result.push({
        substring: text.substring(startOffset, r.index),
        range: {
          start: startOffset,
          end: r.index
        }
      });
      startOffset = r.index + r[0].length;
    }
    result.push({
      substring: text.substring(startOffset, text.length),
      range: {
        start: startOffset,
        end: text.length
      }
    });
    return result;
  } else {
    const matches = matchAll2(text, regex);
    let prevOffset = 0;
    for (const r of matches) {
      const stringEnd = r.index + 1;
      result.push({
        substring: text.substring(prevOffset, stringEnd),
        range: {
          start: prevOffset,
          end: stringEnd
        }
      });
      prevOffset = stringEnd;
    }
    result.push({
      substring: text.substring(prevOffset, text.length),
      range: {
        start: prevOffset,
        end: text.length
      }
    });
    return result;
  }
}

// parsing.ts
var _parser;
async function getTreeSitter() {
  if (_parser) {
    return _parser;
  }
  const Parser = window.TreeSitter;
  await Parser.init();
  _parser = new Parser();
  const YAML = await Parser.Language.load(getLocalPath("tree-sitter-yaml.wasm"));
  _parser.setLanguage(YAML);
  return _parser;
}
function* attemptParsesAtLine(context, parser) {
  const {
    position
  } = context;
  const code2 = asMappedString(context.code);
  try {
    const tree = parser.parse(code2.value);
    if (tree.rootNode.type !== "ERROR") {
      yield {
        parse: tree,
        code: code2,
        deletions: 0
      };
    }
  } catch (_e) {
    return;
  }
  const codeLines = rangedLines(code2.value, true);
  if (position.row >= codeLines.length || position.row < 0) {
    return;
  }
  const currentLine = codeLines[position.row].substring;
  let currentColumn = position.column;
  let deletions = 0;
  const locF = rowColToIndex(code2.value);
  while (currentColumn > 0) {
    currentColumn--;
    deletions++;
    const chunks = [];
    if (position.row > 0) {
      chunks.push({
        start: 0,
        end: codeLines[position.row - 1].range.end
      });
    }
    if (position.column > deletions) {
      chunks.push({
        start: locF({ row: position.row, column: 0 }),
        end: locF({ row: position.row, column: position.column - deletions })
      });
    }
    if (position.row + 1 < codeLines.length) {
      chunks.push({
        start: locF({ row: position.row, column: currentLine.length - 1 }),
        end: locF({ row: position.row + 1, column: 0 })
      });
      chunks.push({
        start: codeLines[position.row + 1].range.start,
        end: codeLines[codeLines.length - 1].range.end
      });
    }
    const newCode = mappedString(code2, chunks);
    const tree = parser.parse(newCode.value);
    if (tree.rootNode.type !== "ERROR") {
      yield {
        parse: tree,
        code: newCode,
        deletions
      };
    }
  }
}
function getIndent(l) {
  return l.length - l.trimStart().length;
}
function getYamlPredecessors(code2, row) {
  const yamlIndentTree = getYamlIndentTree(code2).predecessor;
  const result = [];
  while (row !== void 0 && row !== -1 && row >= 0 && row < yamlIndentTree.length) {
    result.push(row);
    row = yamlIndentTree[row];
  }
  return result;
}
function getYamlIndentTree(code2) {
  const ls = lines(code2);
  const predecessor = [];
  const indents = [];
  let indentation = -1;
  let prevPredecessor = -1;
  for (let i = 0; i < ls.length; ++i) {
    const line = ls[i];
    const lineIndent = getIndent(line);
    indents.push(lineIndent);
    if (lineIndent > indentation) {
      predecessor[i] = prevPredecessor;
      prevPredecessor = i;
      indentation = lineIndent;
    } else if (line.trim().length === 0) {
      predecessor[i] = predecessor[prevPredecessor];
    } else if (lineIndent === indentation) {
      predecessor[i] = predecessor[prevPredecessor];
      prevPredecessor = i;
    } else if (lineIndent < indentation) {
      let v = prevPredecessor;
      while (v >= 0 && indents[v] >= lineIndent) {
        v = predecessor[v];
      }
      predecessor[i] = v;
      prevPredecessor = i;
      indentation = lineIndent;
    } else {
      throw new Error("Internal error, should never have arrived here");
    }
  }
  return {
    predecessor,
    indentation: indents
  };
}
function locateFromIndentation(context) {
  const {
    line,
    code: mappedCode,
    position
  } = context;
  const code2 = asMappedString(mappedCode).value;
  const { predecessor, indentation } = getYamlIndentTree(code2);
  const ls = lines(code2);
  let lineNo = position.row;
  const path = [];
  const lineIndent = getIndent(line);
  while (lineNo !== -1) {
    const trimmed = ls[lineNo].trim();
    if (trimmed.length === 0) {
      let prev = lineNo;
      while (prev >= 0 && ls[prev].trim().length === 0) {
        prev--;
      }
      if (prev === -1) {
        break;
      }
      const prevIndent = getIndent(ls[prev]);
      if (prevIndent < lineIndent) {
        lineNo = prev;
        continue;
      } else if (prevIndent > lineIndent) {
        do {
          prev--;
        } while (prev >= 0 && (ls[prev].trim().length === 0 || getIndent(ls[prev]) >= lineIndent));
        lineNo = prev;
        continue;
      }
    }
    if (lineIndent >= indentation[lineNo]) {
      if (trimmed.startsWith("-")) {
        path.push(0);
      } else if (trimmed.endsWith(":")) {
        path.push(trimmed.substring(0, trimmed.length - 1));
      }
    }
    lineNo = predecessor[lineNo];
  }
  path.reverse();
  return path;
}

// ../semaphore.ts
var Semaphore = class {
  constructor(value) {
    this.value = value;
    this.tasks = [];
  }
  release() {
    this.value += 1;
    if (this.tasks.length) {
      const { resolve } = this.tasks.pop();
      resolve();
    }
  }
  async acquire() {
    if (this.value > 0) {
      this.value -= 1;
      return;
    }
    const result = new Promise((resolve, reject) => {
      this.tasks.push({ resolve, reject });
    });
    await result;
    await this.acquire();
  }
  async runExclusive(fun) {
    await this.acquire();
    try {
      fun();
    } finally {
      this.release();
    }
  }
};

// ../yaml-validation/state.ts
function makeInitializer(thunk) {
  let initStarted = false;
  const hasInitSemaphore = new Semaphore(0);
  return async () => {
    if (initStarted) {
      await hasInitSemaphore.runExclusive(async () => {
      });
      return;
    }
    initStarted = true;
    await thunk();
    hasInitSemaphore.release();
  };
}
var initializer = () => {
  throw new Error("initializer not set!!");
};
async function initState() {
  await initializer();
}
var hasSet = false;
function setInitializer(init) {
  if (hasSet) {
    return;
  }
  initializer = makeInitializer(init);
  hasSet = true;
}

// ../yaml-validation/schema.ts
function schemaAccepts(schema, testType) {
  const t = schemaType(schema);
  if (t === testType) {
    return true;
  }
  switch (t) {
    case "oneOf":
      return schema.oneOf.some((s) => schemaAccepts(s, testType));
    case "anyOf":
      return schema.anyOf.some((s) => schemaAccepts(s, testType));
    case "allOf":
      return schema.allOf.every((s) => schemaAccepts(s, testType));
  }
  return false;
}
function schemaType(schema) {
  const t = schema.type;
  if (t) {
    return t;
  }
  if (schema.anyOf) {
    return "anyOf";
  }
  if (schema.oneOf) {
    return "oneOf";
  }
  if (schema.allOf) {
    return "allOf";
  }
  if (schema.enum) {
    return "enum";
  }
  return "any";
}
function walkSchema(schema, f) {
  const t = schemaType(schema);
  if (typeof f === "function") {
    if (f(schema) === true) {
      return;
    }
  } else {
    if (f[t] !== void 0) {
      if (f[t](schema) === true) {
        return;
      }
    }
  }
  switch (t) {
    case "array":
      if (schema.items) {
        walkSchema(schema.items, f);
      }
      break;
    case "anyOf":
      for (const s of schema.anyOf) {
        walkSchema(s, f);
      }
      break;
    case "oneOf":
      for (const s of schema.oneOf) {
        walkSchema(s, f);
      }
      break;
    case "allOf":
      for (const s of schema.allOf) {
        walkSchema(s, f);
      }
      break;
    case "object":
      if (schema.properties) {
        for (const key of Object.getOwnPropertyNames(schema.properties)) {
          const s = schema.properties[key];
          walkSchema(s, f);
        }
      }
      if (schema.patternProperties) {
        for (const key of Object.getOwnPropertyNames(schema.patternProperties)) {
          const s = schema.patternProperties[key];
          walkSchema(s, f);
        }
      }
      if (schema.additionalProperties) {
        walkSchema(schema.additionalProperties, f);
      }
      break;
  }
}
var definitionsObject = {};
function getSchemaDefinition(key) {
  if (definitionsObject[key] === void 0) {
    throw new Error(`Internal Error: Schema ${key} not found.`);
  }
  return definitionsObject[key];
}
function setSchemaDefinition(schema) {
  if (definitionsObject[schema.$id] === void 0) {
    definitionsObject[schema.$id] = schema;
  }
}
function expandAliasesFrom(lst, defs) {
  const aliases = defs;
  const result = [];
  lst = lst.slice();
  for (let i = 0; i < lst.length; ++i) {
    const el = lst[i];
    if (el.startsWith("$")) {
      const v = aliases[el.slice(1)];
      if (v === void 0) {
        throw new Error(`Internal Error: ${el} doesn't have an entry in the aliases map`);
      }
      lst.push(...v);
    } else {
      result.push(el);
    }
  }
  return result;
}

// ../external/regexpp.mjs
var largeIdStartRanges = void 0;
var largeIdContinueRanges = void 0;
function isIdStart(cp) {
  if (cp < 65)
    return false;
  if (cp < 91)
    return true;
  if (cp < 97)
    return false;
  if (cp < 123)
    return true;
  return isLargeIdStart(cp);
}
function isIdContinue(cp) {
  if (cp < 48)
    return false;
  if (cp < 58)
    return true;
  if (cp < 65)
    return false;
  if (cp < 91)
    return true;
  if (cp === 95)
    return true;
  if (cp < 97)
    return false;
  if (cp < 123)
    return true;
  return isLargeIdStart(cp) || isLargeIdContinue(cp);
}
function isLargeIdStart(cp) {
  return isInRange(cp, largeIdStartRanges || (largeIdStartRanges = initLargeIdStartRanges()));
}
function isLargeIdContinue(cp) {
  return isInRange(cp, largeIdContinueRanges || (largeIdContinueRanges = initLargeIdContinueRanges()));
}
function initLargeIdStartRanges() {
  return restoreRanges("4q 0 b 0 5 0 6 m 2 u 2 cp 5 b f 4 8 0 2 0 3m 4 2 1 3 3 2 0 7 0 2 2 2 0 2 j 2 2a 2 3u 9 4l 2 11 3 0 7 14 20 q 5 3 1a 16 10 1 2 2q 2 0 g 1 8 1 b 2 3 0 h 0 2 t u 2g c 0 p w a 1 5 0 6 l 5 0 a 0 4 0 o o 8 a 1i k 2 h 1p 1h 4 0 j 0 8 9 g f 5 7 3 1 3 l 2 6 2 0 4 3 4 0 h 0 e 1 2 2 f 1 b 0 9 5 5 1 3 l 2 6 2 1 2 1 2 1 w 3 2 0 k 2 h 8 2 2 2 l 2 6 2 1 2 4 4 0 j 0 g 1 o 0 c 7 3 1 3 l 2 6 2 1 2 4 4 0 v 1 2 2 g 0 i 0 2 5 4 2 2 3 4 1 2 0 2 1 4 1 4 2 4 b n 0 1h 7 2 2 2 m 2 f 4 0 r 2 6 1 v 0 5 7 2 2 2 m 2 9 2 4 4 0 x 0 2 1 g 1 i 8 2 2 2 14 3 0 h 0 6 2 9 2 p 5 6 h 4 n 2 8 2 0 3 6 1n 1b 2 1 d 6 1n 1 2 0 2 4 2 n 2 0 2 9 2 1 a 0 3 4 2 0 m 3 x 0 1s 7 2 z s 4 38 16 l 0 h 5 5 3 4 0 4 1 8 2 5 c d 0 i 11 2 0 6 0 3 16 2 98 2 3 3 6 2 0 2 3 3 14 2 3 3 w 2 3 3 6 2 0 2 3 3 e 2 1k 2 3 3 1u 12 f h 2d 3 5 4 h7 3 g 2 p 6 22 4 a 8 c 2 3 f h f h f c 2 2 g 1f 10 0 5 0 1w 2g 8 14 2 0 6 1x b u 1e t 3 4 c 17 5 p 1j m a 1g 2b 0 2m 1a i 6 1k t e 1 b 17 r z 16 2 b z 3 8 8 16 3 2 16 3 2 5 2 1 4 0 6 5b 1t 7p 3 5 3 11 3 5 3 7 2 0 2 0 2 0 2 u 3 1g 2 6 2 0 4 2 2 6 4 3 3 5 5 c 6 2 2 6 39 0 e 0 h c 2u 0 5 0 3 9 2 0 3 5 7 0 2 0 2 0 2 f 3 3 6 4 5 0 i 14 22g 1a 2 1a 2 3o 7 3 4 1 d 11 2 0 6 0 3 1j 8 0 h m a 6 2 6 2 6 2 6 2 6 2 6 2 6 2 6 fb 2 q 8 8 4 3 4 5 2d 5 4 2 2h 2 3 6 16 2 2l i v 1d f e9 533 1t g70 4 wc 1w 19 3 7g 4 f b 1 l 1a h u 3 27 14 8 3 2u 3 1g 3 8 17 c 2 2 2 3 2 m u 1f f 1d 1r 5 4 0 2 1 c r b m q s 8 1a t 0 h 4 2 9 b 4 2 14 o 2 2 7 l m 4 0 4 1d 2 0 4 1 3 4 3 0 2 0 p 2 3 a 8 2 d 5 3 5 3 5 a 6 2 6 2 16 2 d 7 36 u 8mb d m 5 1c 6it a5 3 2x 13 6 d 4 6 0 2 9 2 c 2 4 2 0 2 1 2 1 2 2z y a2 j 1r 3 1h 15 b 39 4 2 3q 11 p 7 p c 2g 4 5 3 5 3 5 3 2 10 b 2 p 2 i 2 1 2 e 3 d z 3e 1y 1g 7g s 4 1c 1c v e t 6 11 b t 3 z 5 7 2 4 17 4d j z 5 z 5 13 9 1f 4d 8m a l b 7 49 5 3 0 2 17 2 1 4 0 3 m b m a u 1u i 2 1 b l b p 1z 1j 7 1 1t 0 g 3 2 2 2 s 17 s 4 s 10 7 2 r s 1h b l b i e h 33 20 1k 1e e 1e e z 9p 15 7 1 27 s b 0 9 l 2z k s m d 1g 24 18 x o r z u 0 3 0 9 y 4 0 d 1b f 3 m 0 2 0 10 h 2 o 2d 6 2 0 2 3 2 e 2 9 8 1a 13 7 3 1 3 l 2 6 2 1 2 4 4 0 j 0 d 4 4f 1g j 3 l 2 v 1b l 1 2 0 55 1a 16 3 11 1b l 0 1o 16 e 0 20 q 6e 17 39 1r w 7 3 0 3 7 2 1 2 n g 0 2 0 2n 7 3 12 h 0 2 0 t 0 b 13 8 0 m 0 c 19 k 0 z 1k 7c 8 2 10 i 0 1e t 35 6 2 1 2 11 m 0 q 5 2 1 2 v f 0 94 i 5a 0 28 pl 2v 32 i 5f 24d tq 34i g6 6nu fs 8 u 36 t j 1b h 3 w k 6 i j5 1r 3l 22 6 0 1v c 1t 1 2 0 t 4qf 9 yd 17 8 6wo 7y 1e 2 i 3 9 az 1s5 2y 6 c 4 8 8 9 4mf 2c 2 1y 2 1 3 0 3 1 3 3 2 b 2 0 2 6 2 1s 2 3 3 7 2 6 2 r 2 3 2 4 2 0 4 6 2 9f 3 o 2 o 2 u 2 o 2 u 2 o 2 u 2 o 2 u 2 o 2 7 1th 18 b 6 h 0 aa 17 105 5g 1o 1v 8 0 xh 3 2 q 2 1 2 0 3 0 2 9 2 3 2 0 2 0 7 0 5 0 2 0 2 0 2 2 2 1 2 0 3 0 2 0 2 0 2 0 2 0 2 1 2 0 3 3 2 6 2 3 2 3 2 0 2 9 2 g 6 2 2 4 2 g 3et wyl z 378 c 65 3 4g1 f 5rk 2e8 f1 15v 3t6");
}
function initLargeIdContinueRanges() {
  return restoreRanges("53 0 g9 33 o 0 70 4 7e 18 2 0 2 1 2 1 2 0 21 a 1d u 7 0 2u 6 3 5 3 1 2 3 3 9 o 0 v q 2k a g 9 y 8 a 0 p 3 2 8 2 2 2 4 18 2 3c e 2 w 1j 2 2 h 2 6 b 1 3 9 i 2 1l 0 2 6 3 1 3 2 a 0 b 1 3 9 f 0 3 2 1l 0 2 4 5 1 3 2 4 0 l b 4 0 c 2 1l 0 2 7 2 2 2 2 l 1 3 9 b 5 2 2 1l 0 2 6 3 1 3 2 8 2 b 1 3 9 j 0 1o 4 4 2 2 3 a 0 f 9 h 4 1m 6 2 2 2 3 8 1 c 1 3 9 i 2 1l 0 2 6 2 2 2 3 8 1 c 1 3 9 h 3 1k 1 2 6 2 2 2 3 a 0 b 1 3 9 i 2 1z 0 5 5 2 0 2 7 7 9 3 1 1q 0 3 6 d 7 2 9 2g 0 3 8 c 5 3 9 1r 1 7 9 c 0 2 0 2 0 5 1 1e j 2 1 6 a 2 z a 0 2t j 2 9 d 3 5 2 2 2 3 6 4 3 e b 2 e jk 2 a 8 pt 2 u 2 u 1 v 1 1t v a 0 3 9 y 2 3 9 40 0 3b b 5 b b 9 3l a 1p 4 1m 9 2 s 3 a 7 9 n d 2 1 1s 4 1c g c 9 i 8 d 2 v c 3 9 19 d 1d j 9 9 7 9 3b 2 2 k 5 0 7 0 3 2 5j 1l 2 4 g0 1 k 0 3g c 5 0 4 b 2db 2 3y 0 2p v ff 5 2y 1 n7q 9 1y 0 5 9 x 1 29 1 7l 0 4 0 5 0 o 4 5 0 2c 1 1f h b 9 7 h e a t 7 q c 19 3 1c d g 9 c 0 b 9 1c d d 0 9 1 3 9 y 2 1f 0 2 2 3 1 6 1 2 0 16 4 6 1 6l 7 2 1 3 9 fmt 0 ki f h f 4 1 p 2 5d 9 12 0 ji 0 6b 0 46 4 86 9 120 2 2 1 6 3 15 2 5 0 4m 1 fy 3 9 9 aa 1 4a a 4w 2 1i e w 9 g 3 1a a 1i 9 7 2 11 d 2 9 6 1 19 0 d 2 1d d 9 3 2 b 2b b 7 0 4h b 6 9 7 3 1k 1 2 6 3 1 3 2 a 0 b 1 3 6 4 4 5d h a 9 5 0 2a j d 9 5y 6 3 8 s 1 2b g g 9 2a c 9 9 2c e 5 9 6r e 4m 9 1z 5 2 1 3 3 2 0 2 1 d 9 3c 6 3 6 4 0 t 9 15 6 2 3 9 0 a a 1b f ba 7 2 7 h 9 1l l 2 d 3f 5 4 0 2 1 2 6 2 0 9 9 1d 4 2 1 2 4 9 9 96 3 ewa 9 3r 4 1o 6 q 9 s6 0 2 1i 8 3 2a 0 c 1 f58 1 43r 4 4 5 9 7 3 6 v 3 45 2 13e 1d e9 1i 5 1d 9 0 f 0 n 4 2 e 11t 6 2 g 3 6 2 1 2 4 7a 6 a 9 bn d 15j 6 32 6 6 9 3o7 9 gvt3 6n");
}
function isInRange(cp, ranges) {
  let l = 0, r = ranges.length / 2 | 0, i = 0, min = 0, max = 0;
  while (l < r) {
    i = (l + r) / 2 | 0;
    min = ranges[2 * i];
    max = ranges[2 * i + 1];
    if (cp < min) {
      r = i;
    } else if (cp > max) {
      l = i + 1;
    } else {
      return true;
    }
  }
  return false;
}
function restoreRanges(data) {
  let last = 0;
  return data.split(" ").map((s) => last += parseInt(s, 36) | 0);
}
var DataSet = class {
  constructor(raw2018, raw2019, raw2020, raw2021) {
    this._raw2018 = raw2018;
    this._raw2019 = raw2019;
    this._raw2020 = raw2020;
    this._raw2021 = raw2021;
  }
  get es2018() {
    return this._set2018 || (this._set2018 = new Set(this._raw2018.split(" ")));
  }
  get es2019() {
    return this._set2019 || (this._set2019 = new Set(this._raw2019.split(" ")));
  }
  get es2020() {
    return this._set2020 || (this._set2020 = new Set(this._raw2020.split(" ")));
  }
  get es2021() {
    return this._set2021 || (this._set2021 = new Set(this._raw2021.split(" ")));
  }
};
var gcNameSet = new Set(["General_Category", "gc"]);
var scNameSet = new Set(["Script", "Script_Extensions", "sc", "scx"]);
var gcValueSets = new DataSet("C Cased_Letter Cc Cf Close_Punctuation Cn Co Combining_Mark Connector_Punctuation Control Cs Currency_Symbol Dash_Punctuation Decimal_Number Enclosing_Mark Final_Punctuation Format Initial_Punctuation L LC Letter Letter_Number Line_Separator Ll Lm Lo Lowercase_Letter Lt Lu M Mark Math_Symbol Mc Me Mn Modifier_Letter Modifier_Symbol N Nd Nl No Nonspacing_Mark Number Open_Punctuation Other Other_Letter Other_Number Other_Punctuation Other_Symbol P Paragraph_Separator Pc Pd Pe Pf Pi Po Private_Use Ps Punctuation S Sc Separator Sk Sm So Space_Separator Spacing_Mark Surrogate Symbol Titlecase_Letter Unassigned Uppercase_Letter Z Zl Zp Zs cntrl digit punct", "", "", "");
var scValueSets = new DataSet("Adlam Adlm Aghb Ahom Anatolian_Hieroglyphs Arab Arabic Armenian Armi Armn Avestan Avst Bali Balinese Bamu Bamum Bass Bassa_Vah Batak Batk Beng Bengali Bhaiksuki Bhks Bopo Bopomofo Brah Brahmi Brai Braille Bugi Buginese Buhd Buhid Cakm Canadian_Aboriginal Cans Cari Carian Caucasian_Albanian Chakma Cham Cher Cherokee Common Copt Coptic Cprt Cuneiform Cypriot Cyrillic Cyrl Deseret Deva Devanagari Dsrt Dupl Duployan Egyp Egyptian_Hieroglyphs Elba Elbasan Ethi Ethiopic Geor Georgian Glag Glagolitic Gonm Goth Gothic Gran Grantha Greek Grek Gujarati Gujr Gurmukhi Guru Han Hang Hangul Hani Hano Hanunoo Hatr Hatran Hebr Hebrew Hira Hiragana Hluw Hmng Hung Imperial_Aramaic Inherited Inscriptional_Pahlavi Inscriptional_Parthian Ital Java Javanese Kaithi Kali Kana Kannada Katakana Kayah_Li Khar Kharoshthi Khmer Khmr Khoj Khojki Khudawadi Knda Kthi Lana Lao Laoo Latin Latn Lepc Lepcha Limb Limbu Lina Linb Linear_A Linear_B Lisu Lyci Lycian Lydi Lydian Mahajani Mahj Malayalam Mand Mandaic Mani Manichaean Marc Marchen Masaram_Gondi Meetei_Mayek Mend Mende_Kikakui Merc Mero Meroitic_Cursive Meroitic_Hieroglyphs Miao Mlym Modi Mong Mongolian Mro Mroo Mtei Mult Multani Myanmar Mymr Nabataean Narb Nbat New_Tai_Lue Newa Nko Nkoo Nshu Nushu Ogam Ogham Ol_Chiki Olck Old_Hungarian Old_Italic Old_North_Arabian Old_Permic Old_Persian Old_South_Arabian Old_Turkic Oriya Orkh Orya Osage Osge Osma Osmanya Pahawh_Hmong Palm Palmyrene Pau_Cin_Hau Pauc Perm Phag Phags_Pa Phli Phlp Phnx Phoenician Plrd Prti Psalter_Pahlavi Qaac Qaai Rejang Rjng Runic Runr Samaritan Samr Sarb Saur Saurashtra Sgnw Sharada Shavian Shaw Shrd Sidd Siddham SignWriting Sind Sinh Sinhala Sora Sora_Sompeng Soyo Soyombo Sund Sundanese Sylo Syloti_Nagri Syrc Syriac Tagalog Tagb Tagbanwa Tai_Le Tai_Tham Tai_Viet Takr Takri Tale Talu Tamil Taml Tang Tangut Tavt Telu Telugu Tfng Tglg Thaa Thaana Thai Tibetan Tibt Tifinagh Tirh Tirhuta Ugar Ugaritic Vai Vaii Wara Warang_Citi Xpeo Xsux Yi Yiii Zanabazar_Square Zanb Zinh Zyyy", "Dogr Dogra Gong Gunjala_Gondi Hanifi_Rohingya Maka Makasar Medefaidrin Medf Old_Sogdian Rohg Sogd Sogdian Sogo", "Elym Elymaic Hmnp Nand Nandinagari Nyiakeng_Puachue_Hmong Wancho Wcho", "Chorasmian Chrs Diak Dives_Akuru Khitan_Small_Script Kits Yezi Yezidi");
var binPropertySets = new DataSet("AHex ASCII ASCII_Hex_Digit Alpha Alphabetic Any Assigned Bidi_C Bidi_Control Bidi_M Bidi_Mirrored CI CWCF CWCM CWKCF CWL CWT CWU Case_Ignorable Cased Changes_When_Casefolded Changes_When_Casemapped Changes_When_Lowercased Changes_When_NFKC_Casefolded Changes_When_Titlecased Changes_When_Uppercased DI Dash Default_Ignorable_Code_Point Dep Deprecated Dia Diacritic Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Ext Extender Gr_Base Gr_Ext Grapheme_Base Grapheme_Extend Hex Hex_Digit IDC IDS IDSB IDST IDS_Binary_Operator IDS_Trinary_Operator ID_Continue ID_Start Ideo Ideographic Join_C Join_Control LOE Logical_Order_Exception Lower Lowercase Math NChar Noncharacter_Code_Point Pat_Syn Pat_WS Pattern_Syntax Pattern_White_Space QMark Quotation_Mark RI Radical Regional_Indicator SD STerm Sentence_Terminal Soft_Dotted Term Terminal_Punctuation UIdeo Unified_Ideograph Upper Uppercase VS Variation_Selector White_Space XIDC XIDS XID_Continue XID_Start space", "Extended_Pictographic", "", "EBase EComp EMod EPres ExtPict");
function isValidUnicodeProperty(version, name, value) {
  if (gcNameSet.has(name)) {
    return version >= 2018 && gcValueSets.es2018.has(value);
  }
  if (scNameSet.has(name)) {
    return version >= 2018 && scValueSets.es2018.has(value) || version >= 2019 && scValueSets.es2019.has(value) || version >= 2020 && scValueSets.es2020.has(value) || version >= 2021 && scValueSets.es2021.has(value);
  }
  return false;
}
function isValidLoneUnicodeProperty(version, value) {
  return version >= 2018 && binPropertySets.es2018.has(value) || version >= 2019 && binPropertySets.es2019.has(value) || version >= 2021 && binPropertySets.es2021.has(value);
}
var Backspace = 8;
var CharacterTabulation = 9;
var LineFeed = 10;
var LineTabulation = 11;
var FormFeed = 12;
var CarriageReturn = 13;
var ExclamationMark = 33;
var DollarSign = 36;
var LeftParenthesis = 40;
var RightParenthesis = 41;
var Asterisk = 42;
var PlusSign = 43;
var Comma = 44;
var HyphenMinus = 45;
var FullStop = 46;
var Solidus = 47;
var DigitZero = 48;
var DigitOne = 49;
var DigitSeven = 55;
var DigitNine = 57;
var Colon = 58;
var LessThanSign = 60;
var EqualsSign = 61;
var GreaterThanSign = 62;
var QuestionMark = 63;
var LatinCapitalLetterA = 65;
var LatinCapitalLetterB = 66;
var LatinCapitalLetterD = 68;
var LatinCapitalLetterF = 70;
var LatinCapitalLetterP = 80;
var LatinCapitalLetterS = 83;
var LatinCapitalLetterW = 87;
var LatinCapitalLetterZ = 90;
var LowLine = 95;
var LatinSmallLetterA = 97;
var LatinSmallLetterB = 98;
var LatinSmallLetterC = 99;
var LatinSmallLetterD = 100;
var LatinSmallLetterF = 102;
var LatinSmallLetterG = 103;
var LatinSmallLetterI = 105;
var LatinSmallLetterK = 107;
var LatinSmallLetterM = 109;
var LatinSmallLetterN = 110;
var LatinSmallLetterP = 112;
var LatinSmallLetterR = 114;
var LatinSmallLetterS = 115;
var LatinSmallLetterT = 116;
var LatinSmallLetterU = 117;
var LatinSmallLetterV = 118;
var LatinSmallLetterW = 119;
var LatinSmallLetterX = 120;
var LatinSmallLetterY = 121;
var LatinSmallLetterZ = 122;
var LeftSquareBracket = 91;
var ReverseSolidus = 92;
var RightSquareBracket = 93;
var CircumflexAccent = 94;
var LeftCurlyBracket = 123;
var VerticalLine = 124;
var RightCurlyBracket = 125;
var ZeroWidthNonJoiner = 8204;
var ZeroWidthJoiner = 8205;
var LineSeparator = 8232;
var ParagraphSeparator = 8233;
var MinCodePoint = 0;
var MaxCodePoint = 1114111;
function isLatinLetter(code2) {
  return code2 >= LatinCapitalLetterA && code2 <= LatinCapitalLetterZ || code2 >= LatinSmallLetterA && code2 <= LatinSmallLetterZ;
}
function isDecimalDigit(code2) {
  return code2 >= DigitZero && code2 <= DigitNine;
}
function isOctalDigit(code2) {
  return code2 >= DigitZero && code2 <= DigitSeven;
}
function isHexDigit(code2) {
  return code2 >= DigitZero && code2 <= DigitNine || code2 >= LatinCapitalLetterA && code2 <= LatinCapitalLetterF || code2 >= LatinSmallLetterA && code2 <= LatinSmallLetterF;
}
function isLineTerminator(code2) {
  return code2 === LineFeed || code2 === CarriageReturn || code2 === LineSeparator || code2 === ParagraphSeparator;
}
function isValidUnicode(code2) {
  return code2 >= MinCodePoint && code2 <= MaxCodePoint;
}
function digitToInt(code2) {
  if (code2 >= LatinSmallLetterA && code2 <= LatinSmallLetterF) {
    return code2 - LatinSmallLetterA + 10;
  }
  if (code2 >= LatinCapitalLetterA && code2 <= LatinCapitalLetterF) {
    return code2 - LatinCapitalLetterA + 10;
  }
  return code2 - DigitZero;
}
function isLeadSurrogate(code2) {
  return code2 >= 55296 && code2 <= 56319;
}
function isTrailSurrogate(code2) {
  return code2 >= 56320 && code2 <= 57343;
}
function combineSurrogatePair(lead, trail) {
  return (lead - 55296) * 1024 + (trail - 56320) + 65536;
}
var legacyImpl = {
  at(s, end, i) {
    return i < end ? s.charCodeAt(i) : -1;
  },
  width(c) {
    return 1;
  }
};
var unicodeImpl = {
  at(s, end, i) {
    return i < end ? s.codePointAt(i) : -1;
  },
  width(c) {
    return c > 65535 ? 2 : 1;
  }
};
var Reader = class {
  constructor() {
    this._impl = legacyImpl;
    this._s = "";
    this._i = 0;
    this._end = 0;
    this._cp1 = -1;
    this._w1 = 1;
    this._cp2 = -1;
    this._w2 = 1;
    this._cp3 = -1;
    this._w3 = 1;
    this._cp4 = -1;
  }
  get source() {
    return this._s;
  }
  get index() {
    return this._i;
  }
  get currentCodePoint() {
    return this._cp1;
  }
  get nextCodePoint() {
    return this._cp2;
  }
  get nextCodePoint2() {
    return this._cp3;
  }
  get nextCodePoint3() {
    return this._cp4;
  }
  reset(source, start, end, uFlag) {
    this._impl = uFlag ? unicodeImpl : legacyImpl;
    this._s = source;
    this._end = end;
    this.rewind(start);
  }
  rewind(index) {
    const impl = this._impl;
    this._i = index;
    this._cp1 = impl.at(this._s, this._end, index);
    this._w1 = impl.width(this._cp1);
    this._cp2 = impl.at(this._s, this._end, index + this._w1);
    this._w2 = impl.width(this._cp2);
    this._cp3 = impl.at(this._s, this._end, index + this._w1 + this._w2);
    this._w3 = impl.width(this._cp3);
    this._cp4 = impl.at(this._s, this._end, index + this._w1 + this._w2 + this._w3);
  }
  advance() {
    if (this._cp1 !== -1) {
      const impl = this._impl;
      this._i += this._w1;
      this._cp1 = this._cp2;
      this._w1 = this._w2;
      this._cp2 = this._cp3;
      this._w2 = impl.width(this._cp2);
      this._cp3 = this._cp4;
      this._w3 = impl.width(this._cp3);
      this._cp4 = impl.at(this._s, this._end, this._i + this._w1 + this._w2 + this._w3);
    }
  }
  eat(cp) {
    if (this._cp1 === cp) {
      this.advance();
      return true;
    }
    return false;
  }
  eat2(cp1, cp2) {
    if (this._cp1 === cp1 && this._cp2 === cp2) {
      this.advance();
      this.advance();
      return true;
    }
    return false;
  }
  eat3(cp1, cp2, cp3) {
    if (this._cp1 === cp1 && this._cp2 === cp2 && this._cp3 === cp3) {
      this.advance();
      this.advance();
      this.advance();
      return true;
    }
    return false;
  }
};
var RegExpSyntaxError = class extends SyntaxError {
  constructor(source, uFlag, index, message) {
    if (source) {
      if (!source.startsWith("/")) {
        source = `/${source}/${uFlag ? "u" : ""}`;
      }
      source = `: ${source}`;
    }
    super(`Invalid regular expression${source}: ${message}`);
    this.index = index;
  }
};
function isSyntaxCharacter(cp) {
  return cp === CircumflexAccent || cp === DollarSign || cp === ReverseSolidus || cp === FullStop || cp === Asterisk || cp === PlusSign || cp === QuestionMark || cp === LeftParenthesis || cp === RightParenthesis || cp === LeftSquareBracket || cp === RightSquareBracket || cp === LeftCurlyBracket || cp === RightCurlyBracket || cp === VerticalLine;
}
function isRegExpIdentifierStart(cp) {
  return isIdStart(cp) || cp === DollarSign || cp === LowLine;
}
function isRegExpIdentifierPart(cp) {
  return isIdContinue(cp) || cp === DollarSign || cp === LowLine || cp === ZeroWidthNonJoiner || cp === ZeroWidthJoiner;
}
function isUnicodePropertyNameCharacter(cp) {
  return isLatinLetter(cp) || cp === LowLine;
}
function isUnicodePropertyValueCharacter(cp) {
  return isUnicodePropertyNameCharacter(cp) || isDecimalDigit(cp);
}
var RegExpValidator = class {
  constructor(options) {
    this._reader = new Reader();
    this._uFlag = false;
    this._nFlag = false;
    this._lastIntValue = 0;
    this._lastMinValue = 0;
    this._lastMaxValue = 0;
    this._lastStrValue = "";
    this._lastKeyValue = "";
    this._lastValValue = "";
    this._lastAssertionIsQuantifiable = false;
    this._numCapturingParens = 0;
    this._groupNames = new Set();
    this._backreferenceNames = new Set();
    this._options = options || {};
  }
  validateLiteral(source, start = 0, end = source.length) {
    this._uFlag = this._nFlag = false;
    this.reset(source, start, end);
    this.onLiteralEnter(start);
    if (this.eat(Solidus) && this.eatRegExpBody() && this.eat(Solidus)) {
      const flagStart = this.index;
      const uFlag = source.includes("u", flagStart);
      this.validateFlags(source, flagStart, end);
      this.validatePattern(source, start + 1, flagStart - 1, uFlag);
    } else if (start >= end) {
      this.raise("Empty");
    } else {
      const c = String.fromCodePoint(this.currentCodePoint);
      this.raise(`Unexpected character '${c}'`);
    }
    this.onLiteralLeave(start, end);
  }
  validateFlags(source, start = 0, end = source.length) {
    const existingFlags = new Set();
    let global = false;
    let ignoreCase = false;
    let multiline = false;
    let sticky = false;
    let unicode = false;
    let dotAll = false;
    let hasIndices = false;
    for (let i = start; i < end; ++i) {
      const flag = source.charCodeAt(i);
      if (existingFlags.has(flag)) {
        this.raise(`Duplicated flag '${source[i]}'`);
      }
      existingFlags.add(flag);
      if (flag === LatinSmallLetterG) {
        global = true;
      } else if (flag === LatinSmallLetterI) {
        ignoreCase = true;
      } else if (flag === LatinSmallLetterM) {
        multiline = true;
      } else if (flag === LatinSmallLetterU && this.ecmaVersion >= 2015) {
        unicode = true;
      } else if (flag === LatinSmallLetterY && this.ecmaVersion >= 2015) {
        sticky = true;
      } else if (flag === LatinSmallLetterS && this.ecmaVersion >= 2018) {
        dotAll = true;
      } else if (flag === LatinSmallLetterD && this.ecmaVersion >= 2022) {
        hasIndices = true;
      } else {
        this.raise(`Invalid flag '${source[i]}'`);
      }
    }
    this.onFlags(start, end, global, ignoreCase, multiline, unicode, sticky, dotAll, hasIndices);
  }
  validatePattern(source, start = 0, end = source.length, uFlag = false) {
    this._uFlag = uFlag && this.ecmaVersion >= 2015;
    this._nFlag = uFlag && this.ecmaVersion >= 2018;
    this.reset(source, start, end);
    this.consumePattern();
    if (!this._nFlag && this.ecmaVersion >= 2018 && this._groupNames.size > 0) {
      this._nFlag = true;
      this.rewind(start);
      this.consumePattern();
    }
  }
  get strict() {
    return Boolean(this._options.strict || this._uFlag);
  }
  get ecmaVersion() {
    return this._options.ecmaVersion || 2022;
  }
  onLiteralEnter(start) {
    if (this._options.onLiteralEnter) {
      this._options.onLiteralEnter(start);
    }
  }
  onLiteralLeave(start, end) {
    if (this._options.onLiteralLeave) {
      this._options.onLiteralLeave(start, end);
    }
  }
  onFlags(start, end, global, ignoreCase, multiline, unicode, sticky, dotAll, hasIndices) {
    if (this._options.onFlags) {
      this._options.onFlags(start, end, global, ignoreCase, multiline, unicode, sticky, dotAll, hasIndices);
    }
  }
  onPatternEnter(start) {
    if (this._options.onPatternEnter) {
      this._options.onPatternEnter(start);
    }
  }
  onPatternLeave(start, end) {
    if (this._options.onPatternLeave) {
      this._options.onPatternLeave(start, end);
    }
  }
  onDisjunctionEnter(start) {
    if (this._options.onDisjunctionEnter) {
      this._options.onDisjunctionEnter(start);
    }
  }
  onDisjunctionLeave(start, end) {
    if (this._options.onDisjunctionLeave) {
      this._options.onDisjunctionLeave(start, end);
    }
  }
  onAlternativeEnter(start, index) {
    if (this._options.onAlternativeEnter) {
      this._options.onAlternativeEnter(start, index);
    }
  }
  onAlternativeLeave(start, end, index) {
    if (this._options.onAlternativeLeave) {
      this._options.onAlternativeLeave(start, end, index);
    }
  }
  onGroupEnter(start) {
    if (this._options.onGroupEnter) {
      this._options.onGroupEnter(start);
    }
  }
  onGroupLeave(start, end) {
    if (this._options.onGroupLeave) {
      this._options.onGroupLeave(start, end);
    }
  }
  onCapturingGroupEnter(start, name) {
    if (this._options.onCapturingGroupEnter) {
      this._options.onCapturingGroupEnter(start, name);
    }
  }
  onCapturingGroupLeave(start, end, name) {
    if (this._options.onCapturingGroupLeave) {
      this._options.onCapturingGroupLeave(start, end, name);
    }
  }
  onQuantifier(start, end, min, max, greedy) {
    if (this._options.onQuantifier) {
      this._options.onQuantifier(start, end, min, max, greedy);
    }
  }
  onLookaroundAssertionEnter(start, kind, negate) {
    if (this._options.onLookaroundAssertionEnter) {
      this._options.onLookaroundAssertionEnter(start, kind, negate);
    }
  }
  onLookaroundAssertionLeave(start, end, kind, negate) {
    if (this._options.onLookaroundAssertionLeave) {
      this._options.onLookaroundAssertionLeave(start, end, kind, negate);
    }
  }
  onEdgeAssertion(start, end, kind) {
    if (this._options.onEdgeAssertion) {
      this._options.onEdgeAssertion(start, end, kind);
    }
  }
  onWordBoundaryAssertion(start, end, kind, negate) {
    if (this._options.onWordBoundaryAssertion) {
      this._options.onWordBoundaryAssertion(start, end, kind, negate);
    }
  }
  onAnyCharacterSet(start, end, kind) {
    if (this._options.onAnyCharacterSet) {
      this._options.onAnyCharacterSet(start, end, kind);
    }
  }
  onEscapeCharacterSet(start, end, kind, negate) {
    if (this._options.onEscapeCharacterSet) {
      this._options.onEscapeCharacterSet(start, end, kind, negate);
    }
  }
  onUnicodePropertyCharacterSet(start, end, kind, key, value, negate) {
    if (this._options.onUnicodePropertyCharacterSet) {
      this._options.onUnicodePropertyCharacterSet(start, end, kind, key, value, negate);
    }
  }
  onCharacter(start, end, value) {
    if (this._options.onCharacter) {
      this._options.onCharacter(start, end, value);
    }
  }
  onBackreference(start, end, ref) {
    if (this._options.onBackreference) {
      this._options.onBackreference(start, end, ref);
    }
  }
  onCharacterClassEnter(start, negate) {
    if (this._options.onCharacterClassEnter) {
      this._options.onCharacterClassEnter(start, negate);
    }
  }
  onCharacterClassLeave(start, end, negate) {
    if (this._options.onCharacterClassLeave) {
      this._options.onCharacterClassLeave(start, end, negate);
    }
  }
  onCharacterClassRange(start, end, min, max) {
    if (this._options.onCharacterClassRange) {
      this._options.onCharacterClassRange(start, end, min, max);
    }
  }
  get source() {
    return this._reader.source;
  }
  get index() {
    return this._reader.index;
  }
  get currentCodePoint() {
    return this._reader.currentCodePoint;
  }
  get nextCodePoint() {
    return this._reader.nextCodePoint;
  }
  get nextCodePoint2() {
    return this._reader.nextCodePoint2;
  }
  get nextCodePoint3() {
    return this._reader.nextCodePoint3;
  }
  reset(source, start, end) {
    this._reader.reset(source, start, end, this._uFlag);
  }
  rewind(index) {
    this._reader.rewind(index);
  }
  advance() {
    this._reader.advance();
  }
  eat(cp) {
    return this._reader.eat(cp);
  }
  eat2(cp1, cp2) {
    return this._reader.eat2(cp1, cp2);
  }
  eat3(cp1, cp2, cp3) {
    return this._reader.eat3(cp1, cp2, cp3);
  }
  raise(message) {
    throw new RegExpSyntaxError(this.source, this._uFlag, this.index, message);
  }
  eatRegExpBody() {
    const start = this.index;
    let inClass = false;
    let escaped = false;
    for (; ; ) {
      const cp = this.currentCodePoint;
      if (cp === -1 || isLineTerminator(cp)) {
        const kind = inClass ? "character class" : "regular expression";
        this.raise(`Unterminated ${kind}`);
      }
      if (escaped) {
        escaped = false;
      } else if (cp === ReverseSolidus) {
        escaped = true;
      } else if (cp === LeftSquareBracket) {
        inClass = true;
      } else if (cp === RightSquareBracket) {
        inClass = false;
      } else if (cp === Solidus && !inClass || cp === Asterisk && this.index === start) {
        break;
      }
      this.advance();
    }
    return this.index !== start;
  }
  consumePattern() {
    const start = this.index;
    this._numCapturingParens = this.countCapturingParens();
    this._groupNames.clear();
    this._backreferenceNames.clear();
    this.onPatternEnter(start);
    this.consumeDisjunction();
    const cp = this.currentCodePoint;
    if (this.currentCodePoint !== -1) {
      if (cp === RightParenthesis) {
        this.raise("Unmatched ')'");
      }
      if (cp === ReverseSolidus) {
        this.raise("\\ at end of pattern");
      }
      if (cp === RightSquareBracket || cp === RightCurlyBracket) {
        this.raise("Lone quantifier brackets");
      }
      const c = String.fromCodePoint(cp);
      this.raise(`Unexpected character '${c}'`);
    }
    for (const name of this._backreferenceNames) {
      if (!this._groupNames.has(name)) {
        this.raise("Invalid named capture referenced");
      }
    }
    this.onPatternLeave(start, this.index);
  }
  countCapturingParens() {
    const start = this.index;
    let inClass = false;
    let escaped = false;
    let count = 0;
    let cp = 0;
    while ((cp = this.currentCodePoint) !== -1) {
      if (escaped) {
        escaped = false;
      } else if (cp === ReverseSolidus) {
        escaped = true;
      } else if (cp === LeftSquareBracket) {
        inClass = true;
      } else if (cp === RightSquareBracket) {
        inClass = false;
      } else if (cp === LeftParenthesis && !inClass && (this.nextCodePoint !== QuestionMark || this.nextCodePoint2 === LessThanSign && this.nextCodePoint3 !== EqualsSign && this.nextCodePoint3 !== ExclamationMark)) {
        count += 1;
      }
      this.advance();
    }
    this.rewind(start);
    return count;
  }
  consumeDisjunction() {
    const start = this.index;
    let i = 0;
    this.onDisjunctionEnter(start);
    do {
      this.consumeAlternative(i++);
    } while (this.eat(VerticalLine));
    if (this.consumeQuantifier(true)) {
      this.raise("Nothing to repeat");
    }
    if (this.eat(LeftCurlyBracket)) {
      this.raise("Lone quantifier brackets");
    }
    this.onDisjunctionLeave(start, this.index);
  }
  consumeAlternative(i) {
    const start = this.index;
    this.onAlternativeEnter(start, i);
    while (this.currentCodePoint !== -1 && this.consumeTerm()) {
    }
    this.onAlternativeLeave(start, this.index, i);
  }
  consumeTerm() {
    if (this._uFlag || this.strict) {
      return this.consumeAssertion() || this.consumeAtom() && this.consumeOptionalQuantifier();
    }
    return this.consumeAssertion() && (!this._lastAssertionIsQuantifiable || this.consumeOptionalQuantifier()) || this.consumeExtendedAtom() && this.consumeOptionalQuantifier();
  }
  consumeOptionalQuantifier() {
    this.consumeQuantifier();
    return true;
  }
  consumeAssertion() {
    const start = this.index;
    this._lastAssertionIsQuantifiable = false;
    if (this.eat(CircumflexAccent)) {
      this.onEdgeAssertion(start, this.index, "start");
      return true;
    }
    if (this.eat(DollarSign)) {
      this.onEdgeAssertion(start, this.index, "end");
      return true;
    }
    if (this.eat2(ReverseSolidus, LatinCapitalLetterB)) {
      this.onWordBoundaryAssertion(start, this.index, "word", true);
      return true;
    }
    if (this.eat2(ReverseSolidus, LatinSmallLetterB)) {
      this.onWordBoundaryAssertion(start, this.index, "word", false);
      return true;
    }
    if (this.eat2(LeftParenthesis, QuestionMark)) {
      const lookbehind = this.ecmaVersion >= 2018 && this.eat(LessThanSign);
      let negate = false;
      if (this.eat(EqualsSign) || (negate = this.eat(ExclamationMark))) {
        const kind = lookbehind ? "lookbehind" : "lookahead";
        this.onLookaroundAssertionEnter(start, kind, negate);
        this.consumeDisjunction();
        if (!this.eat(RightParenthesis)) {
          this.raise("Unterminated group");
        }
        this._lastAssertionIsQuantifiable = !lookbehind && !this.strict;
        this.onLookaroundAssertionLeave(start, this.index, kind, negate);
        return true;
      }
      this.rewind(start);
    }
    return false;
  }
  consumeQuantifier(noConsume = false) {
    const start = this.index;
    let min = 0;
    let max = 0;
    let greedy = false;
    if (this.eat(Asterisk)) {
      min = 0;
      max = Number.POSITIVE_INFINITY;
    } else if (this.eat(PlusSign)) {
      min = 1;
      max = Number.POSITIVE_INFINITY;
    } else if (this.eat(QuestionMark)) {
      min = 0;
      max = 1;
    } else if (this.eatBracedQuantifier(noConsume)) {
      min = this._lastMinValue;
      max = this._lastMaxValue;
    } else {
      return false;
    }
    greedy = !this.eat(QuestionMark);
    if (!noConsume) {
      this.onQuantifier(start, this.index, min, max, greedy);
    }
    return true;
  }
  eatBracedQuantifier(noError) {
    const start = this.index;
    if (this.eat(LeftCurlyBracket)) {
      this._lastMinValue = 0;
      this._lastMaxValue = Number.POSITIVE_INFINITY;
      if (this.eatDecimalDigits()) {
        this._lastMinValue = this._lastMaxValue = this._lastIntValue;
        if (this.eat(Comma)) {
          this._lastMaxValue = this.eatDecimalDigits() ? this._lastIntValue : Number.POSITIVE_INFINITY;
        }
        if (this.eat(RightCurlyBracket)) {
          if (!noError && this._lastMaxValue < this._lastMinValue) {
            this.raise("numbers out of order in {} quantifier");
          }
          return true;
        }
      }
      if (!noError && (this._uFlag || this.strict)) {
        this.raise("Incomplete quantifier");
      }
      this.rewind(start);
    }
    return false;
  }
  consumeAtom() {
    return this.consumePatternCharacter() || this.consumeDot() || this.consumeReverseSolidusAtomEscape() || this.consumeCharacterClass() || this.consumeUncapturingGroup() || this.consumeCapturingGroup();
  }
  consumeDot() {
    if (this.eat(FullStop)) {
      this.onAnyCharacterSet(this.index - 1, this.index, "any");
      return true;
    }
    return false;
  }
  consumeReverseSolidusAtomEscape() {
    const start = this.index;
    if (this.eat(ReverseSolidus)) {
      if (this.consumeAtomEscape()) {
        return true;
      }
      this.rewind(start);
    }
    return false;
  }
  consumeUncapturingGroup() {
    const start = this.index;
    if (this.eat3(LeftParenthesis, QuestionMark, Colon)) {
      this.onGroupEnter(start);
      this.consumeDisjunction();
      if (!this.eat(RightParenthesis)) {
        this.raise("Unterminated group");
      }
      this.onGroupLeave(start, this.index);
      return true;
    }
    return false;
  }
  consumeCapturingGroup() {
    const start = this.index;
    if (this.eat(LeftParenthesis)) {
      let name = null;
      if (this.ecmaVersion >= 2018) {
        if (this.consumeGroupSpecifier()) {
          name = this._lastStrValue;
        }
      } else if (this.currentCodePoint === QuestionMark) {
        this.raise("Invalid group");
      }
      this.onCapturingGroupEnter(start, name);
      this.consumeDisjunction();
      if (!this.eat(RightParenthesis)) {
        this.raise("Unterminated group");
      }
      this.onCapturingGroupLeave(start, this.index, name);
      return true;
    }
    return false;
  }
  consumeExtendedAtom() {
    return this.consumeDot() || this.consumeReverseSolidusAtomEscape() || this.consumeReverseSolidusFollowedByC() || this.consumeCharacterClass() || this.consumeUncapturingGroup() || this.consumeCapturingGroup() || this.consumeInvalidBracedQuantifier() || this.consumeExtendedPatternCharacter();
  }
  consumeReverseSolidusFollowedByC() {
    const start = this.index;
    if (this.currentCodePoint === ReverseSolidus && this.nextCodePoint === LatinSmallLetterC) {
      this._lastIntValue = this.currentCodePoint;
      this.advance();
      this.onCharacter(start, this.index, ReverseSolidus);
      return true;
    }
    return false;
  }
  consumeInvalidBracedQuantifier() {
    if (this.eatBracedQuantifier(true)) {
      this.raise("Nothing to repeat");
    }
    return false;
  }
  consumePatternCharacter() {
    const start = this.index;
    const cp = this.currentCodePoint;
    if (cp !== -1 && !isSyntaxCharacter(cp)) {
      this.advance();
      this.onCharacter(start, this.index, cp);
      return true;
    }
    return false;
  }
  consumeExtendedPatternCharacter() {
    const start = this.index;
    const cp = this.currentCodePoint;
    if (cp !== -1 && cp !== CircumflexAccent && cp !== DollarSign && cp !== ReverseSolidus && cp !== FullStop && cp !== Asterisk && cp !== PlusSign && cp !== QuestionMark && cp !== LeftParenthesis && cp !== RightParenthesis && cp !== LeftSquareBracket && cp !== VerticalLine) {
      this.advance();
      this.onCharacter(start, this.index, cp);
      return true;
    }
    return false;
  }
  consumeGroupSpecifier() {
    if (this.eat(QuestionMark)) {
      if (this.eatGroupName()) {
        if (!this._groupNames.has(this._lastStrValue)) {
          this._groupNames.add(this._lastStrValue);
          return true;
        }
        this.raise("Duplicate capture group name");
      }
      this.raise("Invalid group");
    }
    return false;
  }
  consumeAtomEscape() {
    if (this.consumeBackreference() || this.consumeCharacterClassEscape() || this.consumeCharacterEscape() || this._nFlag && this.consumeKGroupName()) {
      return true;
    }
    if (this.strict || this._uFlag) {
      this.raise("Invalid escape");
    }
    return false;
  }
  consumeBackreference() {
    const start = this.index;
    if (this.eatDecimalEscape()) {
      const n = this._lastIntValue;
      if (n <= this._numCapturingParens) {
        this.onBackreference(start - 1, this.index, n);
        return true;
      }
      if (this.strict || this._uFlag) {
        this.raise("Invalid escape");
      }
      this.rewind(start);
    }
    return false;
  }
  consumeCharacterClassEscape() {
    const start = this.index;
    if (this.eat(LatinSmallLetterD)) {
      this._lastIntValue = -1;
      this.onEscapeCharacterSet(start - 1, this.index, "digit", false);
      return true;
    }
    if (this.eat(LatinCapitalLetterD)) {
      this._lastIntValue = -1;
      this.onEscapeCharacterSet(start - 1, this.index, "digit", true);
      return true;
    }
    if (this.eat(LatinSmallLetterS)) {
      this._lastIntValue = -1;
      this.onEscapeCharacterSet(start - 1, this.index, "space", false);
      return true;
    }
    if (this.eat(LatinCapitalLetterS)) {
      this._lastIntValue = -1;
      this.onEscapeCharacterSet(start - 1, this.index, "space", true);
      return true;
    }
    if (this.eat(LatinSmallLetterW)) {
      this._lastIntValue = -1;
      this.onEscapeCharacterSet(start - 1, this.index, "word", false);
      return true;
    }
    if (this.eat(LatinCapitalLetterW)) {
      this._lastIntValue = -1;
      this.onEscapeCharacterSet(start - 1, this.index, "word", true);
      return true;
    }
    let negate = false;
    if (this._uFlag && this.ecmaVersion >= 2018 && (this.eat(LatinSmallLetterP) || (negate = this.eat(LatinCapitalLetterP)))) {
      this._lastIntValue = -1;
      if (this.eat(LeftCurlyBracket) && this.eatUnicodePropertyValueExpression() && this.eat(RightCurlyBracket)) {
        this.onUnicodePropertyCharacterSet(start - 1, this.index, "property", this._lastKeyValue, this._lastValValue || null, negate);
        return true;
      }
      this.raise("Invalid property name");
    }
    return false;
  }
  consumeCharacterEscape() {
    const start = this.index;
    if (this.eatControlEscape() || this.eatCControlLetter() || this.eatZero() || this.eatHexEscapeSequence() || this.eatRegExpUnicodeEscapeSequence() || !this.strict && !this._uFlag && this.eatLegacyOctalEscapeSequence() || this.eatIdentityEscape()) {
      this.onCharacter(start - 1, this.index, this._lastIntValue);
      return true;
    }
    return false;
  }
  consumeKGroupName() {
    const start = this.index;
    if (this.eat(LatinSmallLetterK)) {
      if (this.eatGroupName()) {
        const groupName = this._lastStrValue;
        this._backreferenceNames.add(groupName);
        this.onBackreference(start - 1, this.index, groupName);
        return true;
      }
      this.raise("Invalid named reference");
    }
    return false;
  }
  consumeCharacterClass() {
    const start = this.index;
    if (this.eat(LeftSquareBracket)) {
      const negate = this.eat(CircumflexAccent);
      this.onCharacterClassEnter(start, negate);
      this.consumeClassRanges();
      if (!this.eat(RightSquareBracket)) {
        this.raise("Unterminated character class");
      }
      this.onCharacterClassLeave(start, this.index, negate);
      return true;
    }
    return false;
  }
  consumeClassRanges() {
    const strict = this.strict || this._uFlag;
    for (; ; ) {
      const rangeStart = this.index;
      if (!this.consumeClassAtom()) {
        break;
      }
      const min = this._lastIntValue;
      if (!this.eat(HyphenMinus)) {
        continue;
      }
      this.onCharacter(this.index - 1, this.index, HyphenMinus);
      if (!this.consumeClassAtom()) {
        break;
      }
      const max = this._lastIntValue;
      if (min === -1 || max === -1) {
        if (strict) {
          this.raise("Invalid character class");
        }
        continue;
      }
      if (min > max) {
        this.raise("Range out of order in character class");
      }
      this.onCharacterClassRange(rangeStart, this.index, min, max);
    }
  }
  consumeClassAtom() {
    const start = this.index;
    const cp = this.currentCodePoint;
    if (cp !== -1 && cp !== ReverseSolidus && cp !== RightSquareBracket) {
      this.advance();
      this._lastIntValue = cp;
      this.onCharacter(start, this.index, this._lastIntValue);
      return true;
    }
    if (this.eat(ReverseSolidus)) {
      if (this.consumeClassEscape()) {
        return true;
      }
      if (!this.strict && this.currentCodePoint === LatinSmallLetterC) {
        this._lastIntValue = ReverseSolidus;
        this.onCharacter(start, this.index, this._lastIntValue);
        return true;
      }
      if (this.strict || this._uFlag) {
        this.raise("Invalid escape");
      }
      this.rewind(start);
    }
    return false;
  }
  consumeClassEscape() {
    const start = this.index;
    if (this.eat(LatinSmallLetterB)) {
      this._lastIntValue = Backspace;
      this.onCharacter(start - 1, this.index, this._lastIntValue);
      return true;
    }
    if (this._uFlag && this.eat(HyphenMinus)) {
      this._lastIntValue = HyphenMinus;
      this.onCharacter(start - 1, this.index, this._lastIntValue);
      return true;
    }
    let cp = 0;
    if (!this.strict && !this._uFlag && this.currentCodePoint === LatinSmallLetterC && (isDecimalDigit(cp = this.nextCodePoint) || cp === LowLine)) {
      this.advance();
      this.advance();
      this._lastIntValue = cp % 32;
      this.onCharacter(start - 1, this.index, this._lastIntValue);
      return true;
    }
    return this.consumeCharacterClassEscape() || this.consumeCharacterEscape();
  }
  eatGroupName() {
    if (this.eat(LessThanSign)) {
      if (this.eatRegExpIdentifierName() && this.eat(GreaterThanSign)) {
        return true;
      }
      this.raise("Invalid capture group name");
    }
    return false;
  }
  eatRegExpIdentifierName() {
    if (this.eatRegExpIdentifierStart()) {
      this._lastStrValue = String.fromCodePoint(this._lastIntValue);
      while (this.eatRegExpIdentifierPart()) {
        this._lastStrValue += String.fromCodePoint(this._lastIntValue);
      }
      return true;
    }
    return false;
  }
  eatRegExpIdentifierStart() {
    const start = this.index;
    const forceUFlag = !this._uFlag && this.ecmaVersion >= 2020;
    let cp = this.currentCodePoint;
    this.advance();
    if (cp === ReverseSolidus && this.eatRegExpUnicodeEscapeSequence(forceUFlag)) {
      cp = this._lastIntValue;
    } else if (forceUFlag && isLeadSurrogate(cp) && isTrailSurrogate(this.currentCodePoint)) {
      cp = combineSurrogatePair(cp, this.currentCodePoint);
      this.advance();
    }
    if (isRegExpIdentifierStart(cp)) {
      this._lastIntValue = cp;
      return true;
    }
    if (this.index !== start) {
      this.rewind(start);
    }
    return false;
  }
  eatRegExpIdentifierPart() {
    const start = this.index;
    const forceUFlag = !this._uFlag && this.ecmaVersion >= 2020;
    let cp = this.currentCodePoint;
    this.advance();
    if (cp === ReverseSolidus && this.eatRegExpUnicodeEscapeSequence(forceUFlag)) {
      cp = this._lastIntValue;
    } else if (forceUFlag && isLeadSurrogate(cp) && isTrailSurrogate(this.currentCodePoint)) {
      cp = combineSurrogatePair(cp, this.currentCodePoint);
      this.advance();
    }
    if (isRegExpIdentifierPart(cp)) {
      this._lastIntValue = cp;
      return true;
    }
    if (this.index !== start) {
      this.rewind(start);
    }
    return false;
  }
  eatCControlLetter() {
    const start = this.index;
    if (this.eat(LatinSmallLetterC)) {
      if (this.eatControlLetter()) {
        return true;
      }
      this.rewind(start);
    }
    return false;
  }
  eatZero() {
    if (this.currentCodePoint === DigitZero && !isDecimalDigit(this.nextCodePoint)) {
      this._lastIntValue = 0;
      this.advance();
      return true;
    }
    return false;
  }
  eatControlEscape() {
    if (this.eat(LatinSmallLetterF)) {
      this._lastIntValue = FormFeed;
      return true;
    }
    if (this.eat(LatinSmallLetterN)) {
      this._lastIntValue = LineFeed;
      return true;
    }
    if (this.eat(LatinSmallLetterR)) {
      this._lastIntValue = CarriageReturn;
      return true;
    }
    if (this.eat(LatinSmallLetterT)) {
      this._lastIntValue = CharacterTabulation;
      return true;
    }
    if (this.eat(LatinSmallLetterV)) {
      this._lastIntValue = LineTabulation;
      return true;
    }
    return false;
  }
  eatControlLetter() {
    const cp = this.currentCodePoint;
    if (isLatinLetter(cp)) {
      this.advance();
      this._lastIntValue = cp % 32;
      return true;
    }
    return false;
  }
  eatRegExpUnicodeEscapeSequence(forceUFlag = false) {
    const start = this.index;
    const uFlag = forceUFlag || this._uFlag;
    if (this.eat(LatinSmallLetterU)) {
      if (uFlag && this.eatRegExpUnicodeSurrogatePairEscape() || this.eatFixedHexDigits(4) || uFlag && this.eatRegExpUnicodeCodePointEscape()) {
        return true;
      }
      if (this.strict || uFlag) {
        this.raise("Invalid unicode escape");
      }
      this.rewind(start);
    }
    return false;
  }
  eatRegExpUnicodeSurrogatePairEscape() {
    const start = this.index;
    if (this.eatFixedHexDigits(4)) {
      const lead = this._lastIntValue;
      if (isLeadSurrogate(lead) && this.eat(ReverseSolidus) && this.eat(LatinSmallLetterU) && this.eatFixedHexDigits(4)) {
        const trail = this._lastIntValue;
        if (isTrailSurrogate(trail)) {
          this._lastIntValue = combineSurrogatePair(lead, trail);
          return true;
        }
      }
      this.rewind(start);
    }
    return false;
  }
  eatRegExpUnicodeCodePointEscape() {
    const start = this.index;
    if (this.eat(LeftCurlyBracket) && this.eatHexDigits() && this.eat(RightCurlyBracket) && isValidUnicode(this._lastIntValue)) {
      return true;
    }
    this.rewind(start);
    return false;
  }
  eatIdentityEscape() {
    const cp = this.currentCodePoint;
    if (this.isValidIdentityEscape(cp)) {
      this._lastIntValue = cp;
      this.advance();
      return true;
    }
    return false;
  }
  isValidIdentityEscape(cp) {
    if (cp === -1) {
      return false;
    }
    if (this._uFlag) {
      return isSyntaxCharacter(cp) || cp === Solidus;
    }
    if (this.strict) {
      return !isIdContinue(cp);
    }
    if (this._nFlag) {
      return !(cp === LatinSmallLetterC || cp === LatinSmallLetterK);
    }
    return cp !== LatinSmallLetterC;
  }
  eatDecimalEscape() {
    this._lastIntValue = 0;
    let cp = this.currentCodePoint;
    if (cp >= DigitOne && cp <= DigitNine) {
      do {
        this._lastIntValue = 10 * this._lastIntValue + (cp - DigitZero);
        this.advance();
      } while ((cp = this.currentCodePoint) >= DigitZero && cp <= DigitNine);
      return true;
    }
    return false;
  }
  eatUnicodePropertyValueExpression() {
    const start = this.index;
    if (this.eatUnicodePropertyName() && this.eat(EqualsSign)) {
      this._lastKeyValue = this._lastStrValue;
      if (this.eatUnicodePropertyValue()) {
        this._lastValValue = this._lastStrValue;
        if (isValidUnicodeProperty(this.ecmaVersion, this._lastKeyValue, this._lastValValue)) {
          return true;
        }
        this.raise("Invalid property name");
      }
    }
    this.rewind(start);
    if (this.eatLoneUnicodePropertyNameOrValue()) {
      const nameOrValue = this._lastStrValue;
      if (isValidUnicodeProperty(this.ecmaVersion, "General_Category", nameOrValue)) {
        this._lastKeyValue = "General_Category";
        this._lastValValue = nameOrValue;
        return true;
      }
      if (isValidLoneUnicodeProperty(this.ecmaVersion, nameOrValue)) {
        this._lastKeyValue = nameOrValue;
        this._lastValValue = "";
        return true;
      }
      this.raise("Invalid property name");
    }
    return false;
  }
  eatUnicodePropertyName() {
    this._lastStrValue = "";
    while (isUnicodePropertyNameCharacter(this.currentCodePoint)) {
      this._lastStrValue += String.fromCodePoint(this.currentCodePoint);
      this.advance();
    }
    return this._lastStrValue !== "";
  }
  eatUnicodePropertyValue() {
    this._lastStrValue = "";
    while (isUnicodePropertyValueCharacter(this.currentCodePoint)) {
      this._lastStrValue += String.fromCodePoint(this.currentCodePoint);
      this.advance();
    }
    return this._lastStrValue !== "";
  }
  eatLoneUnicodePropertyNameOrValue() {
    return this.eatUnicodePropertyValue();
  }
  eatHexEscapeSequence() {
    const start = this.index;
    if (this.eat(LatinSmallLetterX)) {
      if (this.eatFixedHexDigits(2)) {
        return true;
      }
      if (this._uFlag || this.strict) {
        this.raise("Invalid escape");
      }
      this.rewind(start);
    }
    return false;
  }
  eatDecimalDigits() {
    const start = this.index;
    this._lastIntValue = 0;
    while (isDecimalDigit(this.currentCodePoint)) {
      this._lastIntValue = 10 * this._lastIntValue + digitToInt(this.currentCodePoint);
      this.advance();
    }
    return this.index !== start;
  }
  eatHexDigits() {
    const start = this.index;
    this._lastIntValue = 0;
    while (isHexDigit(this.currentCodePoint)) {
      this._lastIntValue = 16 * this._lastIntValue + digitToInt(this.currentCodePoint);
      this.advance();
    }
    return this.index !== start;
  }
  eatLegacyOctalEscapeSequence() {
    if (this.eatOctalDigit()) {
      const n1 = this._lastIntValue;
      if (this.eatOctalDigit()) {
        const n2 = this._lastIntValue;
        if (n1 <= 3 && this.eatOctalDigit()) {
          this._lastIntValue = n1 * 64 + n2 * 8 + this._lastIntValue;
        } else {
          this._lastIntValue = n1 * 8 + n2;
        }
      } else {
        this._lastIntValue = n1;
      }
      return true;
    }
    return false;
  }
  eatOctalDigit() {
    const cp = this.currentCodePoint;
    if (isOctalDigit(cp)) {
      this.advance();
      this._lastIntValue = cp - DigitZero;
      return true;
    }
    this._lastIntValue = 0;
    return false;
  }
  eatFixedHexDigits(length) {
    const start = this.index;
    this._lastIntValue = 0;
    for (let i = 0; i < length; ++i) {
      const cp = this.currentCodePoint;
      if (!isHexDigit(cp)) {
        this.rewind(start);
        return false;
      }
      this._lastIntValue = 16 * this._lastIntValue + digitToInt(cp);
      this.advance();
    }
    return true;
  }
};
var DummyPattern = {};
var DummyFlags = {};
var DummyCapturingGroup = {};
var RegExpParserState = class {
  constructor(options) {
    this._node = DummyPattern;
    this._flags = DummyFlags;
    this._backreferences = [];
    this._capturingGroups = [];
    this.source = "";
    this.strict = Boolean(options && options.strict);
    this.ecmaVersion = options && options.ecmaVersion || 2022;
  }
  get pattern() {
    if (this._node.type !== "Pattern") {
      throw new Error("UnknownError");
    }
    return this._node;
  }
  get flags() {
    if (this._flags.type !== "Flags") {
      throw new Error("UnknownError");
    }
    return this._flags;
  }
  onFlags(start, end, global, ignoreCase, multiline, unicode, sticky, dotAll, hasIndices) {
    this._flags = {
      type: "Flags",
      parent: null,
      start,
      end,
      raw: this.source.slice(start, end),
      global,
      ignoreCase,
      multiline,
      unicode,
      sticky,
      dotAll,
      hasIndices
    };
  }
  onPatternEnter(start) {
    this._node = {
      type: "Pattern",
      parent: null,
      start,
      end: start,
      raw: "",
      alternatives: []
    };
    this._backreferences.length = 0;
    this._capturingGroups.length = 0;
  }
  onPatternLeave(start, end) {
    this._node.end = end;
    this._node.raw = this.source.slice(start, end);
    for (const reference of this._backreferences) {
      const ref = reference.ref;
      const group = typeof ref === "number" ? this._capturingGroups[ref - 1] : this._capturingGroups.find((g) => g.name === ref);
      reference.resolved = group;
      group.references.push(reference);
    }
  }
  onAlternativeEnter(start) {
    const parent = this._node;
    if (parent.type !== "Assertion" && parent.type !== "CapturingGroup" && parent.type !== "Group" && parent.type !== "Pattern") {
      throw new Error("UnknownError");
    }
    this._node = {
      type: "Alternative",
      parent,
      start,
      end: start,
      raw: "",
      elements: []
    };
    parent.alternatives.push(this._node);
  }
  onAlternativeLeave(start, end) {
    const node = this._node;
    if (node.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    node.end = end;
    node.raw = this.source.slice(start, end);
    this._node = node.parent;
  }
  onGroupEnter(start) {
    const parent = this._node;
    if (parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    this._node = {
      type: "Group",
      parent,
      start,
      end: start,
      raw: "",
      alternatives: []
    };
    parent.elements.push(this._node);
  }
  onGroupLeave(start, end) {
    const node = this._node;
    if (node.type !== "Group" || node.parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    node.end = end;
    node.raw = this.source.slice(start, end);
    this._node = node.parent;
  }
  onCapturingGroupEnter(start, name) {
    const parent = this._node;
    if (parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    this._node = {
      type: "CapturingGroup",
      parent,
      start,
      end: start,
      raw: "",
      name,
      alternatives: [],
      references: []
    };
    parent.elements.push(this._node);
    this._capturingGroups.push(this._node);
  }
  onCapturingGroupLeave(start, end) {
    const node = this._node;
    if (node.type !== "CapturingGroup" || node.parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    node.end = end;
    node.raw = this.source.slice(start, end);
    this._node = node.parent;
  }
  onQuantifier(start, end, min, max, greedy) {
    const parent = this._node;
    if (parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    const element = parent.elements.pop();
    if (element == null || element.type === "Quantifier" || element.type === "Assertion" && element.kind !== "lookahead") {
      throw new Error("UnknownError");
    }
    const node = {
      type: "Quantifier",
      parent,
      start: element.start,
      end,
      raw: this.source.slice(element.start, end),
      min,
      max,
      greedy,
      element
    };
    parent.elements.push(node);
    element.parent = node;
  }
  onLookaroundAssertionEnter(start, kind, negate) {
    const parent = this._node;
    if (parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    const node = this._node = {
      type: "Assertion",
      parent,
      start,
      end: start,
      raw: "",
      kind,
      negate,
      alternatives: []
    };
    parent.elements.push(node);
  }
  onLookaroundAssertionLeave(start, end) {
    const node = this._node;
    if (node.type !== "Assertion" || node.parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    node.end = end;
    node.raw = this.source.slice(start, end);
    this._node = node.parent;
  }
  onEdgeAssertion(start, end, kind) {
    const parent = this._node;
    if (parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    parent.elements.push({
      type: "Assertion",
      parent,
      start,
      end,
      raw: this.source.slice(start, end),
      kind
    });
  }
  onWordBoundaryAssertion(start, end, kind, negate) {
    const parent = this._node;
    if (parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    parent.elements.push({
      type: "Assertion",
      parent,
      start,
      end,
      raw: this.source.slice(start, end),
      kind,
      negate
    });
  }
  onAnyCharacterSet(start, end, kind) {
    const parent = this._node;
    if (parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    parent.elements.push({
      type: "CharacterSet",
      parent,
      start,
      end,
      raw: this.source.slice(start, end),
      kind
    });
  }
  onEscapeCharacterSet(start, end, kind, negate) {
    const parent = this._node;
    if (parent.type !== "Alternative" && parent.type !== "CharacterClass") {
      throw new Error("UnknownError");
    }
    parent.elements.push({
      type: "CharacterSet",
      parent,
      start,
      end,
      raw: this.source.slice(start, end),
      kind,
      negate
    });
  }
  onUnicodePropertyCharacterSet(start, end, kind, key, value, negate) {
    const parent = this._node;
    if (parent.type !== "Alternative" && parent.type !== "CharacterClass") {
      throw new Error("UnknownError");
    }
    parent.elements.push({
      type: "CharacterSet",
      parent,
      start,
      end,
      raw: this.source.slice(start, end),
      kind,
      key,
      value,
      negate
    });
  }
  onCharacter(start, end, value) {
    const parent = this._node;
    if (parent.type !== "Alternative" && parent.type !== "CharacterClass") {
      throw new Error("UnknownError");
    }
    parent.elements.push({
      type: "Character",
      parent,
      start,
      end,
      raw: this.source.slice(start, end),
      value
    });
  }
  onBackreference(start, end, ref) {
    const parent = this._node;
    if (parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    const node = {
      type: "Backreference",
      parent,
      start,
      end,
      raw: this.source.slice(start, end),
      ref,
      resolved: DummyCapturingGroup
    };
    parent.elements.push(node);
    this._backreferences.push(node);
  }
  onCharacterClassEnter(start, negate) {
    const parent = this._node;
    if (parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    this._node = {
      type: "CharacterClass",
      parent,
      start,
      end: start,
      raw: "",
      negate,
      elements: []
    };
    parent.elements.push(this._node);
  }
  onCharacterClassLeave(start, end) {
    const node = this._node;
    if (node.type !== "CharacterClass" || node.parent.type !== "Alternative") {
      throw new Error("UnknownError");
    }
    node.end = end;
    node.raw = this.source.slice(start, end);
    this._node = node.parent;
  }
  onCharacterClassRange(start, end) {
    const parent = this._node;
    if (parent.type !== "CharacterClass") {
      throw new Error("UnknownError");
    }
    const elements = parent.elements;
    const max = elements.pop();
    const hyphen = elements.pop();
    const min = elements.pop();
    if (!min || !max || !hyphen || min.type !== "Character" || max.type !== "Character" || hyphen.type !== "Character" || hyphen.value !== HyphenMinus) {
      throw new Error("UnknownError");
    }
    const node = {
      type: "CharacterClassRange",
      parent,
      start,
      end,
      raw: this.source.slice(start, end),
      min,
      max
    };
    min.parent = node;
    max.parent = node;
    elements.push(node);
  }
};
var RegExpParser = class {
  constructor(options) {
    this._state = new RegExpParserState(options);
    this._validator = new RegExpValidator(this._state);
  }
  parseLiteral(source, start = 0, end = source.length) {
    this._state.source = source;
    this._validator.validateLiteral(source, start, end);
    const pattern = this._state.pattern;
    const flags = this._state.flags;
    const literal = {
      type: "RegExpLiteral",
      parent: null,
      start,
      end,
      raw: source,
      pattern,
      flags
    };
    pattern.parent = literal;
    flags.parent = literal;
    return literal;
  }
  parseFlags(source, start = 0, end = source.length) {
    this._state.source = source;
    this._validator.validateFlags(source, start, end);
    return this._state.flags;
  }
  parsePattern(source, start = 0, end = source.length, uFlag = false) {
    this._state.source = source;
    this._validator.validatePattern(source, start, end, uFlag);
    return this._state.pattern;
  }
};
function parseRegExpLiteral(source, options) {
  return new RegExpParser(options).parseLiteral(String(source));
}

// ../regexp.js
function prefixesFromParse(parse) {
  if (parse.type === "Pattern" || parse.type === "CapturingGroup") {
    const alternatives = parse.alternatives.map(prefixesFromParse);
    return `(${alternatives.join("|")})`;
  } else if (parse.type === "Alternative") {
    const result = [];
    for (let i = 0; i < parse.elements.length; ++i) {
      const thisRe = [];
      for (let j = 0; j < i; ++j) {
        thisRe.push(parse.elements[j].raw);
      }
      thisRe.push(prefixesFromParse(parse.elements[i]));
      result.push(thisRe.join(""));
    }
    return `(${result.join("|")})`;
  } else if (parse.type === "RegExpLiteral") {
    return prefixesFromParse(parse.pattern);
  } else if (parse.type === "Character") {
    return `${parse.raw}?`;
  } else if (parse.type === "Quantifier") {
    if (parse.min === 0 && parse.max === 1) {
      return prefixesFromParse(parse.element);
    }
    if (parse.min === 1 && parse.max === Infinity) {
      return `(${parse.element.raw}*)` + prefixesFromParse(parse.element);
    }
    if (parse.min === 0 && parse.max === Infinity) {
      return `(${parse.element.raw}*)` + prefixesFromParse(parse.element);
    } else {
      throw new Error(`Internal Error, can't handle quantifiers min=${parse.min} max=${parse.max}`);
    }
  } else if (parse.type === "CharacterSet") {
    return `${parse.raw}?`;
  }
  throw new Error(`Internal Error, don't know how to handle ${parse.type}`);
}
function prefixes(regexp) {
  regexp = regexp.source;
  regexp = regexp.slice(1, -1);
  return new RegExp("^" + prefixesFromParse(parseRegExpLiteral(new RegExp(regexp))) + "$");
}

// ../yaml-validation/schema-utils.ts
var _schemas = {
  schemas: {
    "front-matter": void 0,
    config: void 0,
    engines: void 0
  },
  aliases: {},
  definitions: {}
};
function setSchemas(schemas) {
  _schemas = schemas;
}
function getSchemas() {
  if (_schemas) {
    return _schemas;
  } else {
    throw new Error("Internal error: schemas not set");
  }
}
function matchPatternProperties(schema, key) {
  for (const [regexpStr, subschema] of Object.entries(schema.patternProperties || {})) {
    const prefixPattern = prefixes(new RegExp(regexpStr));
    if (key.match(prefixPattern)) {
      return subschema;
    }
  }
  return false;
}
function navigateSchema(schema, path) {
  const inner = (subSchema, index) => {
    subSchema = resolveSchema(subSchema);
    if (index === path.length) {
      return [subSchema];
    }
    const st = schemaType(subSchema);
    if (st === "object") {
      const key = path[index];
      if (subSchema.properties && subSchema.properties[key]) {
        return inner(subSchema.properties[key], index + 1);
      }
      const patternPropMatch = matchPatternProperties(subSchema, key);
      if (patternPropMatch) {
        return inner(patternPropMatch, index + 1);
      }
      if (index !== path.length - 1) {
        return [];
      }
      const completions2 = Object.getOwnPropertyNames(subSchema.properties || {}).filter((name) => name.startsWith(key));
      if (completions2.length === 0) {
        return [];
      }
      return [subSchema];
    } else if (st === "array") {
      if (subSchema.items === void 0) {
        return [];
      }
      return inner(subSchema.items, index + 1);
    } else if (st === "anyOf") {
      return subSchema.anyOf.map((ss) => inner(ss, index));
    } else if (st === "allOf") {
      return subSchema.allOf.map((ss) => inner(ss, index));
    } else if (st === "oneOf") {
      return subSchema.oneOf.map((ss) => inner(ss, index));
    } else {
      return [];
    }
  };
  return inner(schema, 0).flat(Infinity);
}
function navigateSchemaSingle(schema, path) {
  const ensurePathFragment = (fragment, expected) => {
    if (fragment !== expected) {
      throw new Error(`Internal Error in navigateSchemaSingle: ${fragment} !== ${expected}`);
    }
  };
  const inner = (subschema, index) => {
    if (subschema === void 0) {
      throw new Error(`Internal Error in navigateSchemaSingle: invalid path navigation`);
    }
    if (index === path.length) {
      return subschema;
    }
    const st = schemaType(subschema);
    switch (st) {
      case "anyOf":
        ensurePathFragment(path[index], "anyOf");
        return inner(subschema.anyOf[path[index + 1]], index + 2);
      case "allOf":
        ensurePathFragment(path[index], "allOf");
        return inner(subschema.allOf[path[index + 1]], index + 2);
      case "oneOf":
        ensurePathFragment(path[index], "oneOf");
        return inner(subschema.oneOf[path[index + 1]], index + 2);
      case "arrayOf":
        ensurePathFragment(path[index], "arrayOf");
        return inner(subschema.arrayOf.schema, index + 2);
      case "object":
        ensurePathFragment(path[index], "object");
        if (path[index + 1] === "properties") {
          return inner(subschema.properties[path[index + 2]], index + 3);
        } else if (path[index + 1] === "patternProperties") {
          return inner(subschema.patternProperties[path[index + 2]], index + 3);
        } else if (path[index + 1] === "additionalProperties") {
          return inner(subschema.additionalProperties, index + 2);
        } else {
          throw new Error(`Internal Error in navigateSchemaSingle: bad path fragment ${path[index]} in object navigation`);
        }
      default:
        throw new Error(`Internal Error in navigateSchemaSingle: can't navigate schema type ${st}`);
    }
  };
}
function resolveDescription(s) {
  if (typeof s === "string") {
    return s;
  }
  const valueS = resolveSchema(s.$ref);
  if (valueS.documentation) {
    if (valueS.documentation.short) {
      return valueS.documentation.short;
    } else {
      return valueS.documentation;
    }
  } else {
    return "";
  }
}
function resolveSchema(schema, visit, hasRef, next) {
  if (hasRef === void 0) {
    hasRef = (cursor) => {
      return cursor.$ref !== void 0;
    };
  }
  if (!hasRef(schema)) {
    return schema;
  }
  if (visit === void 0) {
    visit = (schema2) => {
    };
  }
  if (next === void 0) {
    next = (cursor) => {
      const result = getSchemaDefinition(cursor.$ref);
      if (result === void 0) {
        throw new Error(`Internal Error: ref ${cursor.$ref} not in definitions`);
      }
      return result;
    };
  }
  let cursor1 = schema;
  let cursor2 = schema;
  let stopped = false;
  do {
    cursor1 = next(cursor1);
    visit(cursor1);
    if (hasRef(cursor2)) {
      cursor2 = next(cursor2);
    } else {
      stopped = true;
    }
    if (hasRef(cursor2)) {
      cursor2 = next(cursor2);
    } else {
      stopped = true;
    }
    if (!stopped && cursor1 === cursor2) {
      throw new Error(`reference cycle detected at ${JSON.stringify(cursor1)}`);
    }
  } while (hasRef(cursor1));
  return cursor1;
}
function schemaCompletions(schema) {
  schema = resolveSchema(schema);
  schema = resolveSchema(schema, (schema2) => {
  }, (schema2) => {
    return schema2.tags && schema2.tags["complete-from"];
  }, (schema2) => {
    return navigateSchemaSingle(schema2, schema2.tags["complete-from"]);
  });
  const normalize = (completions2) => {
    const result = (completions2 || []).map((c) => {
      if (typeof c === "string") {
        return {
          type: "value",
          display: c,
          value: c,
          description: "",
          suggest_on_accept: false,
          schema
        };
      }
      return {
        ...c,
        description: resolveDescription(c.description),
        schema
      };
    });
    return result;
  };
  if (schema.completions && schema.completions.length) {
    return normalize(schema.completions);
  }
  switch (schemaType(schema)) {
    case "array":
      if (schema.items) {
        return schemaCompletions(schema.items);
      } else {
        return [];
      }
    case "anyOf":
      return schema.anyOf.map(schemaCompletions).flat();
    case "oneOf":
      return schema.oneOf.map(schemaCompletions).flat();
    case "allOf":
      return schema.allOf.map(schemaCompletions).flat();
    default:
      return [];
  }
}

// ../yaml-validation/validator.ts
function validateBoolean(value, _schema) {
  return typeof value === "boolean";
}
function validateNumber(value, _schema) {
  return typeof value === "number";
}
function validateString(value, schema) {
  if (typeof value !== "string") {
    return false;
  }
  if (schema.pattern === void 0) {
    return true;
  }
  if (value.match(new RegExp(schema.pattern))) {
    return true;
  } else {
    return false;
  }
}
function validateNull(value, _schema) {
  return value === null;
}
function validateEnum(value, schema) {
  return schema["enum"].indexOf(value) !== -1;
}
function validateOneOf(value, schema) {
  let count = 0;
  for (const subSchema of schema.oneOf) {
    if (validate(value, subSchema)) {
      count += 1;
      if (count > 1) {
        return false;
      }
    }
  }
  return count === 1;
}
function validateAnyOf(value, schema) {
  for (const subSchema of schema.anyOf) {
    if (validate(value, subSchema)) {
      return true;
    }
  }
  return false;
}
function validateAllOf(value, schema) {
  for (const subSchema of schema.allOf) {
    if (!validate(value, subSchema)) {
      return false;
    }
  }
  return true;
}
function validateObject(value, schema) {
  if (typeof value !== "object" || Array.isArray(value) || value === null) {
    return false;
  }
  const inspectedProps = new Set();
  const ownProperties = new Set(Object.getOwnPropertyNames(value));
  if (schema.properties) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (ownProperties.has(key) && !validate(value[key], subSchema)) {
        return false;
      } else {
        inspectedProps.add(key);
      }
    }
  }
  if (schema.patternProperties) {
    for (const [key, subSchema] of Object.entries(schema.patternProperties)) {
      const regexp = new RegExp(key);
      for (const [objectKey, val] of Object.entries(value)) {
        if (objectKey.match(regexp) && !validate(val, subSchema)) {
          return false;
        } else {
          inspectedProps.add(objectKey);
        }
      }
    }
  }
  if (schema.additionalProperties) {
    for (const [objectKey, val] of Object.entries(value)) {
      if (inspectedProps.has(objectKey)) {
        continue;
      }
      if (!validate(val, schema.additionalProperties)) {
        return false;
      }
    }
  }
  for (const reqKey of schema.required || []) {
    if (value[reqKey] === void 0) {
      return false;
    }
  }
  return true;
}
function validateArray(value, schema) {
  if (!Array.isArray(value)) {
    return false;
  }
  if (schema.items) {
    return value.every((entry) => validate(entry, schema.items));
  }
  return true;
}
function validate(value, schema) {
  if (schema === false) {
    return false;
  }
  if (schema === true) {
    return true;
  }
  const validators = {
    "boolean": validateBoolean,
    "number": validateNumber,
    "string": validateString,
    "null": validateNull,
    "enum": validateEnum,
    "oneOf": validateOneOf,
    "anyOf": validateAnyOf,
    "allOf": validateAllOf,
    "object": validateObject,
    "array": validateArray
  };
  schema = resolveSchema(schema);
  if (validators[schemaType(schema)]) {
    return validators[schemaType(schema)](value, schema);
  } else {
    throw new Error(`Don't know how to validate ${schema.type}`);
  }
}

// ../yaml-validation/staged-validator.ts
var _module = void 0;
var validatorModulePath = "";
async function ensureValidatorModule() {
  if (_module) {
    return _module;
  }
  if (validatorModulePath === "") {
    throw new Error("Internal Error: validator module path is not set");
  }
  const path = new URL(validatorModulePath, import.meta.url).href;
  const _mod = await import(path);
  _module = _mod.default;
  return _module;
}
function setValidatorModulePath(path) {
  validatorModulePath = path;
}
function stagedValidator(schema) {
  schema = resolveSchema(schema);
  return async (value) => {
    if (validate(value, schema)) {
      return [];
    }
    await ensureValidatorModule();
    const validator = _module[schema.$id];
    if (validator(value)) {
      throw new Error(`Internal error: validators disagree on schema ${schema.$id}`);
    }
    return JSON.parse(JSON.stringify(validator.errors));
  };
}

// ../guess-chunk-options-format.ts
function guessChunkOptionsFormat(options) {
  const noIndentOrColon = /^[^:\s]+[^:]+$/;
  const chunkLines = lines(options);
  if (chunkLines.filter((l) => l.match(noIndentOrColon)).length === 0) {
    return "yaml";
  }
  if (chunkLines.some((l) => l.trim() !== "" && !l.trimRight().endsWith(",") && l.indexOf("=") === -1)) {
    return "yaml";
  }
  return "knitr";
}

// ../partition-cell-options.ts
function mappedSource(source, substrs) {
  const params = [];
  for (const { range } of substrs) {
    params.push(range);
  }
  return mappedString(source, params);
}
async function partitionCellOptionsMapped(language, source, _validate = false, _engine = "") {
  const commentChars = langCommentChars(language);
  const optionPrefix = optionCommentPrefix(commentChars[0]);
  const optionSuffix = commentChars[1] || "";
  const optionsSource = [];
  const yamlLines = [];
  let endOfYaml = 0;
  for (const line of rangedLines(source.value, true)) {
    if (line.substring.startsWith(optionPrefix)) {
      if (!optionSuffix || line.substring.trimRight().endsWith(optionSuffix)) {
        let yamlOption = line.substring.substring(optionPrefix.length);
        if (optionSuffix) {
          yamlOption = yamlOption.trimRight();
          yamlOption = yamlOption.substring(0, yamlOption.length - optionSuffix.length);
        }
        endOfYaml = line.range.start + optionPrefix.length + yamlOption.length - optionSuffix.length;
        const rangedYamlOption = {
          substring: yamlOption,
          range: {
            start: line.range.start + optionPrefix.length,
            end: endOfYaml
          }
        };
        yamlLines.push(rangedYamlOption);
        optionsSource.push(line);
        continue;
      }
    }
    break;
  }
  const mappedYaml = yamlLines.length ? mappedSource(source, yamlLines) : void 0;
  return {
    yaml: mappedYaml,
    optionsSource,
    source: mappedString(source, [{
      start: endOfYaml,
      end: source.value.length
    }]),
    sourceStartLine: yamlLines.length
  };
}
function langCommentChars(lang) {
  const chars = kLangCommentChars[lang] || "#";
  if (!Array.isArray(chars)) {
    return [chars];
  } else {
    return chars;
  }
}
function optionCommentPrefix(comment) {
  return comment + "| ";
}
var kLangCommentChars = {
  r: "#",
  python: "#",
  julia: "#",
  scala: "//",
  matlab: "%",
  csharp: "//",
  fsharp: "//",
  c: ["/*", "*/"],
  css: ["/*", "*/"],
  sas: ["*", ";"],
  powershell: "#",
  bash: "#",
  sql: "--",
  mysql: "--",
  psql: "--",
  lua: "--",
  cpp: "//",
  cc: "//",
  stan: "#",
  octave: "#",
  fortran: "!",
  fortran95: "!",
  awk: "#",
  gawk: "#",
  stata: "*",
  java: "//",
  groovy: "//",
  sed: "#",
  perl: "#",
  ruby: "#",
  tikz: "%",
  js: "//",
  d3: "//",
  node: "//",
  sass: "//",
  coffee: "#",
  go: "//",
  asy: "//",
  haskell: "--",
  dot: "//",
  ojs: "//"
};

// ../break-quarto-md.ts
async function breakQuartoMd(src, validate2 = false) {
  const nb = {
    cells: []
  };
  const yamlRegEx = /^---\s*$/;
  const startCodeCellRegEx = new RegExp("^\\s*```+\\s*\\{([=A-Za-z]+)( *[ ,].*)?\\}\\s*$");
  const startCodeRegEx = /^```/;
  const endCodeRegEx = /^```\s*$/;
  const delimitMathBlockRegEx = /^\$\$/;
  let language = "";
  let cellStartLine = 0;
  const lineBuffer = [];
  const flushLineBuffer = async (cell_type, index) => {
    if (lineBuffer.length) {
      const mappedChunks = [];
      for (const line of lineBuffer) {
        mappedChunks.push(line.range);
      }
      const source = mappedString(src, mappedChunks);
      const cell = {
        cell_type: cell_type === "code" ? { language } : cell_type,
        source,
        sourceOffset: 0,
        sourceStartLine: 0,
        sourceVerbatim: source,
        cellStartLine
      };
      cellStartLine = index + 1;
      if (cell_type === "code" && (language === "ojs" || language === "dot")) {
        const { yaml, source: source2, sourceStartLine } = await partitionCellOptionsMapped(language, cell.source, validate2);
        const breaks = Array.from(lineOffsets(cell.source.value)).slice(1);
        let strUpToLastBreak = "";
        if (sourceStartLine > 0) {
          if (breaks.length) {
            const lastBreak = breaks[Math.min(sourceStartLine - 1, breaks.length - 1)];
            strUpToLastBreak = cell.source.value.substring(0, lastBreak);
          } else {
            strUpToLastBreak = cell.source.value;
          }
        }
        cell.sourceOffset = strUpToLastBreak.length + "```{ojs}\n".length;
        cell.sourceVerbatim = mappedString(cell.sourceVerbatim, [
          "```{ojs}\n",
          { start: 0, end: cell.sourceVerbatim.value.length },
          "\n```"
        ]);
        cell.source = source2;
        cell.options = yaml;
        cell.sourceStartLine = sourceStartLine;
      }
      if (mdTrimEmptyLines(lines(cell.source.value)).length > 0) {
        nb.cells.push(cell);
      }
      lineBuffer.splice(0, lineBuffer.length);
    }
  };
  let inYaml = false, inMathBlock = false, inCodeCell = false, inCode = false;
  const srcLines = rangedLines(src.value, true);
  for (let i = 0; i < srcLines.length; ++i) {
    const line = srcLines[i];
    if (yamlRegEx.test(line.substring) && !inCodeCell && !inCode && !inMathBlock) {
      if (inYaml) {
        lineBuffer.push(line);
        await flushLineBuffer("raw", i);
        inYaml = false;
      } else {
        await flushLineBuffer("markdown", i);
        lineBuffer.push(line);
        inYaml = true;
      }
    } else if (startCodeCellRegEx.test(line.substring)) {
      const m = line.substring.match(startCodeCellRegEx);
      language = m[1];
      await flushLineBuffer("markdown", i);
      inCodeCell = true;
    } else if (endCodeRegEx.test(line.substring)) {
      if (inCodeCell) {
        inCodeCell = false;
        await flushLineBuffer("code", i);
      } else {
        inCode = !inCode;
        lineBuffer.push(line);
      }
    } else if (startCodeRegEx.test(line.substring)) {
      inCode = true;
      lineBuffer.push(line);
    } else if (delimitMathBlockRegEx.test(line.substring)) {
      if (inMathBlock) {
        await flushLineBuffer("math", i);
      } else {
        if (inYaml || inCode || inCodeCell) {
        } else {
          await flushLineBuffer("markdown", i);
        }
      }
      inMathBlock = !inMathBlock;
      lineBuffer.push(line);
    } else {
      lineBuffer.push(line);
    }
  }
  await flushLineBuffer("markdown", srcLines.length);
  return nb;
}
function mdTrimEmptyLines(lines2) {
  const firstNonEmpty = lines2.findIndex((line) => line.trim().length > 0);
  if (firstNonEmpty === -1) {
    return [];
  }
  lines2 = lines2.slice(firstNonEmpty);
  let lastNonEmpty = -1;
  for (let i = lines2.length - 1; i >= 0; i--) {
    if (lines2[i].trim().length > 0) {
      lastNonEmpty = i;
      break;
    }
  }
  if (lastNonEmpty > -1) {
    lines2 = lines2.slice(0, lastNonEmpty + 1);
  }
  return lines2;
}

// ../yaml-validation/yaml-schema.ts
function getVerbatimInput(error) {
  return error.source.value.substring(error.violatingObject.start, error.violatingObject.end);
}
function navigate(path, annotation, returnKey = false, pathIndex = 0) {
  if (annotation === void 0) {
    throw new Error("Can't navigate an undefined annotation");
  }
  if (pathIndex >= path.length) {
    return annotation;
  }
  if (annotation.kind === "mapping" || annotation.kind === "block_mapping") {
    const { components } = annotation;
    const searchKey = path[pathIndex];
    const lastKeyIndex = ~~((components.length - 1) / 2) * 2;
    for (let i = lastKeyIndex; i >= 0; i -= 2) {
      const key = components[i].result;
      if (key === searchKey) {
        if (returnKey && pathIndex === path.length - 1) {
          return navigate(path, components[i], returnKey, pathIndex + 1);
        } else {
          return navigate(path, components[i + 1], returnKey, pathIndex + 1);
        }
      }
    }
    throw new Error(`Internal error: searchKey ${searchKey} (path: ${path}) not found in mapping object`);
  } else if (["sequence", "block_sequence", "flow_sequence"].indexOf(annotation.kind) !== -1) {
    const searchKey = Number(path[pathIndex]);
    return navigate(path, annotation.components[searchKey], returnKey, pathIndex + 1);
  } else {
    throw new Error(`Internal error: unexpected kind ${annotation.kind}`);
  }
}
function navigateSchema2(path, schema, pathIndex = 0) {
  if (schema.$ref) {
    schema = getSchemaDefinition(schema.$ref);
  }
  if (pathIndex >= path.length - 1) {
    return [schema];
  }
  const pathVal = path[pathIndex];
  if (schema.allOf !== void 0) {
    return schema.allOf.map((s) => navigateSchema2(path, s, pathIndex)).flat();
  } else if (pathVal === "patternProperties" && schema.patternProperties) {
    const key = path[pathIndex + 1];
    const subSchema = schema.patternProperties[key];
    return navigateSchema2(path, subSchema, pathIndex + 2);
  } else if (pathVal === "properties" && schema.properties) {
    const key = path[pathIndex + 1];
    const subSchema = schema.properties[key];
    return navigateSchema2(path, subSchema, pathIndex + 2);
  } else if (pathVal === "anyOf" && schema.anyOf) {
    const key = Number(path[pathIndex + 1]);
    const subSchema = schema.anyOf[key];
    return navigateSchema2(path, subSchema, pathIndex + 2);
  } else if (pathVal === "oneOf" && schema.oneOf) {
    const key = Number(path[pathIndex + 1]);
    const subSchema = schema.oneOf[key];
    return navigateSchema2(path, subSchema, pathIndex + 2);
  } else if (pathVal === "items" && schema.items) {
    const subSchema = schema.items;
    return navigateSchema2(path, subSchema, pathIndex + 1);
  } else {
    return [];
  }
}
function isProperPrefix(a, b) {
  return b.length > a.length && b.substring(0, a.length) === a;
}
function groupBy(lst, f) {
  const record = {};
  const result = [];
  for (const el of lst) {
    const key = f(el);
    if (record[key] === void 0) {
      const lst2 = [];
      const entry = {
        key,
        values: lst2
      };
      record[key] = lst2;
      result.push(entry);
    }
    record[key].push(el);
  }
  return result;
}
function groupByEntries(entries) {
  const result = [];
  for (const { values } of entries) {
    result.push(...values);
  }
  return result;
}
function narrowOneOfError(oneOf, suberrors) {
  const subschemaErrors = groupBy(suberrors.filter((error) => error.schemaPath !== oneOf.schemaPath), (error) => error.schemaPath.substring(0, error.schemaPath.lastIndexOf("/")));
  const onlyAdditionalProperties = subschemaErrors.filter(({ values }) => values.every((v) => v.keyword === "additionalProperties"));
  if (onlyAdditionalProperties.length) {
    return onlyAdditionalProperties[0].values;
  }
  return [];
}
function localizeAndPruneErrors(annotation, validationErrors, source, schema) {
  const result = [];
  const locF = mappedIndexToRowCol(source);
  let errorsPerInstanceList = groupBy(validationErrors, (error) => error.instancePath);
  do {
    const newErrors = [];
    errorsPerInstanceList = errorsPerInstanceList.filter(({ key: pathA }) => errorsPerInstanceList.filter(({ key: pathB }) => isProperPrefix(pathA, pathB)).length === 0);
    for (const { key: instancePath, values: errors } of errorsPerInstanceList) {
      let errorsPerSchemaList = groupBy(errors, (error) => error.schemaPath);
      errorsPerSchemaList = errorsPerSchemaList.filter(({ key: pathA }) => errorsPerSchemaList.filter(({ key: pathB }) => isProperPrefix(pathB, pathA)).length === 0);
      for (const error of groupByEntries(errorsPerSchemaList)) {
        if (error.hasBeenTransformed) {
          continue;
        }
        if (error.keyword === "oneOf") {
          error.hasBeenTransformed = true;
          newErrors.push(...narrowOneOfError(error, errors));
        } else if (error.keyword === "additionalProperties") {
          error.hasBeenTransformed = true;
          newErrors.push({
            ...error,
            instancePath: `${instancePath}/${error.params.additionalProperty}`,
            keyword: "_custom_invalidProperty",
            message: `property ${error.params.additionalProperty} not allowed in object`,
            params: {
              ...error.params,
              originalError: error
            },
            schemaPath: error.schemaPath.slice(0, -21)
          });
        }
      }
    }
    if (newErrors.length) {
      errorsPerInstanceList.push(...groupBy(newErrors, (error) => error.instancePath));
    } else {
      break;
    }
  } while (true);
  for (const { key: instancePath, values: allErrors } of errorsPerInstanceList) {
    const path = instancePath.split("/").slice(1);
    const errors = allErrors.filter(({ schemaPath: pathA }) => !(allErrors.filter(({ schemaPath: pathB }) => isProperPrefix(pathB, pathA)).length > 0));
    for (const error of errors) {
      const returnKey = error.keyword === "_custom_invalidProperty";
      const violatingObject = navigate(path, annotation, returnKey);
      const schemaPath = error.schemaPath.split("/").slice(1);
      let start = { line: 0, column: 0 };
      let end = { line: 0, column: 0 };
      if (source.value.length) {
        start = locF(violatingObject.start);
        end = locF(violatingObject.end);
      }
      let niceError = {
        heading: "",
        error: [],
        info: [],
        location: { start, end }
      };
      if (error.keyword.startsWith("_custom_")) {
        niceError = {
          ...niceError,
          heading: error.message === void 0 ? "" : error.message
        };
      } else {
        if (instancePath === "") {
          niceError = {
            ...niceError,
            heading: `(top-level error) ${error.message}`
          };
        } else {
          const errorSchema = error.params && error.params.schema || error.parentSchema;
          const innerSchema = errorSchema ? [errorSchema] : navigateSchema2(schemaPath.map(decodeURIComponent), schema);
          if (innerSchema.length === 0) {
            niceError = {
              ...niceError,
              heading: `Schema ${schemaPath}: ${error.message}`
            };
          } else {
            const rawVerbatimInput = source.value.substring(violatingObject.start, violatingObject.end);
            if (rawVerbatimInput.length === 0) {
              niceError = {
                ...niceError,
                heading: `Empty value found where it must instead ${innerSchema.map((s) => s.description).join(", ")}.`
              };
            } else {
              const verbatimInput = quotedStringColor(source.value.substring(violatingObject.start, violatingObject.end));
              niceError = {
                ...niceError,
                heading: `The value ${verbatimInput} must ${innerSchema.map((s) => s.description).join(", ")}.`
              };
            }
          }
        }
      }
      niceError.location = { start, end };
      addFileInfo(niceError, source);
      addInstancePathInfo(niceError, instancePath);
      result.push({
        instancePath,
        message: error.message === void 0 ? "" : error.message,
        violatingObject,
        location: { start, end },
        source,
        ajvError: error,
        niceError
      });
    }
  }
  result.sort((a, b) => a.violatingObject.start - b.violatingObject.start);
  return result;
}
var YAMLSchema = class {
  constructor(schema) {
    this.errorHandlers = [];
    this.schema = schema;
    this.validate = stagedValidator(this.schema);
  }
  addHandler(handler) {
    this.errorHandlers.push(handler);
  }
  transformErrors(annotation, errors) {
    return errors.map((error) => {
      for (const handler of this.errorHandlers) {
        error = handler(error, annotation, this.schema);
      }
      return error;
    });
  }
  async validateParse(src, annotation) {
    const validationErrors = await this.validate(annotation.result);
    if (validationErrors.length) {
      const localizedErrors = this.transformErrors(annotation, localizeAndPruneErrors(annotation, validationErrors, src, this.schema));
      return {
        result: annotation.result,
        errors: localizedErrors
      };
    } else {
      return {
        result: annotation.result,
        errors: []
      };
    }
  }
  reportErrorsInSource(result, src, message, error, log) {
    if (result.errors.length) {
      const locF = mappedIndexToRowCol(src);
      const nLines = lines(src.originalString).length;
      error(message);
      for (const err of result.errors) {
        let startO = err.violatingObject.start;
        let endO = err.violatingObject.end;
        while (src.mapClosest(startO) < src.originalString.length - 1 && src.originalString[src.mapClosest(startO)].match(/\s/)) {
          startO++;
        }
        while (src.mapClosest(endO) > src.mapClosest(startO) && src.originalString[src.mapClosest(endO)].match(/\s/)) {
          endO--;
        }
        const start = locF(startO);
        const end = locF(endO);
        const {
          prefixWidth,
          lines: lines2
        } = formatLineRange(src.originalString, Math.max(0, start.line - 1), Math.min(end.line + 1, nLines - 1));
        const contextLines = [];
        for (const { lineNumber, content, rawLine } of lines2) {
          contextLines.push(content);
          if (lineNumber >= start.line && lineNumber <= end.line) {
            const startColumn = lineNumber > start.line ? 0 : start.column;
            const endColumn = lineNumber < end.line ? rawLine.length : end.column;
            contextLines.push(" ".repeat(prefixWidth + startColumn) + blue("~".repeat(endColumn - startColumn + 1)));
          }
        }
        err.niceError.sourceContext = contextLines.join("\n");
        log(tidyverseFormatError(err.niceError));
      }
    }
    return result;
  }
  async validateParseWithErrors(src, annotation, message, error, log) {
    const result = await this.validateParse(src, annotation);
    this.reportErrorsInSource(result, src, message, error, log);
    return result;
  }
};

// ../promise.ts
var PromiseQueue = class {
  constructor() {
    this.queue = new Array();
    this.running = false;
  }
  enqueue(promise, clearPending = false) {
    return new Promise((resolve, reject) => {
      if (clearPending) {
        this.queue.splice(0, this.queue.length);
      }
      this.queue.push({
        promise,
        resolve,
        reject
      });
      this.dequeue();
    });
  }
  dequeue() {
    if (this.running) {
      return false;
    }
    const item = this.queue.shift();
    if (!item) {
      return false;
    }
    try {
      this.running = true;
      item.promise().then((value) => {
        this.running = false;
        item.resolve(value);
        this.dequeue();
      }).catch((err) => {
        this.running = false;
        item.reject(err);
        this.dequeue();
      });
    } catch (err) {
      this.running = false;
      item.reject(err);
      this.dequeue();
    }
    return true;
  }
};

// ../yaml-validation/validator-queue.ts
var yamlValidators = {};
var validatorQueues = {};
function checkForTypeMismatch(error, _parse, _schema) {
  const verbatimInput = quotedStringColor(getVerbatimInput(error));
  if (error.ajvError.keyword === "type") {
    const newError = {
      heading: `The value ${verbatimInput} must be a ${error.ajvError.params.type}.`,
      error: [
        `The value ${verbatimInput} is a ${typeof error.violatingObject.result}.`
      ],
      info: [],
      location: error.niceError.location
    };
    addInstancePathInfo(newError, error.ajvError.instancePath);
    addFileInfo(newError, error.source);
    return {
      ...error,
      niceError: newError
    };
  }
  return error;
}
function checkForBadBoolean(error, _parse, schema) {
  schema = error.ajvError.params.schema;
  if (!(typeof error.violatingObject.result === "string" && error.ajvError.keyword === "type" && (schema && schema.type === "boolean"))) {
    return error;
  }
  const strValue = error.violatingObject.result;
  const verbatimInput = quotedStringColor(getVerbatimInput(error));
  const yesses = new Set("y|Y|yes|Yes|YES|true|True|TRUE|on|On|ON".split("|"));
  const nos = new Set("n|N|no|No|NO|false|False|FALSE|off|Off|OFF".split("|"));
  let fix;
  if (yesses.has(strValue)) {
    fix = true;
  } else if (nos.has(strValue)) {
    fix = false;
  } else {
    return error;
  }
  const heading = `The value ${verbatimInput} must be a boolean`;
  const errorMessage = `The value ${verbatimInput} is a string.`;
  const suggestion1 = `Quarto uses YAML 1.2, which interprets booleans strictly.`;
  const suggestion2 = `Try using ${quotedStringColor(String(fix))} instead.`;
  const newError = {
    heading,
    error: [errorMessage],
    info: [],
    location: error.niceError.location
  };
  addInstancePathInfo(newError, error.ajvError.instancePath);
  addFileInfo(newError, error.source);
  newError.info.push(suggestion1, suggestion2);
  return {
    ...error,
    niceError: newError
  };
}
function getSchemaName(schema) {
  const schemaName = schema["$id"] || schema["$ref"];
  if (schemaName === void 0) {
    throw new Error("Expected schema to be named");
  }
  return schemaName;
}
function getValidator(schema) {
  const schemaName = getSchemaName(schema);
  if (yamlValidators[schemaName]) {
    return yamlValidators[schemaName];
  }
  const validator = new YAMLSchema(schema);
  yamlValidators[schemaName] = validator;
  validator.addHandler(checkForTypeMismatch);
  validator.addHandler(checkForBadBoolean);
  return validator;
}
async function withValidator(schema, fun) {
  const schemaName = getSchemaName(schema);
  if (validatorQueues[schemaName] === void 0) {
    validatorQueues[schemaName] = new PromiseQueue();
  }
  const queue = validatorQueues[schemaName];
  let result;
  let error;
  await queue.enqueue(async () => {
    try {
      const validator = getValidator(schema);
      result = await fun(validator);
    } catch (e) {
      error = e;
    }
  });
  if (error !== void 0) {
    throw error;
  }
  return result;
}

// yaml-intelligence.ts
function positionInTicks(context) {
  const code2 = asMappedString(context.code);
  const {
    position
  } = context;
  const codeLines = lines(code2.value);
  return code2.value.startsWith("---") && position.row === 0 || code2.value.trimEnd().endsWith("---") && position.row === codeLines.length - 1;
}
function trimTicks(context) {
  let code2 = asMappedString(context.code);
  if (code2.value.startsWith("---")) {
    code2 = mappedString(code2, [{ start: 3, end: code2.value.length }]);
    context = { ...context, code: code2 };
  }
  if (code2.value.trimEnd().endsWith("---")) {
    code2 = mappedString(code2, [{
      start: 0,
      end: code2.value.lastIndexOf("---")
    }]);
    context = { ...context, code: code2 };
  }
  return context;
}
async function validationFromGoodParseYAML(context) {
  const code2 = asMappedString(context.code);
  const result = await withValidator(context.schema, async (validator) => {
    const parser = await getTreeSitter();
    for (const parseResult of attemptParsesAtLine(context, parser) || []) {
      const lints = [];
      const {
        parse: tree,
        code: mappedCode
      } = parseResult;
      const annotation = buildAnnotated(tree, mappedCode);
      if (annotation === null) {
        continue;
      }
      const validationResult = await validator.validateParse(code2, annotation);
      for (const error of validationResult.errors) {
        let text;
        if (error.niceError && error.niceError.heading) {
          text = error.niceError.heading;
        } else {
          text = error.message;
        }
        lints.push({
          "start.row": error.location.start.line,
          "start.column": error.location.start.column,
          "end.row": error.location.end.line,
          "end.column": error.location.end.column,
          "text": text,
          "type": "error"
        });
      }
      return lints;
    }
    return [];
  });
  const predecessors = getYamlPredecessors(code2.value, context.position.row - 1);
  if (context.explicit === void 0) {
    return result;
  }
  if (!context.explicit) {
    return result.filter((lint) => predecessors.indexOf(lint["start.row"] - 1) === -1);
  } else {
    return result;
  }
}
async function completionsFromGoodParseYAML(context) {
  const {
    line,
    position,
    schema
  } = context;
  const commentPrefix = context.commentPrefix || "";
  const parser = await getTreeSitter();
  let word = "";
  if (line.slice(-1) !== ":" && line.trimLeft()[0] !== "-") {
    word = line.split(" ").slice(-1)[0];
  }
  if (line.trim().length === 0) {
    const path = locateFromIndentation(context);
    const indent2 = line.length;
    const rawCompletions = completions({
      schema,
      path,
      word,
      indent: indent2,
      commentPrefix,
      context
    });
    rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "key");
    return rawCompletions;
  }
  const indent = line.trimEnd().length - line.trim().length;
  const completeEmptyLineOnIndentation = (deletions, mappedCode) => {
    const path = locateFromIndentation({
      line: line.slice(0, -deletions),
      code: mappedCode.value,
      position: {
        row: position.row,
        column: position.column - deletions
      }
    });
    const rawCompletions = completions({
      schema,
      path,
      word,
      indent,
      commentPrefix,
      context
    });
    rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "key");
    return rawCompletions;
  };
  for (const parseResult of attemptParsesAtLine(context, parser)) {
    const {
      parse: tree,
      code: mappedCode,
      deletions
    } = parseResult;
    const lineAfterDeletions = line.substring(0, line.length - deletions);
    if (lineAfterDeletions.trim().length === 0) {
      const result = completeEmptyLineOnIndentation(deletions, mappedCode);
      return result;
    } else {
      const doc = buildAnnotated(tree, mappedCode);
      if (doc === null) {
        continue;
      }
      const index = rowColToIndex(mappedCode.value)({
        row: position.row,
        column: position.column - deletions
      });
      let { withError: locateFailed, value: maybePath } = locateCursor(doc, index);
      if (locateFailed) {
        if (lineAfterDeletions.trim().length === 0) {
          const result = await completeEmptyLineOnIndentation(deletions, mappedCode);
          return result;
        }
        maybePath = locateFromIndentation({
          line: lineAfterDeletions,
          code: mappedCode.value,
          position: {
            row: position.row,
            column: position.column - deletions
          }
        });
      }
      const path = maybePath;
      if (path[path.length - 1] === word) {
        path.pop();
      }
      const rawCompletions = completions({
        schema,
        path,
        word,
        indent,
        commentPrefix,
        context
      });
      if (line.indexOf(":") !== -1) {
        rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "value").map((completion) => ({ ...completion, suggest_on_accept: false }));
      } else if (line.indexOf("-") === -1) {
        rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "key");
      }
      return rawCompletions;
    }
  }
  return noCompletions;
}
var noCompletions = {
  token: "",
  completions: [],
  cacheable: false
};
function uniqBy(lst, keyFun) {
  const itemSet = new Set();
  return lst.filter((item) => {
    const key = keyFun(item);
    if (key === void 0) {
      return true;
    }
    if (itemSet.has(key)) {
      return false;
    }
    itemSet.add(key);
    return true;
  });
}
function dropCompletionsFromSchema(obj, completion) {
  const matchingSchema = resolveSchema(completion.schema);
  const {
    path
  } = obj;
  if (completion.type === "value") {
    return false;
  }
  const subPath = [completion.value.slice(0, -2)];
  const matchingSubSchemas = navigateSchema(matchingSchema, subPath);
  if (matchingSubSchemas.length === 0) {
    return false;
  }
  const executeOnly = matchingSubSchemas.every((s) => s.tags && s.tags["execute-only"]);
  if (path.length > 0 && path[0] === "execute") {
    return !executeOnly;
  } else {
    return executeOnly;
  }
}
function completions(obj) {
  const {
    schema,
    indent,
    commentPrefix,
    context
  } = obj;
  let word = obj.word;
  let path = obj.path;
  let matchingSchemas = uniqBy(navigateSchema(schema, path), (schema2) => schema2.$id);
  if (matchingSchemas.length === 0) {
    const candidateSchemas = uniqBy(navigateSchema(schema, path.slice(0, -1)), (schema2) => schema2.$id);
    if (candidateSchemas.length === 0) {
      return {
        token: word,
        completions: [],
        cacheable: true
      };
    } else {
      matchingSchemas = candidateSchemas;
      word = String(path[path.length - 1]);
      path = path.slice(0, -1);
      obj = {
        ...obj,
        word,
        path
      };
    }
  }
  const { aliases } = getSchemas();
  const formats = [
    ...Array.from(context.formats),
    ...Array.from(context.project_formats)
  ].filter((x) => aliases["pandoc-all"].indexOf(x) !== -1);
  let completions2 = matchingSchemas.map((schema2) => {
    const result = schemaCompletions(schema2);
    return result.filter((completion) => !dropCompletionsFromSchema(obj, completion)).map((completion) => {
      if (!completion.suggest_on_accept || completion.type === "value" || !schemaAccepts(completion.schema, "object")) {
        return completion;
      }
      const key = completion.value.split(":")[0];
      const matchingSubSchemas = navigateSchema(completion.schema, [key]);
      const canSuggestOnAccept = (ss) => {
        const matchingTypes = new Set();
        walkSchema(ss, (s) => {
          const t = schemaType(s);
          switch (t) {
            case "object":
              matchingTypes.add("object");
              return true;
            case "array":
              matchingTypes.add("array");
              return true;
            case "oneOf":
            case "anyOf":
            case "allOf":
              return false;
            default:
              matchingTypes.add("scalar");
          }
        });
        if (matchingTypes.size > 1) {
          return false;
        }
        ;
        let arraySubSchemas = [];
        walkSchema(ss, {
          "array": (s) => {
            arraySubSchemas.push(s);
            return true;
          },
          "object": (s) => true
        });
        return arraySubSchemas.every((s) => {
          if (s.items === void 0) {
            return true;
          } else {
            return canSuggestOnAccept(s.items);
          }
        });
      };
      if (!matchingSubSchemas.every((ss) => canSuggestOnAccept(ss))) {
        return {
          ...completion,
          suggest_on_accept: false,
          value: completion.value
        };
      }
      if (matchingSubSchemas.some((subSchema) => schemaAccepts(subSchema, "object"))) {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix + " ".repeat(indent + 2)
        };
      } else if (matchingSubSchemas.some((subSchema) => schemaAccepts(subSchema, "array"))) {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix + " ".repeat(indent + 2) + "- "
        };
      } else {
        return completion;
      }
    });
  }).flat().filter((c) => c.value.startsWith(word)).filter((c) => {
    if (c.type === "value") {
      return !(c.schema && c.schema.tags && c.schema.tags.hidden);
    } else if (c.type === "key") {
      const key = c.value.split(":")[0];
      const matchingSubSchemas = navigateSchema(c.schema, [key]);
      if (matchingSubSchemas.length === 0) {
        return true;
      }
      return !matchingSubSchemas.every((s) => s.tags && s.tags.hidden);
    } else {
      return true;
    }
  }).filter((c) => {
    if (formats.length === 0) {
      return true;
    }
    let formatTags = [];
    if (c.type === "key") {
      let value = c.schema.properties[c.display];
      if (value === void 0) {
        for (const key of Object.keys(c.schema.patternProperties)) {
          const regexp = new RegExp(key);
          if (c.display.match(regexp)) {
            value = c.schema.patternProperties[key];
            break;
          }
        }
      }
      if (value === void 0) {
        return true;
      }
      formatTags = value && value.tags && value.tags.formats || [];
    } else if (c.type === "value") {
      formatTags = c.schema && c.schema.tags && c.schema.tags.formats || [];
    } else {
      return false;
    }
    const enabled2 = formatTags.filter((tag) => !tag.startsWith("!"));
    const enabledSet = new Set();
    if (enabled2.length === 0) {
      for (const el of aliases["pandoc-all"]) {
        enabledSet.add(el);
      }
    } else {
      for (const tag of enabled2) {
        for (const el of expandAliasesFrom([tag], aliases)) {
          enabledSet.add(el);
        }
      }
    }
    for (let tag of formatTags.filter((tag2) => tag2.startsWith("!"))) {
      tag = tag.slice(1);
      for (const el of expandAliasesFrom([tag], aliases)) {
        enabledSet.delete(el);
      }
    }
    return formats.some((f) => enabledSet.has(f));
  }).map((c) => {
    if (c.documentation === "" || c.documentation === void 0) {
      return c;
    }
    if (c.description !== void 0 && c.description !== "") {
      return c;
    }
    return {
      ...c,
      description: c.documentation
    };
  });
  completions2 = uniqBy(completions2, (completion) => completion.value);
  return {
    token: word,
    completions: completions2,
    cacheable: true
  };
}
async function automationFromGoodParseMarkdown(kind, context) {
  const {
    position,
    line
  } = context;
  const result = await breakQuartoMd(asMappedString(context.code));
  const adjustedCellSize = (cell) => {
    const cellLines = lines(cell.source.value);
    let size = cellLines.length;
    if (cell.cell_type !== "raw" && cell.cell_type !== "markdown") {
      size += 2;
    } else if (cellLines[size - 1].trim().length === 0) {
      size -= 1;
    }
    return size;
  };
  if (kind === "completions") {
    let foundCell = void 0;
    for (const cell of result.cells) {
      const size = lines(cell.source.value).length;
      if (size + cell.cellStartLine > position.row) {
        foundCell = cell;
        break;
      }
    }
    if (foundCell === void 0) {
      return noCompletions;
    }
    if (foundCell.cell_type === "raw") {
      const schema = getSchemas().schemas["front-matter"];
      context = {
        ...context,
        line,
        position,
        schema,
        code: foundCell.source,
        schemaName: "front-matter"
      };
      if (positionInTicks(context)) {
        return noCompletions;
      }
      context = trimTicks(context);
      return automationFromGoodParseYAML(kind, context);
    } else if (foundCell.cell_type === "math") {
      throw new Error(`internal error, don't know how to complete cell of type ${foundCell.cell_type}`);
    } else if (foundCell.cell_type === "markdown") {
      return noCompletions;
    } else if (foundCell.cell_type.language) {
      return automationFromGoodParseScript(kind, {
        ...context,
        language: foundCell.cell_type.language,
        code: foundCell.source,
        position: {
          row: position.row - foundCell.cellStartLine,
          column: position.column
        },
        line
      });
    } else {
      throw new Error(`internal error, don't know how to complete cell of type ${foundCell.cell_type}`);
    }
  } else {
    let linesSoFar = 0;
    const lints = [];
    for (const cell of result.cells) {
      if (cell.cell_type === "raw") {
        const innerLints = await automationFromGoodParseYAML(kind, trimTicks({
          ...context,
          filetype: "yaml",
          code: cell.source,
          schema: getSchemas().schemas["front-matter"],
          schemaName: "front-matter",
          line,
          position
        }));
        lints.push(...innerLints);
      } else if (cell.cell_type === "markdown" || cell.cell_type === "math") {
        continue;
      } else if (cell.cell_type.language) {
        const innerLints = await automationFromGoodParseScript(kind, {
          ...context,
          filetype: "script",
          code: cell.source,
          language: cell.cell_type.language,
          line,
          position: {
            ...position,
            row: position.row - (linesSoFar + 1)
          }
        });
        lints.push(...innerLints);
      }
      linesSoFar += adjustedCellSize(cell);
    }
    return lints;
  }
}
async function automationFromGoodParseYAML(kind, context) {
  if (kind === "completions" && positionInTicks(context)) {
    return noCompletions;
  }
  context = trimTicks(context);
  if (guessChunkOptionsFormat(asMappedString(context.code).value) === "knitr") {
    if (kind === "validation") {
      return [];
    } else {
      return noCompletions;
    }
  }
  const func = kind === "completions" ? completionsFromGoodParseYAML : validationFromGoodParseYAML;
  return func(context);
}
async function automationFromGoodParseScript(kind, context) {
  const codeLines = rangedLines(asMappedString(context.code).value);
  let language;
  let codeStartLine;
  if (!context.language) {
    if (codeLines.length < 2) {
      if (kind === "completions") {
        return noCompletions;
      } else {
        return [];
      }
    }
    const m = codeLines[0].substring.match(/.*{([a-z]+)}/);
    if (!m) {
      if (kind === "completions") {
        return noCompletions;
      } else {
        return [];
      }
    }
    codeStartLine = 1;
    language = m[1];
  } else {
    codeStartLine = 0;
    language = context.language;
  }
  const mappedCode = mappedString(context.code, [{
    start: codeLines[codeStartLine].range.start,
    end: codeLines[codeLines.length - 1].range.end
  }]);
  const {
    yaml
  } = await partitionCellOptionsMapped(language, mappedCode);
  if (yaml === void 0) {
    if (kind === "completions") {
      return noCompletions;
    } else {
      return [];
    }
  }
  const schemas = getSchemas().schemas;
  const schema = schemas.engines[context.engine || "markdown"];
  const commentPrefix = kLangCommentChars[language] + "| ";
  context = {
    ...context,
    line: context.line.slice(commentPrefix.length),
    code: yaml,
    commentPrefix,
    position: {
      row: context.position.row - codeStartLine,
      column: context.position.column - commentPrefix.length
    },
    schema,
    schemaName: language
  };
  return automationFromGoodParseYAML(kind, context);
}
async function automationFileTypeDispatch(filetype, kind, context) {
  switch (filetype) {
    case "markdown":
      return automationFromGoodParseMarkdown(kind, context);
    case "yaml":
      return automationFromGoodParseYAML(kind, context);
    case "script":
      return automationFromGoodParseScript(kind, context);
    default:
      return null;
  }
}
function exportSmokeTest(kind, context) {
  console.error(JSON.stringify({ kind, context }, null, 2));
}
async function getAutomation(kind, context) {
  const extension = context.path === null ? "" : context.path.split(".").pop() || "";
  const schemas = getSchemas().schemas;
  const schema = {
    "yaml": extension === "qmd" ? schemas["front-matter"] : schemas.config,
    "markdown": void 0,
    "script": void 0
  }[context.filetype];
  const schemaName = {
    "yaml": extension === "qmd" ? "front-matter" : "config",
    "markdown": void 0,
    "script": void 0
  }[context.filetype];
  const result = await automationFileTypeDispatch(context.filetype, kind, {
    ...context,
    code: asMappedString(context.code),
    schema,
    schemaName
  });
  return result || null;
}
var initializer2 = async () => {
  setValidatorModulePath(getLocalPath("standalone-schema-validators.js"));
  await ensureValidatorModule();
  const response = await fetch(getLocalPath("quarto-json-schemas.json"));
  const _schemas2 = await response.json();
  setSchemas(_schemas2);
  const schemaDefs = getSchemas().definitions;
  for (const [_key, value] of Object.entries(schemaDefs)) {
    setSchemaDefinition(value);
    await withValidator(value, async (_validator) => {
    });
  }
};
var QuartoYamlEditorTools = {
  getAutomation: function(params) {
    const {
      context,
      kind
    } = params;
    return getAutomation(kind, context);
  },
  exportSmokeTest,
  getCompletions: async function(context, path) {
    try {
      setMainPath(path);
      setInitializer(initializer2);
      await initState();
      return await getAutomation("completions", context);
    } catch (e) {
      console.log("Error found during autocomplete", e);
      exportSmokeTest("completions", context);
      return null;
    }
  },
  getLint: async function(context, path) {
    try {
      setMainPath(path);
      setInitializer(initializer2);
      await initState();
      return await getAutomation("validation", context);
    } catch (e) {
      console.log("Error found during linting", e);
      exportSmokeTest("validation", context);
      return null;
    }
  }
};
export {
  QuartoYamlEditorTools,
  getAutomation,
  validationFromGoodParseYAML
};
/*! @author Toru Nagashima <https://github.com/mysticatea> */
