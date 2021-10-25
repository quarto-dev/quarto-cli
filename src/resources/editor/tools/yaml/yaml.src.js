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

  if (code.value === undefined) {
    code = core.asMappedString(code);
  }
  
  const tree = parser.parse(code.value);
  if (tree.rootNode.type !== 'ERROR') {
    yield {
      parse: tree,
      code,
      deletions: 0
    };
  }

  const codeLines = core.rangedLines(code.value);

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
      chunks.push("\n");
    }
    chunks.push(`${currentLine.substring(0, currentColumn)}`);
    if (position.row + 1 < codeLines.length) {
      chunks.push("\n");
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
    });
  });
}

function getIndent(l)
{
  return l.length - l.trimStart().length;
}

function getYamlIndentTree(code)
{
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
  let {
    line,      // editing line up to the cursor
    code,      // full contents of the buffer
    position   // row/column of cursor (0-based)
  } = context;

  // currently we don't need mappedstrings here, so we cast to string
  if (code.value !== undefined) {
    code = code.value;
  }

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

function completions(obj)
{
  const {
    schema,
    path,
    word,
    indent,
    commentPrefix
  } = obj;
  const noCompletions = new Promise(function(r, _) { r(null); });
  const matchingSchemas = navigateSchema(schema, path);

  // indent mappings and sequences automatically
  const completions = matchingSchemas.map(schema => {
    const result = core.schemaCompletions(schema);
    return result.map(completion => {
      // we only change indentation on keys
      if (!completion.suggest_on_accept ||
          completion.type === "value" || 
          core.schemaType(completion.schema) !== "object") {
        return completion;
      }
      
      const key = completion.value.split(":")[0];
      const subSchema = completion.schema.properties[key];
      if (core.schemaType(subSchema) === "object") {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix + " ".repeat(indent + 2)
        };
      } else if (core.schemaType(subSchema) === "array") {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix + " ".repeat(indent + 2) + "- "
        };
      } else {
        return completion;
      }
    });
  }).flat().filter(c => c.value.startsWith(word));
  
  if (completions.length === 0) {
    return noCompletions;
  }

  return completionsPromise({
    completions,
    word
  });
}

async function validationFromGoodParseYAML(context)
{
  let {
    code,      // full contents of the buffer
    schema,    // schema of yaml object
  } = context;

  if (code.value === undefined) {
    throw new Error("Internal error: Expected a MappedString");
  }

  return false;  
}

async function automationFromGoodParseYAML(kind, context)
{
  let {
    line,      // editing line up to the cursor
    code,      // full contents of the buffer
    position,  // row/column of cursor (0-based)
    schema,    // schema of yaml object

    // if this is a yaml inside a language chunk, it will have a comment prefix which we need to know about in order to autocomplete linebreaks correctly.
    commentPrefix
  } = context;

  commentPrefix = commentPrefix || "";
  
  // RStudio sends us here in Visual Editor mode for the YAML front matter
  // but includes the --- delimiters, so we trim those.
  if (code.value.startsWith("---")) {
    if (kind === "completions" && position.row === 0) {
      // user asked for autocomplete on "---": report none
      return false;
    }
    code = core.mappedString(code, [{ begin: 0, end: 3 }]);
    // NB we don't need to update position here because we're leaving
    // the newlines alone
    context = {
      ...context,
      code
    };
  }
  
  if (code.value.endsWith("---")) {
    const codeLines = core.mappedLines(code);
    if (kind === "completions" &&
        position.row === codeLines.length - 1) {
      // user asked for autocomplete on "---": report none
      return false;
    }
    code = core.mappedString(code, [{ begin: 0, end: code.value.length - 3 }]);
    context = {
      ...context, code
    };
  }

  const func = (
    kind === "completions" ?
      completionsFromGoodParseYAML :
      validationFromGoodParseYAML);
  return func(context);
}

async function completionsFromGoodParseYAML(context)
{
  let {
    line,      // editing line up to the cursor
    code,      // full contents of the buffer
    position,  // row/column of cursor (0-based)
    schema,    // schema of yaml object

    // if this is a yaml inside a language chunk, it will have a comment prefix which we need to know about in order to autocomplete linebreaks correctly.
    commentPrefix
  } = context;

  commentPrefix = commentPrefix || "";
  
  // RStudio sends us here in Visual Editor mode for the YAML front matter
  // but includes the --- delimiters, so we trim those.
  if (code.value.startsWith("---")) {
    if (position.row === 0) {
      // user asked for autocomplete on "---": report none
      return false;
    }
    code = core.mappedString(code, [{ begin: 0, end: 3 }]);
    // NB we don't need to update position here because we're leaving
    // the newlines alone
    context = {
      ...context,
      code
    };
  }
  
  if (code.value.endsWith("---")) {
    const codeLines = core.mappedLines(code);
    if (position.row === codeLines.length - 1) {
      // user asked for autocomplete on "---": report none
      return false;
    }
    code = core.mappedString(code, [{ begin: 0, end: code.value.length - 3 }]);
    context = { ...context, code };
  }

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
    const indent = line.length;
    let rawCompletions = await completions({ schema, path, word, indent, commentPrefix });
    rawCompletions.completions = rawCompletions.completions.filter(
      completion => completion.type === "key");
    return rawCompletions;
  }
  const indent = line.trimEnd().length - line.trim().length;
  
  for (const parseResult of attemptParsesAtLine(context, parser)) {
    const {
      parse: tree,
      code: mappedCode,
      deletions
    } = parseResult;

    if (line.substring(0, line.length - deletions).trim().length === 0) {
      // the valid parse we found puts us in a pure-whitespace line, so we should locate
      // entirely on indentation.
      const path = locateFromIndentation({
        line: line.substring(0, deletions),
        code: mappedCode.value,
        position: {
          row: position.row,
          column: position.column - deletions
        }
      });
      // we're in an empty line, so the only valid completions are object keys
      let rawCompletions = await completions({ schema, path, word, indent, commentPrefix });
      rawCompletions.completions = rawCompletions.completions.filter(
        completion => completion.type === "key");
      return rawCompletions;
    } else {
      const doc = buildAnnotated(tree, mappedCode);
      if (doc.end !== mappedCode.value.length) {
        // some tree-sitter "error-tolerant parses" are particularly bad for us
        // here, we guard against "partial" parses where tree-sitter doesn't consume the entire string.
        
        // this is symptomatic of a bad object. When this happens, bail on the current parse.
        continue;
      }
      const index = core.rowColToIndex(mappedCode.value)({
        row: position.row,
        column: position.column - deletions
      });
      const { withError: locateFailed, value: path } = locateCursor(doc, index);
      if (locateFailed) {
        // if cursor is at the end of line and it's an object mapping,
        // we can fix the failed location.
        if (position.column >= line.length && line.indexOf(":") !== -1) {
          path.push(line.trim().split(":")[0]);
        }
      }
      let rawCompletions = await completions({ schema, path, word, indent, commentPrefix });

      // filter raw completions depending on cursor context. We use "_" to denote
      // the cursor position. We need to handle:
      // 
      // 1. "     _": empty line, complete only on keys
      // 2. "     foo: _": completion on value position of object
      // 3. "     - _": completion on array sequence
      // 4. "     - foo: ": completion on value position of object inside array sequence
      // 
      // case 1 was handled upstream of this, so we don't need to handle it here
      // cases 2 and 4 take only value completions
      // case 3 takes all completions
      
      // this picks up only cases 2 and 4
      if (line.indexOf(":") !== -1) {
        rawCompletions.completions = rawCompletions.completions.filter(
          completion => completion.type === "value");
      }
      return rawCompletions;
    }
  }
  
  return false;
};

async function automationFromGoodParseMarkdown(kind, context)
{
  const {
    code,
    position,
    line
  } = context;
 
  const result = core.breakQuartoMd(code);
    
  if (kind === "completions") {
    let linesSoFar = 0;
    let foundCell = undefined;
    for (const cell of result.cells) {
      let size = core.lines(cell.source.value).length;
      if (cell.cell_type !== "raw" && cell.cell_type !== "markdown") {
        // language cells don't bring starting and ending triple backticks, we must compensate here
        size += 2;
      }
      if (size + linesSoFar > position.row) {
        foundCell = cell;
        break;
      }
      linesSoFar += size;
    }
    if (foundCell === undefined) {
      return false;
    }
    if (foundCell.cell_type === "raw") {
      const schema = (await getSchemas()).schemas["front-matter"];
      // complete the yaml front matter
      return automationFromGoodParseYAML(kind, {
        line,
        code: foundCell.source,
        position,
        schema
      });
    } else if (foundCell.cell_type.language) {
      return automationFromGoodParseScript(kind, {
        language: foundCell.cell_type.language,
        code: foundCell.source,
        position: {
          row: position.row - (linesSoFar + 1),
          column: position.column
        },
        line
      });
      // complete the yaml inside a chunk
    } else if (foundCell.cell_type === "markdown") {
      // we're inside a markdown, no completions
      return false;
    } else {
      throw new Error(`internal error, don't know how to complete cell of type ${foundCell.cell_type}`);
    }
  } else {
    const lints = [];
    
    for (const cell of result.cells) {
      if (cell.cell_type === "raw") {
        lints.push(...validationFromGoodParseYAML({
          code: cell.source,
          schema: (await getSchemas()).schemas["front-matter"]
        }));
      } else if (cell.cell_type.language) {
        lints.push(...automationFromGoodParseScript(kind, {
          code: cell.source,
          language: cell.cell_type.language,
          line,
        }));
      }
    }
    return lints;
  }
}

async function completionsFromGoodParseMarkdown(context)
{
  const {
    code,
    position,
    line
  } = context;
  const result = core.breakQuartoMd(core.asMappedString(code));
  
  let linesSoFar = 0;
  let foundCell = undefined;
  for (const cell of result.cells) {
    let size = core.lines(cell.source.value).length;
    if (cell.cell_type !== "raw" && cell.cell_type !== "markdown") {
      // language cells don't bring starting and ending triple backticks, we must compensate here
      size += 2;
    }
    if (size + linesSoFar > position.row) {
      foundCell = cell;
      break;
    }
    linesSoFar += size;
  }
  if (foundCell === undefined) {
    return false;
  }
  if (foundCell.cell_type === "raw") {
    const schema = (await getSchemas()).schemas["front-matter"];
    // complete the yaml front matter
    return completionsFromGoodParseYAML({
      line,
      code: foundCell.source,
      position,
      schema
    });
  } else if (foundCell.cell_type.language) {
    return automationFromGoodParseScript("completions", {
      language: foundCell.cell_type.language,
      code: foundCell.source,
      position: {
        row: position.row - (linesSoFar + 1),
        column: position.column
      },
      line
    });
    // complete the yaml inside a chunk
  } else if (foundCell.cell_type === "markdown") {
    // we're inside a markdown, no completions
    return false;
  } else {
    throw new Error(`internal error, don't know how to complete cell of type ${foundCell.cell_type}`);
  }
  
  return false;
}

async function automationFromGoodParseScript(kind, context)
{
  const codeLines = core.rangedLines(context.code.value);
  let language;
  let codeStartLine;
  
  if (!context.language) {
    if (codeLines.length < 2) {
      // need both language and code to autocomplete. length < 2 implies
      // we're missing one of them at least: skip.
      return false;
    }
    const m = codeLines[0].substring.match(/.*{([a-z]+)}/);
    if (!m) {
      // couldn't recognize language in script, return false
      return false;
    }
    codeStartLine = 1;
    language = m[1];
  } else {
    codeStartLine = 0;
    language = context.language;
  }
  // const language = m[1];
  const mappedCode = core.mappedString(
    context.code,
    [{ start: codeLines[codeStartLine].range.start,
       end: codeLines[codeLines.length-1].range.end }]);

  let {
    mappedYaml
  } = core.partitionCellOptionsMapped(language, mappedCode);
  
  const schemas = (await getSchemas()).schemas;
  const schema = schemas.languages[language].schema;
  const commentPrefix = core.kLangCommentChars[language] + "| ";

  const func = (
    kind === "completions" ?
      completionsFromGoodParseYAML :
      validationFromGoodParseYAML);
  
  return func({
    line: context.line.slice(commentPrefix.length),
    code: mappedYaml,
    commentPrefix,
    // NB we get lucky here that the "inverse mapping" of the cursor
    // position is easy enough to compute explicitly. This might not
    // hold in the future...
    position: {
      // -1 subtract the "{language}" line if necessary
      row: context.position.row - codeStartLine,
      // subtract the "#| " entry
      column: context.position.column - commentPrefix.length
    },
    schema,
  });
}

async function automationFileTypeDispatch(filetype, kind, context)
{
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

async function getAutomation(kind, context)
{
  const extension = context.path.split(".").pop() || "";
  const schemas = (await getSchemas()).schemas;
  const schema = ({
    "yaml": extension === "qmd" ? schemas["front-matter"] : schemas.config,
    "markdown": null, // can't be known ahead of time
    "script": null
  })[context.filetype];

  const result = await automationFileTypeDispatch(context.filetype, kind, {
    ...context,
    code: core.asMappedString(context.code),
    schema
  });
  
  console.log({kind, context, result});
  return result || null;
}

window.QuartoYamlEditorTools = {

  getCompletions: async function(context) {
    debugger;
    return getAutomation("completions", context);
  },

  getLint: async function(context) {
    debugger;
    return getAutomation("validation", context);
  }
};
