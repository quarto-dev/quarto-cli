// deno-lint-ignore-file

// The "filetype" passed to getCompletions and getLint indicates the 
// structure of the passed code buffer:
//
//   yaml      - standalone yaml file
//   script    - script that may have embedded YAML comments (e.g. #| foo: bar)
//   markdown  - markdown file that may have embedded YAML front matter as 
//               well as code chunks that include script w/ YAML

const Parser = window.TreeSitter;

let _schemas;
let _parser;

const core = window._quartoCoreLib;

async function getSchemas() {
  if (_schemas) {
    return _schemas;
  }
  const response = await fetch('/quarto/resources/editor/tools/yaml/quarto-json-schemas.json');
  _schemas = response.json();
  return _schemas;
}

async function getTreeSitter() {
  if (_parser) {
    return _parser;
  }
  
  const Parser = window.TreeSitter;
  
  await Parser.init();
  
  _parser = new Parser;
  const YAML = await Parser.Language.load('/quarto/resources/editor/tools/yaml/tree-sitter-yaml.wasm'); // FIXME
  
  _parser.setLanguage(YAML);
  return _parser;
};

function navigateSchema(schema, path)
{
  const refs = {};
  function inner(subSchema, index) {
    if (subSchema.$id) {
      refs[subSchema.$id] = subSchema;
    }
    if (subSchema.$ref) {
      if (refs[subSchema.$ref] === undefined) {
        throw new Error(`Internal error: schema reference ${subSchema.$ref} undefined`);
      }
      subSchema = refs[subSchema.$ref];
    }
    if (index === path.length) {
      return [subSchema];
    }
    const st = core.schemaType(subSchema);
    if (st === "object") {
      const key = path[index];
      if (subSchema.properties[key] === undefined) {
        // because we're using this in an autocomplete scenario, there's the "last entry is a prefix of a
        // valid key" special case.
        if (index !== path.length - 1) {
          return [];
        }
        const completions = Object.getOwnPropertyNames(subSchema.properties).filter(
          name => name.startsWith(key));
        if (completions.length === 0) {
          return [];
        }
        return [subSchema];
      }
      return inner(subSchema.properties[key], index + 1);
    } else if (st === "array") {
      // arrays are uniformly typed, easy
      if (subSchema.items === undefined) {
        // no items schema, can't navigate to expected schema
        return [];
      }
      return inner(subSchema.items, index + 1);
    } else if (st === "anyOf") {
      return subSchema.anyOf.map(ss => inner(ss, index));
    } else if (st === "allOf") {
      // FIXME
      throw new Error("Internal error: don't know how to navigate allOf schema :(");
    } else if (st === "oneOf") {
      const result = subSchema.oneOf.map(ss => inner(ss, index)).flat(Infinity);
      if (result.length !== 1) {
        return [];
      } else {
        return result;
      }
    } else {
      // if path wanted to navigate deeper but this is a YAML
      // "terminal" (not a compound type) then this is not a valid
      // schema to complete on.
      return [];
    }
  };
  return inner(schema, 0).flat(Infinity);
}

// locateCursor is lenient wrt locating inside the last character of a
// range (by using position <= foo instead of position < foo).  That
// happens because tree-sitter's robust parsing sometimes returns
// "partial objects" which are missing parts of the tree.  In those
// cases, we want the cursor to be "inside a null value", and they
// correspond to the edges of an object, where position == range.end.
function locateCursor(annotation, position)
{
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
      // object itself.
      
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
  return locate(annotation, []).flat(Infinity).reverse();
}

// attempt many parses at current line by deleting one character at a
// time, and yields them in sequence

function* attemptParsesAtLine(context, parser)
{ 
  const {
    filetype,  // "yaml" | "script" | "markdown"
    line,      // editing line up to the cursor
    code,      // full contents of the buffer
    position   // row/column of cursor (0-based)
  } = context;
  
  const tree = parser.parse(code);
  if (tree.rootNode.type !== 'ERROR') {
    yield {
      parse: tree,
      code: core.asMappedString(code),
      deletions: 0
    };
  }

  const codeLines = core.rangedLines(code);

  const currentLine = codeLines[position.row].substring;
  let currentColumn = position.column;
  let deletions = 0;

  while (currentColumn > 0) {
    currentColumn--;
    deletions++;

    let chunks = [];
    if (position.row > 0) {
      chunks.push({
        start: 0,
        end: codeLines[position.row - 1].range.end
      });
    }
    chunks.push(`\n${currentLine.substring(0, currentColumn)}\n`);
    if (position.row + 1 < codeLines.length) {
      chunks.push({
        start: codeLines[position.row + 1].range.start,
        end: codeLines[codeLines.length - 1].range.end
      });
    }
    const newCode = core.mappedString(code, chunks);
    
    const tree = parser.parse(newCode.value);
    if (tree.rootNode.type !== 'ERROR') {
      yield {
        parse: tree,
        code: newCode,
        deletions
      };
    }
  }
};

function completionsPromise(opts)
{
  let {
    completions,
    word
  } = opts;
  completions = completions.slice();
  completions.sort((a, b) => a.value.localeCompare(b.value));
  
  return new Promise(function(resolve, reject) {
    // resolve completions
    resolve({

      // token to replace
      token: word,

      // array of completions
      completions,

      // is this cacheable for subsequent results that add to the token
      // see https://github.com/rstudio/rstudio/blob/main/src/gwt/src/org/rstudio/studio/client/workbench/views/console/shell/assist/CompletionCache.java
      cacheable: true,

      // should we automatically initiate another completion request when
      // this one is accepted (e.g. if we complete a yaml key and then
      // want to immediately show available values for that key)
      suggest_on_accept: false
    });
  });
}

function getIndent(l)
{
  return l.length - l.trimStart().length;
}

function getYamlIndentTree(code)
{
  debugger;
  const lines = core.lines(code);
  const predecessor = [];
  const indents = [];

  let indentation = -1;
  let prevPredecessor = -1;
  for (let i = 0; i < lines.length; ++i) {
    const line = lines[i];
    const lineIndent = getIndent(line);
    indents.push(lineIndent);

    if (line.trim().length === 0) {
      predecessor[i] = predecessor[prevPredecessor];
    } else if (lineIndent === indentation) {
      predecessor[i] = predecessor[prevPredecessor];
      prevPredecessor = i;
    } else if (lineIndent < indentation) {
      // go down the predecessor relation
      let v = prevPredecessor;
      while (v >= 0 && indents[v] >= lineIndent) {
        v = predecessor[v];
      }
      predecessor[i] = v;
      prevPredecessor = i;
      indentation = lineIndent;
    } else {
      // pre: lineIndent > indentation
      predecessor[i] = prevPredecessor;
      prevPredecessor = i;
      indentation = lineIndent;
    }
  }
  return {
    predecessor,
    indentation: indents
  };
}

function locateFromIndentation(context)
{
  const {
    filetype,  // "yaml" | "script" | "markdown"
    line,      // editing line up to the cursor
    code,      // full contents of the buffer
    position   // row/column of cursor (0-based)
  } = context;

  const { predecessor, indentation } = getYamlIndentTree(code);

  const lines = core.lines(code);
  let lineNo = position.row;
  const path = [];
  let lineIndent = getIndent(line);
  while (lineNo !== -1) {
    const trimmed = lines[lineNo].trim();

    // treat whitespace differently: find first non-whitespace line above it and compare indents
    if (trimmed.length === 0) {
      let prev = lineNo;
      while (prev >= 0 && lines[prev].trim().length === 0) {
        prev--;
      }
      if (prev === -1) {
        // all whitespace..?! we give up.
        break;
      }
      const prevIndent = getIndent(lines[prev]);
      if (prevIndent < lineIndent) {
        // we're indented deeper than the previous indent: Locate through that.
        lineNo = prev;
        continue;
      }
    }
    if (lineIndent >= indentation[lineNo]) {
      if (trimmed.startsWith("-")) {
        // sequence entry
        // we report the wrong number here, but since we don't
        // actually need to know which entry in the array this is in
        // order to navigate the schema, this is fine.
        path.push(0);
      } else if (trimmed.endsWith(":")) {
        // mapping
        path.push(trimmed.substring(0, trimmed.length - 1));
      } else if (trimmed.length !== 0) {
        // parse error?
        return undefined;
      }
    }
    lineNo = predecessor[lineNo];
  }
  path.reverse();
  return path;
}

function completionsFromSchemaPathWord(schema, path, word)
{
  const noCompletions = new Promise(function(r, _) { r(null); });
  const matchingSchemas = navigateSchema(schema, path);

  const completions = matchingSchemas
        .map(s => core.schemaCompletions(s))
        .flat()
        .filter(c => c.value.startsWith(word));

  if (completions.length === 0) {
    return noCompletions;
  }

  return completionsPromise({
    completions,
    word
  });
}

async function completionsFromGoodParse(context)
{
  const schemas = (await getSchemas()).schemas;
  const noCompletions = new Promise(function(r, _) { r(null); });
  
  const {
    filetype,  // "yaml" | "script" | "markdown"
    line,      // editing line up to the cursor
    code,      // full contents of the buffer
    position   // row/column of cursor (0-based)
  } = context;
  const parser = await getTreeSitter();
  let word;
  if (["-", ":"].indexOf(line.slice(-1)) !== -1) {
    word = "";
  } else {
    word = line.split(" ").slice(-1)[0];
  }

  if (line.trim().length === 0) {
    // we're in a pure-whitespace line, we should locate entirely based on indentation
    const path = locateFromIndentation(context);
    return completionsFromSchemaPathWord(schemas.config, path, word);
  }
  
  for (const parseResult of attemptParsesAtLine(context, parser)) {
    const {
      parse: tree,
      code: mappedCode,
      deletions
    } = parseResult;

    if (line.substring(0, line.length - deletions).trim().length === 0) {
      // the valid parse we found puts us in a pure-whitespace line, so we should locate
      // on indentation as well.
      const path = locateFromIndentation({
        filetype,
        line: line.substring(0, deletions),
        code: mappedCode.value,
        position: {
          row: position.row,
          column: position.column - deletions
        }
      });
      return completionsFromSchemaPathWord(schemas.config, path, word);
    } else {
      const doc = buildAnnotated(tree, mappedCode);
      const index = core.rowColToIndex(mappedCode.value)({
        row: position.row,
        column: position.column - deletions
      });
      const path = locateCursor(doc, index);
      return completionsFromSchemaPathWord(schemas.config, path, word);
    }
  }
  
  return null;
};

window.QuartoYamlEditorTools = {

  getCompletions: async function(context) {

    return completionsFromGoodParse(context) ||
      new Promise(function(r, _) { r(null); });
  },

  getLint: function(context) {

    const {
      filetype,  // "yaml" | "script" | "markdown"
      line,      // editing line up to the cursor
      code,      // full contents of the buffer
      position   // row/column of cursor (0-based)
    } = context;

    return new Promise(function(resolve, reject) {

      // resolve no diagnostics 
      // TODO: remove this code once real diagnostics work
      resolve(null);
      return;

      // look for the word 'bolas' and mark it (note that the front
      // end already takes care of removing marks around the active
      // cursor so we can ignore the cursor and line context)
      const kBolas = "bolas";
      const lint = [];
      const lines = code.split("\n");
      for (var i = 0; i<lines.length; i++) {
        const line = lines[i];
        const pos = line.indexOf(kBolas);
        if (pos !== -1) {
          lint.push({
            "start.row": i,
            "start.column": pos,
            "end.row": i,
            "end.column": pos + kBolas.length,
            "text": "Don'tn let that guy in here!!",
            "type": "error"
          });
        }
      }
      resolve(lint);
    });
  }
};
