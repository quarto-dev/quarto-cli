(() => {
  // validator-queue.js
  var core = window._quartoCoreLib;
  var yamlValidators = {};
  var validatorQueues = {};
  function getValidator(context) {
    const {
      schema,
      schemaName
    } = context;
    if (yamlValidators[schemaName]) {
      return yamlValidators[schemaName];
    }
    const validator = new core.YAMLSchema(schema);
    yamlValidators[schemaName] = validator;
    return validator;
  }
  async function withValidator(context, fun) {
    const {
      schemaName
    } = context;
    if (validatorQueues[schemaName] === void 0) {
      validatorQueues[schemaName] = new core.PromiseQueue();
    }
    const queue = validatorQueues[schemaName];
    const result = await queue.enqueue(async () => {
      const validator = getValidator(context);
      try {
        const result2 = await fun(validator);
        return result2;
      } catch (e) {
        console.error("Error in validator queue", e);
        return void 0;
      }
    });
    return result;
  }

  // tree-sitter-annotated-yaml.js
  function buildAnnotated(tree, mappedSource) {
    const singletonBuild = (node) => {
      return buildNode(node.firstChild);
    };
    const buildNode = (node) => {
      if (node === null) {
        return null;
      }
      if (dispatch[node.type] === void 0) {
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
    const annotate = (node, result2, components) => {
      return {
        start: mappedSource.mapClosest(node.startIndex),
        end: mappedSource.mapClosest(node.endIndex),
        result: result2,
        kind: node.type,
        components
      };
    };
    const dispatch = {
      "stream": singletonBuild,
      "document": singletonBuild,
      "block_node": singletonBuild,
      "flow_node": singletonBuild,
      "block_sequence": (node) => {
        const result2 = [], components = [];
        for (let i = 0; i < node.childCount; ++i) {
          const child = node.child(i);
          if (child.type !== "block_sequence_item") {
            continue;
          }
          const component = buildNode(child);
          components.push(component);
          result2.push(component.result);
        }
        return annotate(node, result2, components);
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
        function getV() {
          try {
            return JSON.parse(node.text);
          } catch (e) {
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
          const component = buildNode(child);
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
            throw new Error(`Internal error: Expected a block_mapping_pair, got ${child.type} instead.`);
          } else {
            component = buildNode(child);
          }
          const { key, value } = component.result;
          result2[key] = value;
          components.push(...component.components);
        }
        return annotate(node, result2, components);
      },
      "block_mapping_pair": (node) => {
        let key, value;
        if (node.childCount === 3) {
          key = annotate(node.child(0), node.child(0).text, []);
          value = buildNode(node.child(2));
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
      }
    };
    const result = buildNode(tree.rootNode);
    const endOfMappedCode = mappedSource.map(mappedSource.value.length - 1);
    const startOfMappedCode = mappedSource.map(0);
    const lossage = (result.end - result.start) / (endOfMappedCode - startOfMappedCode);
    if (lossage < 0.95) {
      return null;
    }
    return result;
  }
  function locateCursor(annotation, position) {
    let failedLast = false;
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
        throw new Error("Internal error: cursor outside bounds in sequence locate?");
      } else {
        if (node.kind !== "<<EMPTY>>") {
          return [node.result, pathSoFar];
        } else {
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

  // parsing.js
  var core2 = window._quartoCoreLib;
  var _parser;
  async function getTreeSitter() {
    if (_parser) {
      return _parser;
    }
    const Parser = window.TreeSitter;
    await Parser.init();
    _parser = new Parser();
    const YAML = await Parser.Language.load("/quarto/resources/editor/tools/yaml/tree-sitter-yaml.wasm");
    _parser.setLanguage(YAML);
    return _parser;
  }
  function* attemptParsesAtLine(context, parser) {
    let {
      filetype,
      line,
      code,
      position
    } = context;
    if (code.value === void 0) {
      code = core2.asMappedString(code);
    }
    const tree = parser.parse(code.value);
    if (tree.rootNode.type !== "ERROR") {
      yield {
        parse: tree,
        code,
        deletions: 0
      };
    }
    const codeLines = core2.rangedLines(code.value, true);
    if (position.row >= codeLines.length || position.row < 0) {
      return;
    }
    const currentLine = codeLines[position.row].substring;
    let currentColumn = position.column;
    let deletions = 0;
    const locF = core2.rowColToIndex(code.value);
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
      const newCode = core2.mappedString(code, chunks);
      const tree2 = parser.parse(newCode.value);
      if (tree2.rootNode.type !== "ERROR") {
        yield {
          parse: tree2,
          code: newCode,
          deletions
        };
      }
    }
  }
  function getIndent(l) {
    return l.length - l.trimStart().length;
  }
  function getYamlIndentTree(code) {
    const lines = core2.lines(code);
    const predecessor = [];
    const indents = [];
    let indentation = -1;
    let prevPredecessor = -1;
    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];
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
    let {
      line,
      code,
      position
    } = context;
    if (code.value !== void 0) {
      code = code.value;
    }
    const { predecessor, indentation } = getYamlIndentTree(code);
    const lines = core2.lines(code);
    let lineNo = position.row;
    const path = [];
    let lineIndent = getIndent(line);
    while (lineNo !== -1) {
      const trimmed = lines[lineNo].trim();
      if (trimmed.length === 0) {
        let prev = lineNo;
        while (prev >= 0 && lines[prev].trim().length === 0) {
          prev--;
        }
        if (prev === -1) {
          break;
        }
        const prevIndent = getIndent(lines[prev]);
        if (prevIndent < lineIndent) {
          lineNo = prev;
          continue;
        }
      }
      if (lineIndent >= indentation[lineNo]) {
        if (trimmed.startsWith("-")) {
          path.push(0);
        } else if (trimmed.endsWith(":")) {
          path.push(trimmed.substring(0, trimmed.length - 1));
        } else if (trimmed.length !== 0) {
          return void 0;
        }
      }
      lineNo = predecessor[lineNo];
    }
    path.reverse();
    return path;
  }

  // schemas.js
  var core3 = window._quartoCoreLib;
  var _schemas;
  async function getSchemas() {
    if (_schemas) {
      return _schemas;
    }
    const response = await fetch("/quarto/resources/editor/tools/yaml/quarto-json-schemas.json");
    _schemas = response.json();
    return _schemas;
  }
  function navigateSchema(schema, path) {
    const refs = {};
    function inner(subSchema, index) {
      if (subSchema.$id) {
        refs[subSchema.$id] = subSchema;
      }
      if (subSchema.$ref) {
        if (refs[subSchema.$ref] === void 0) {
          throw new Error(`Internal error: schema reference ${subSchema.$ref} undefined`);
        }
        subSchema = refs[subSchema.$ref];
      }
      if (index === path.length) {
        return [subSchema];
      }
      const st = core3.schemaType(subSchema);
      if (st === "object") {
        const key = path[index];
        if (subSchema.properties[key] === void 0) {
          if (index !== path.length - 1) {
            return [];
          }
          const completions2 = Object.getOwnPropertyNames(subSchema.properties).filter((name) => name.startsWith(key));
          if (completions2.length === 0) {
            return [];
          }
          return [subSchema];
        }
        return inner(subSchema.properties[key], index + 1);
      } else if (st === "array") {
        if (subSchema.items === void 0) {
          return [];
        }
        return inner(subSchema.items, index + 1);
      } else if (st === "anyOf") {
        return subSchema.anyOf.map((ss) => inner(ss, index));
      } else if (st === "allOf") {
        throw new Error("Internal error: don't know how to navigate allOf schema :(");
      } else if (st === "oneOf") {
        const result = subSchema.oneOf.map((ss) => inner(ss, index)).flat(Infinity);
        if (result.length !== 1) {
          return [];
        } else {
          return result;
        }
      } else {
        return [];
      }
    }
    ;
    return inner(schema, 0).flat(Infinity);
  }

  // automation.js
  var core4 = window._quartoCoreLib;
  async function validationFromGoodParseYAML(context) {
    const {
      code
    } = context;
    if (code.value === void 0) {
      throw new Error("Internal error: Expected a MappedString");
    }
    return await withValidator(context, async (validator) => {
      const parser = await getTreeSitter();
      for (const parseResult of attemptParsesAtLine(context, parser)) {
        const lints = [];
        const {
          parse: tree,
          code: mappedCode,
          deletions
        } = parseResult;
        const annotation = buildAnnotated(tree, mappedCode);
        if (annotation === null) {
          continue;
        }
        const validationResult = validator.validateParse(code, annotation);
        for (const error of validationResult.errors) {
          lints.push({
            "start.row": error.start.line,
            "start.column": error.start.column,
            "end.row": error.end.line,
            "end.column": error.end.column,
            "text": error.messageNoLocation,
            "type": "error"
          });
        }
        return lints;
      }
    });
  }
  async function automationFromGoodParseYAML(kind, context) {
    let {
      code,
      position,
      schema,
      commentPrefix
    } = context;
    commentPrefix = commentPrefix || "";
    if (code.value.startsWith("---")) {
      if (kind === "completions" && position.row === 0) {
        return false;
      }
      code = core4.mappedString(code, [{ start: 3, end: code.value.length }]);
      context = {
        ...context,
        code
      };
    }
    if (code.value.trimEnd().endsWith("---")) {
      const codeLines = core4.lines(code.value);
      if (kind === "completions" && position.row === codeLines.length - 1) {
        return false;
      }
      code = core4.mappedString(code, [{ start: 0, end: code.value.lastIndexOf("---") }]);
      context = {
        ...context,
        code
      };
    }
    const func = kind === "completions" ? completionsFromGoodParseYAML : validationFromGoodParseYAML;
    return func(context);
  }
  async function completionsFromGoodParseYAML(context) {
    let {
      line,
      code,
      position,
      schema,
      commentPrefix
    } = context;
    commentPrefix = commentPrefix || "";
    if (code.value.startsWith("---")) {
      if (position.row === 0) {
        return false;
      }
      code = core4.mappedString(code, [{ start: 3, end: code.value.length }]);
      context = {
        ...context,
        code
      };
    }
    if (code.value.trimEnd().endsWith("---")) {
      const codeLines = core4.lines(code.value);
      if (position.row === codeLines.length - 1) {
        return false;
      }
      code = core4.mappedString(code, [{ start: 0, end: code.value.lastIndexOf("---") }]);
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
      const path = locateFromIndentation(context);
      const indent2 = line.length;
      let rawCompletions = await completions({ schema, path, word, indent: indent2, commentPrefix });
      rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "key");
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
        const path = locateFromIndentation({
          line: line.substring(0, deletions),
          code: mappedCode.value,
          position: {
            row: position.row,
            column: position.column - deletions
          }
        });
        let rawCompletions = await completions({ schema, path, word, indent, commentPrefix });
        rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "key");
        return rawCompletions;
      } else {
        const doc = buildAnnotated(tree, mappedCode);
        if (doc === null) {
          continue;
        }
        const index = core4.rowColToIndex(mappedCode.value)({
          row: position.row,
          column: position.column - deletions
        });
        const { withError: locateFailed, value: path } = locateCursor(doc, index);
        if (locateFailed) {
          if (line.indexOf(":") === -1) {
            const lines = core4.lines(mappedCode.value);
            if (position.row > 0 && lines.length > position.row - 1) {
              const prevLine = lines[position.row - 1].trim().split(":");
              if (prevLine.length > 0) {
                path.push(prevLine[0]);
              }
            }
          } else {
            if (position.column >= line.length) {
              path.push(line.trim().split(":")[0]);
            }
          }
        }
        let rawCompletions = await completions({ schema, path, word, indent, commentPrefix });
        if (line.indexOf(":") !== -1) {
          rawCompletions.completions = rawCompletions.completions.filter((completion) => completion.type === "value");
        }
        return rawCompletions;
      }
    }
    return false;
  }
  function completions(obj) {
    const {
      schema,
      path,
      word,
      indent,
      commentPrefix
    } = obj;
    const matchingSchemas = navigateSchema(schema, path);
    const completions2 = matchingSchemas.map((schema2) => {
      const result = core4.schemaCompletions(schema2);
      return result.map((completion) => {
        if (!completion.suggest_on_accept || completion.type === "value" || core4.schemaType(completion.schema) !== "object") {
          return completion;
        }
        const key = completion.value.split(":")[0];
        const subSchema = completion.schema.properties[key];
        if (core4.schemaType(subSchema) === "object") {
          return {
            ...completion,
            value: completion.value + "\n" + commentPrefix + " ".repeat(indent + 2)
          };
        } else if (core4.schemaType(subSchema) === "array") {
          return {
            ...completion,
            value: completion.value + "\n" + commentPrefix + " ".repeat(indent + 2) + "- "
          };
        } else {
          return completion;
        }
      });
    }).flat().filter((c) => c.value.startsWith(word));
    completions2.sort((a, b) => a.value.localeCompare(b.value));
    return new Promise(function(resolve, reject) {
      resolve({
        token: word,
        completions: completions2,
        cacheable: true
      });
    });
  }
  async function automationFromGoodParseMarkdown(kind, context) {
    const {
      code,
      position,
      line
    } = context;
    const result = core4.breakQuartoMd(code);
    const adjustedCellSize = (cell) => {
      let cellLines = core4.lines(cell.source.value);
      let size = cellLines.length;
      if (cellLines[size - 1].trim().length === 0) {
        size -= 1;
      }
      if (cell.cell_type !== "raw" && cell.cell_type !== "markdown") {
        size += 2;
      }
      return size;
    };
    if (kind === "completions") {
      let linesSoFar = 0;
      let foundCell = void 0;
      for (const cell of result.cells) {
        let size = adjustedCellSize(cell);
        if (size + linesSoFar > position.row) {
          foundCell = cell;
          break;
        }
        linesSoFar += size;
      }
      if (foundCell === void 0) {
        return false;
      }
      if (foundCell.cell_type === "raw") {
        const schema = (await getSchemas()).schemas["front-matter"];
        return automationFromGoodParseYAML(kind, {
          line,
          position,
          schema,
          code: foundCell.source,
          schemaName: "front-matter"
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
      } else if (foundCell.cell_type === "markdown") {
        return false;
      } else {
        throw new Error(`internal error, don't know how to complete cell of type ${foundCell.cell_type}`);
      }
    } else {
      let linesSoFar = 0;
      const lints = [];
      for (const cell of result.cells) {
        if (cell.cell_type === "raw") {
          const innerLints = await automationFromGoodParseYAML(kind, {
            filetype: "yaml",
            code: cell.source,
            schema: (await getSchemas()).schemas["front-matter"],
            schemaName: "front-matter",
            line,
            position
          });
          lints.push(...innerLints);
        } else if (cell.cell_type.language) {
          const innerLints = await automationFromGoodParseScript(kind, {
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
  async function automationFromGoodParseScript(kind, context) {
    const codeLines = core4.rangedLines(context.code.value);
    let language;
    let codeStartLine;
    if (!context.language) {
      if (codeLines.length < 2) {
        return false;
      }
      const m = codeLines[0].substring.match(/.*{([a-z]+)}/);
      if (!m) {
        return false;
      }
      codeStartLine = 1;
      language = m[1];
    } else {
      codeStartLine = 0;
      language = context.language;
    }
    const mappedCode = core4.mappedString(context.code, [{
      start: codeLines[codeStartLine].range.start,
      end: codeLines[codeLines.length - 1].range.end
    }]);
    let {
      mappedYaml
    } = core4.partitionCellOptionsMapped(language, mappedCode);
    const schemas = (await getSchemas()).schemas;
    const schema = schemas.languages[language].schema;
    const commentPrefix = core4.kLangCommentChars[language] + "| ";
    const func = kind === "completions" ? completionsFromGoodParseYAML : validationFromGoodParseYAML;
    return func({
      line: context.line.slice(commentPrefix.length),
      code: mappedYaml,
      commentPrefix,
      position: {
        row: context.position.row - codeStartLine,
        column: context.position.column - commentPrefix.length
      },
      schema,
      schemaName: language
    });
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
  async function getAutomation(kind, context) {
    const extension = context.path.split(".").pop() || "";
    const schemas = (await getSchemas()).schemas;
    const schema = {
      "yaml": extension === "qmd" ? schemas["front-matter"] : schemas.config,
      "markdown": null,
      "script": null
    }[context.filetype];
    const schemaName = {
      "yaml": extension === "qmd" ? "front-matter" : "config",
      "markdown": null,
      "script": null
    }[context.filetype];
    const result = await automationFileTypeDispatch(context.filetype, kind, {
      ...context,
      code: core4.asMappedString(context.code),
      schema,
      schemaName
    });
    return result || null;
  }
  window.QuartoYamlEditorTools = {
    getCompletions: async function(context) {
      return getAutomation("completions", context);
    },
    getLint: async function(context) {
      debugger;
      core4.setupAjv(window.ajv);
      return getAutomation("validation", context);
    }
  };
})();
