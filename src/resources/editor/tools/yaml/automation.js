import { withValidator } from "./validator-queue.js";
import {
  buildAnnotated,
  locateCursor
} from "./tree-sitter-annotated-yaml.js";
import {
  attemptParsesAtLine,
  getTreeSitter,
  locateFromIndentation,
} from "./parsing.js";
import { getSchemas, navigateSchema } from "./schemas.js";
import { setMainPath } from "./paths.js";

import * as core from "../../../build/core-lib.js";

function positionInTicks(context) {
  const {
    code,
    position,
  } = context;
  const codeLines = core.lines(code.value);
  return (code.value.startsWith("---") &&
    (position.row === 0)) ||
    (code.value.trimEnd().endsWith("---") &&
      (position.row === codeLines.length - 1));
}

// trims "---" from start and end of code field in context
function trimTicks(context) {
  let {
    code,
  } = context;

  if (code.value.startsWith("---")) {
    code = core.mappedString(code, [{ start: 3, end: code.value.length }]);
    // NB we don't need to update position here because we're leaving
    // the newlines alone
    context = { ...context, code };
  }

  // sometimes we get something that ends with ---, sometimes with ---\n
  // we must handle both gracefully.
  if (code.value.trimEnd().endsWith("---")) {
    code = core.mappedString(code, [{
      start: 0,
      end: code.value.lastIndexOf("---"),
    }]);
    context = { ...context, code };
  }
  return context;
}

export async function validationFromGoodParseYAML(context) {
  const {
    code, // full contents of the buffer
  } = context;

  if (code.value === undefined) {
    throw new Error("Internal error: Expected a MappedString");
  }

  const result = await withValidator(context, async (validator) => {
    const parser = await getTreeSitter();

    for (const parseResult of attemptParsesAtLine(context, parser)) {
      const lints = [];
      const {
        parse: tree,
        code: mappedCode
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
          "type": "error",
        });
      }
      return lints;
    }

    // no parses were found, can't lint.
    return [];
  });

  return result;
}

// NB we keep this async for consistency with other functions.
// deno-lint-ignore require-await
async function automationFromGoodParseYAML(kind, context) {
  // user asked for autocomplete on "---": report none
  if ((kind === "completions") && positionInTicks(context)) {
    return false;
  }

  // RStudio sends us here in Visual Editor mode for the YAML front matter
  // but includes the --- delimiters, so we trim those.
  context = trimTicks(context);

  const func = (
    kind === "completions"
      ? completionsFromGoodParseYAML
      : validationFromGoodParseYAML
  );
  return func(context);
}

async function completionsFromGoodParseYAML(context) {
  let {
    line, // editing line up to the cursor
    position, // row/column of cursor (0-based)
    schema, // schema of yaml object

    // if this is a yaml inside a language chunk, it will have a
    // comment prefix which we need to know about in order to
    // autocomplete linebreaks correctly.
    commentPrefix,
  } = context;

  commentPrefix = commentPrefix || "";

  const parser = await getTreeSitter();
  let word;
  if (["-", ":"].indexOf(line.slice(-1)) !== -1) {
    word = "";
  } else {
    // take the last word after spaces
    word = line.split(" ").slice(-1)[0];
  }

  if (line.trim().length === 0) {
    // we're in a pure-whitespace line, we should locate entirely based on indentation
    const path = locateFromIndentation(context);
    const indent = line.length;
    const rawCompletions = await completions({
      schema,
      path,
      word,
      indent,
      commentPrefix,
    });
    rawCompletions.completions = rawCompletions.completions.filter(
      (completion) => completion.type === "key",
    );
    return rawCompletions;
  }
  const indent = line.trimEnd().length - line.trim().length;

  for (const parseResult of attemptParsesAtLine(context, parser)) {
    const {
      parse: tree,
      code: mappedCode,
      deletions,
    } = parseResult;

    if (line.substring(0, line.length - deletions).trim().length === 0) {
      // the valid parse we found puts us in a pure-whitespace line, so we should locate
      // entirely on indentation.
      const path = locateFromIndentation({
        line: line.substring(0, deletions),
        code: mappedCode.value,
        position: {
          row: position.row,
          column: position.column - deletions,
        },
      });
      // we're in an empty line, so the only valid completions are object keys
      const rawCompletions = await completions({
        schema,
        path,
        word,
        indent,
        commentPrefix,
      });
      rawCompletions.completions = rawCompletions.completions.filter(
        (completion) => completion.type === "key",
      );
      return rawCompletions;
    } else {
      const doc = buildAnnotated(tree, mappedCode);
      if (doc === null) {
        continue;
      }
      const index = core.rowColToIndex(mappedCode.value)({
        row: position.row,
        column: position.column - deletions,
      });
      const { withError: locateFailed, value: path } = locateCursor(doc, index);
      // if cursor is at the end of line and it's an object mapping,
      // we can fix the failed location.
      if (locateFailed) {
        if (line.indexOf(":") === -1) {
          // we are inside a line that has no colon, but inside an object mapping (because
          // locateFailed only returns true inside object mappings).
          //
          // we guess here, then that we have an error-tolerant parse
          // and we're inside a string key. Add previous line as key
          // to the path assuming all operations succeed.
          const lines = core.lines(mappedCode.value);
          if (position.row > 0 && lines.length > (position.row - 1)) {
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
      const rawCompletions = await completions({
        schema,
        path,
        word,
        indent,
        commentPrefix,
      });

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
          (completion) => completion.type === "value",
        );
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
    commentPrefix,
  } = obj;
  const matchingSchemas = navigateSchema(schema, path);

  // indent mappings and sequences automatically
  const completions = matchingSchemas.map((schema) => {
    const result = core.schemaCompletions(schema);
    return result.map((completion) => {
      // we only change indentation on keys
      if (
        !completion.suggest_on_accept ||
        completion.type === "value" ||
        core.schemaType(completion.schema) !== "object"
      ) {
        return completion;
      }

      const key = completion.value.split(":")[0];
      const subSchema = completion.schema.properties[key];
      if (core.schemaType(subSchema) === "object") {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix +
            " ".repeat(indent + 2),
        };
      } else if (core.schemaType(subSchema) === "array") {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix +
            " ".repeat(indent + 2) + "- ",
        };
      } else {
        return completion;
      }
    });
  }).flat().filter((c) => c.value.startsWith(word));
  completions.sort((a, b) => a.value.localeCompare(b.value));

  return new Promise(function (resolve, _reject) {
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

async function automationFromGoodParseMarkdown(kind, context) {
  const {
    position,
    line,
  } = context;

  const result = core.breakQuartoMd(context.code);

  const adjustedCellSize = (cell) => {
    const cellLines = core.lines(cell.source.value);
    let size = cellLines.length;
    if (cell.cell_type !== "raw" && cell.cell_type !== "markdown") {
      // language cells don't bring starting and ending triple backticks, we must compensate here
      size += 2;
    } else if (cellLines[size - 1].trim().length === 0) {
      // if we're not a language cell and the last line was empty, for
      // the purposes of line location (what we use this for), that
      // line shouldn't count.
      size -= 1;
    }

    return size;
  };

  if (kind === "completions") {
    let linesSoFar = 0;
    let foundCell = undefined;
    for (const cell of result.cells) {
      const size = adjustedCellSize(cell);
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
      context = {
        line,
        position,
        schema,
        code: foundCell.source,
        schemaName: "front-matter",
      };
      // user asked for autocomplete on "---": report none
      if (positionInTicks(context)) {
        return false;
      }
      context = trimTicks(context);

      return automationFromGoodParseYAML(kind, context);
    } else if (foundCell.cell_type.language) {
      return automationFromGoodParseScript(kind, {
        language: foundCell.cell_type.language,
        code: foundCell.source,
        position: {
          row: position.row - (linesSoFar + 1),
          column: position.column,
        },
        line,
      });
      // complete the yaml inside a chunk
    } else if (foundCell.cell_type === "markdown") {
      // we're inside a markdown, no completions
      return false;
    } else {
      throw new Error(
        `internal error, don't know how to complete cell of type ${foundCell.cell_type}`,
      );
    }
  } else {
    // FIXME the logic here is pretty similar to the one in completions, but
    // just different enough to make refactoring annoying.
    let linesSoFar = 0;
    const lints = [];
    for (const cell of result.cells) {
      if (cell.cell_type === "raw") {
        const innerLints = await automationFromGoodParseYAML(
          kind,
          trimTicks({
            filetype: "yaml",
            code: cell.source,
            schema: (await getSchemas()).schemas["front-matter"],
            schemaName: "front-matter",
            line,
            position, // we don't need to adjust position because front matter only shows up at start of file.
          }),
        );
        lints.push(...innerLints);
      } else if (cell.cell_type.language) {
        const innerLints = await automationFromGoodParseScript(kind, {
          filetype: "script",
          code: cell.source,
          language: cell.cell_type.language,
          line,
          position: {
            ...position,
            row: position.row - (linesSoFar + 1),
          },
        });
        lints.push(...innerLints);
      }

      linesSoFar += adjustedCellSize(cell);
    }
    return lints;
  }
}

async function automationFromGoodParseScript(kind, context) {
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

  const mappedCode = core.mappedString(
    context.code,
    [{
      start: codeLines[codeStartLine].range.start,
      end: codeLines[codeLines.length - 1].range.end,
    }],
  );

  const {
    mappedYaml,
  } = core.partitionCellOptionsMapped(language, mappedCode);

  const schemas = (await getSchemas()).schemas;
  const schema = schemas.languages[language].schema;
  const commentPrefix = core.kLangCommentChars[language] + "| ";

  context = {
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
      column: context.position.column - commentPrefix.length,
    },
    schema,
    schemaName: language,
  };

  if (kind === "completions") {
    // user asked for autocomplete on "---": report none
    if (positionInTicks(context)) {
      return false;
    }
    // RStudio sends us here in Visual Editor mode for the YAML front
    // matter but includes the --- delimiters, so we trim those.
    context = trimTicks(context);
    return completionsFromGoodParseYAML(context);
  } else {
    context = trimTicks(context);
    return validationFromGoodParseYAML(context);
  }
}

// NB we keep this async for consistency
// deno-lint-ignore require-await
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
  const schema = ({
    "yaml": extension === "qmd" ? schemas["front-matter"] : schemas.config,
    "markdown": null, // can't be known ahead of time
    "script": null,
  })[context.filetype];
  const schemaName = ({
    "yaml": extension === "qmd" ? "front-matter" : "config",
    "markdown": null, // can't be known ahead of time
    "script": null,
  })[context.filetype];

  const result = await automationFileTypeDispatch(context.filetype, kind, {
    ...context,
    code: core.asMappedString(context.code),
    schema,
    schemaName,
  });

  return result || null;
}

window.QuartoYamlEditorTools = {
  // deno-lint-ignore require-await
  getCompletions: async function (context, path) {
    try {
      setMainPath(path);
      return getAutomation("completions", context);
    } catch (e) {
      console.log("Error found during autocomplete", e);
      return null;
    }
  },

  // deno-lint-ignore require-await
  getLint: async function (context, path) {
    try {
      setMainPath(path);
      core.setupAjv(window.ajv);
      return getAutomation("validation", context);
    } catch (e) {
      console.log("Error found during linting", e);
      return null;
    }
  },
};
