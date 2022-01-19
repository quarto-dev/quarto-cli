/*
* yaml-intelligence.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { AutomationKind, YamlIntelligenceContext } from "./types.ts";

import { buildAnnotated, locateCursor } from "./tree-sitter-annotated-yaml.ts";

import {
  attemptParsesAtLine,
  getTreeSitter,
  locateFromIndentation,
  getYamlPredecessors
} from "./parsing.ts";

import { getSchemas, navigateSchema } from "./schema-utils.ts";
import { setMainPath } from "./paths.ts";
import { withValidator } from "./validator-queue.ts";
import { guessChunkOptionsFormat } from "../guess-chunk-options-format.ts";
import { asMappedString, MappedString, mappedString } from "../mapped-text.ts";
import { lines, rowColToIndex } from "../text.ts";
import {
  Completion,
  expandAliasesFrom,
  Schema,
  schemaCompletions,
  schemaType,
} from "../schema.ts";
import { Semaphore } from "../semaphore.ts";
import { breakQuartoMd, QuartoMdCell } from "../break-quarto-md.ts";
import { rangedLines } from "../ranged-text.ts";
import {
  kLangCommentChars,
  partitionCellOptionsMapped,
} from "../partition-cell-options.ts";

interface IDEContext {
  formats: string[];
  project_formats: string[];
}

interface CompletionContext {
  schema: Schema;
  path: (number | string)[];
  word: string;
  indent: number;
  commentPrefix: string;
  context: IDEContext;
}

interface ValidationResult {
  "start.row": number;
  "start.column": number;
  "end.row": number;
  "end.column": number;
  "text": string;
  "type": string;
}

function positionInTicks(context: YamlIntelligenceContext) {
  // This calls lines() somewhat superfluously
  const code = asMappedString(context.code);
  const {
    position,
  } = context;
  const codeLines = lines(code.value);
  return (code.value.startsWith("---") &&
    (position.row === 0)) ||
    (code.value.trimEnd().endsWith("---") &&
      (position.row === codeLines.length - 1));
}

// trims "---" from start and end of code field in context
function trimTicks(context: YamlIntelligenceContext): YamlIntelligenceContext {
  let code = asMappedString(context.code);

  if (code.value.startsWith("---")) {
    code = mappedString(code, [{ start: 3, end: code.value.length }]);
    // NB we don't need to update position here because we're leaving
    // the newlines alone
    context = { ...context, code };
  }

  // sometimes we get something that ends with ---, sometimes with ---\n
  // we must handle both gracefully.
  if (code.value.trimEnd().endsWith("---")) {
    code = mappedString(code, [{
      start: 0,
      end: code.value.lastIndexOf("---"),
    }]);
    context = { ...context, code };
  }
  return context;
}

const hasInitSemaphore = new Semaphore(0);
export async function validationFromGoodParseYAML(
  context: YamlIntelligenceContext,
): Promise<ValidationResult[]> {
  await hasInitSemaphore.runExclusive(async () => {});

  const code = asMappedString(context.code); // full contents of the buffer

  const result = await withValidator(context.schema, async (validator) => {
    const parser = await getTreeSitter();

    for (const parseResult of attemptParsesAtLine(context, parser) || []) {
      const lints = [];
      const {
        parse: tree,
        code: mappedCode,
      } = parseResult;
      const annotation = buildAnnotated(tree, mappedCode);
      if (annotation === null) {
        continue;
      }
      const validationResult = validator.validateParse(code, annotation);

      for (const error of validationResult.errors) {
        let text;
        if (error.niceError && error.niceError.heading) {
          // use a new nice error if available
          text = error.niceError.heading;
        } else {
          // default to ajv msg otherwise
          text = error.message;
        }

        lints.push({
          "start.row": error.location.start.line,
          "start.column": error.location.start.column,
          "end.row": error.location.end.line,
          "end.column": error.location.end.column,
          "text": text,
          "type": "error",
        });
      }
      return lints;
    }

    // no parses were found, can't lint.
    return [];
  });

  const predecessors = getYamlPredecessors(code.value, context.position.row - 1);

  // keep only the lints that are not in the predecessor path of the cursor
  return result.filter(lint => predecessors.indexOf(lint["start.row"] - 1) === -1);
}

async function completionsFromGoodParseYAML(context: YamlIntelligenceContext) {
  const {
    line, // editing line up to the cursor
    position, // row/column of cursor (0-based)
    schema, // schema of yaml object
    // if this is a yaml inside a language chunk, it will have a
    // comment prefix which we need to know about in order to
    // autocomplete linebreaks correctly.
  } = context;

  const commentPrefix = context.commentPrefix || "";

  const parser = await getTreeSitter();
  let word = "";
  if (line.slice(-1) !== ":" && line.trimLeft()[0] !== "-") {
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
      context,
    });
    rawCompletions.completions = rawCompletions.completions.filter(
      (completion) => completion.type === "key",
    );
    return rawCompletions;
  }
  const indent = line.trimEnd().length - line.trim().length;

  const completeEmptyLineOnIndentation = async (
    deletions: number,
    mappedCode: MappedString,
  ) => {
    // the valid parse we found puts us in a pure-whitespace line, so we should locate
    // entirely on indentation.
    const path = locateFromIndentation({
      line: line.slice(0, -deletions),
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
      context,
    });
    rawCompletions.completions = rawCompletions.completions.filter(
      (completion) => completion.type === "key",
    );
    return rawCompletions;
  };

  for (const parseResult of attemptParsesAtLine(context, parser)) {
    const {
      parse: tree,
      code: mappedCode,
      deletions,
    } = parseResult;
    const lineAfterDeletions = line.substring(0, line.length - deletions);

    if (lineAfterDeletions.trim().length === 0) {
      const result = await completeEmptyLineOnIndentation(
        deletions,
        mappedCode,
      );
      return result;
    } else {
      const doc = buildAnnotated(tree, mappedCode);
      if (doc === null) {
        continue;
      }
      const index = rowColToIndex(mappedCode.value)({
        row: position.row,
        column: position.column - deletions,
      });
      let { withError: locateFailed, value: maybePath } = locateCursor(
        doc,
        index,
      );

      // revert to indentation-based location if location failed
      if (locateFailed) {
        // case of empty line
        if (lineAfterDeletions.trim().length === 0) {
          const result = await completeEmptyLineOnIndentation(
            deletions,
            mappedCode,
          );
          return result;
        }

        maybePath = locateFromIndentation({
          line: lineAfterDeletions,
          code: mappedCode.value,
          position: {
            row: position.row,
            column: position.column - deletions,
          },
        });

        // non-empty case. Do we have a colon, in which case we must complete a value,
        // or do we not have a colon, in which case we must complete the keys
        // that are prefixes of the line contents?
      }

      // appease the typechecker, who can't see that when locateFailed === false, value is good.
      const path = maybePath!;

      if (path[path.length - 1] === word) {
        // we're in the middle of a completion and we located inside that value,
        // for example "echo: fal_"
        //
        // delete it before attempting completion
        path.pop();
      }

      const rawCompletions = await completions({
        schema,
        path,
        word,
        indent,
        commentPrefix,
        context,
      });

      // filter raw completions depending on cursor context. We use "_" to denote
      // the cursor position. We need to handle:
      //
      // 1. "     _": empty line, complete only on keys
      // 2. "     foo: _": completion on value position of object
      // 3. "     - _": completion on array sequence
      // 4. "     - foo: ": completion on value position of object inside array sequence
      // 5. "     foo_": completion on key position in partially-completed word
      //
      // case 1 was handled upstream of this, so we don't need to handle it here
      // cases 2 and 4 take only value completions
      // case 3 takes all completions, so no work is needed

      if (line.indexOf(":") !== -1) {
        // this picks up cases 2 and 4
        rawCompletions.completions = rawCompletions.completions.filter(
          (completion) => completion.type === "value",
        ).map((completion) => // never followup a suggestion in value position
        ({ ...completion, suggest_on_accept: false }));
      } else if (line.indexOf("-") === -1) {
        // this picks up case 5 (and 1, but case one was already handled.)
        rawCompletions.completions = rawCompletions.completions.filter(
          (completion) => completion.type === "key",
        );
      }
      return rawCompletions;
    }
  }

  return noCompletions;
}

export interface CompletionResult {
  token: string;
  completions: Completion[];
  cacheable: boolean;
}

const noCompletions = {
  token: "",
  completions: [],
  cacheable: false
};

// a minimal uniqBy implementation so we don't need to pull in
// the entirety of lodash.
//
// if keyFun returns undefined, elements are considered unique
function uniqBy<T>(lst: T[], keyFun: (item: T) => (string | undefined)): T[]
{
  const itemSet = new Set<string>();
  return lst.filter(item => {
    const key = keyFun(item);
    if (key === undefined) {
      return true;
    }
    if (itemSet.has(key)) {
      return false;
    }
    itemSet.add(key);
    return true;
  });
}

async function completions(obj: CompletionContext): Promise<CompletionResult> {
  const {
    schema,
    path,
    word,
    indent,
    commentPrefix,
    context,
  } = obj;
  const matchingSchemas = uniqBy(
    await navigateSchema(schema, path),
    (schema: Schema) => schema.$id);
  const { aliases } = await getSchemas();
  const formats = [
    ...Array.from(context.formats),
    ...Array.from(context.project_formats),
    // keep only pandoc valid formats here
  ].filter((x) => aliases["pandoc-all"].indexOf(x) !== -1);

  // indent mappings and sequences automatically
  let completions = matchingSchemas.map((schema) => {
    const result = schemaCompletions(schema);
    return result.map((completion) => {
      // we only change indentation on keys
      if (
        !completion.suggest_on_accept ||
        completion.type === "value" ||
        schemaType(completion.schema) !== "object"
      ) {
        return completion;
      }

      const key = completion.value.split(":")[0];
      const subSchema = completion.schema.properties[key];
      if (schemaType(subSchema) === "object") {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix +
            " ".repeat(indent + 2),
        };
      } else if (schemaType(subSchema) === "array") {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix +
            " ".repeat(indent + 2) + "- ",
        };
      } else {
        return completion;
      }
    });
  }).flat()
    .filter((c) => c.value.startsWith(word))
    .filter((c) => {
      if (formats.length === 0) {
        // don't filter on tags if there's no detected formats anywhere.
        return true;
      }
      // handle format-enabling and -disabling tags
      let formatTags: string[] = [];
      if (c.type === "key") {
        let value = c.schema.properties[c.display];
        if (value === undefined) {
          for (const key of Object.keys(c.schema.patternProperties)) {
            const regexp = new RegExp(key);
            if (c.display.match(regexp)) {
              value = c.schema.patternProperties[key];
              break;
            }
          }
        }
        if (value === undefined) {
          // can't follow the schema to check tags in key context;
          // don't hide
          return true;
        }
        formatTags = (value && value.tags && value.tags.formats) || [];
      } else if (c.type === "value") {
        formatTags = (c.schema && c.schema.tags && c.schema.tags.formats) || [];
      } else {
        // weird completion type?
        console.log(`Unexpected completion type ${c.type}`);
        return true;
      }

      const enabled = formatTags.filter((tag) => !tag.startsWith("!"));
      const enabledSet = new Set();
      if (enabled.length === 0) {
        for (const el of aliases["pandoc-all"]) {
          enabledSet.add(el);
        }
      } else {
        for (const tag of enabled) {
          for (const el of expandAliasesFrom([tag], aliases)) {
            enabledSet.add(el);
          }
        }
      }
      for (let tag of formatTags.filter((tag: string) => tag.startsWith("!"))) {
        tag = tag.slice(1);
        for (const el of expandAliasesFrom([tag], aliases)) {
          enabledSet.delete(el);
        }
      }
      return formats.some((f) => enabledSet.has(f));
    })
    .map((c) => {
      if (
        c.documentation === "" ||
        c.documentation === undefined
      ) {
        // don't change description if there's no documentation
        return c;
      }
      if (
        c.description !== undefined &&
        c.description !== ""
      ) {
        // don't change description if description exists
        return c;
      }
      return {
        ...c,
        description: c.documentation,
      };
    });
  // completions.sort((a, b) => a.value.localeCompare(b.value));

  // uniqBy the final completions array on their completion values.
  
  completions = uniqBy(completions, (completion) => completion.value);
  return {
    // token to replace
    token: word,

    // array of completions
    completions,

    // is this cacheable for subsequent results that add to the token
    // see https://github.com/rstudio/rstudio/blob/main/src/gwt/src/org/rstudio/studio/client/workbench/views/console/shell/assist/CompletionCache.java
    cacheable: true,
  };
}

async function automationFromGoodParseMarkdown(
  kind: AutomationKind,
  context: YamlIntelligenceContext,
): Promise<CompletionResult | ValidationResult[]> {
  const {
    position,
    line,
  } = context;

  const result = await breakQuartoMd(asMappedString(context.code));

  const adjustedCellSize = (cell: QuartoMdCell) => {
    const cellLines = lines(cell.source.value);
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
    let foundCell = undefined;
    for (const cell of result.cells) {
      const size = lines(cell.source.value).length;
      if (size + cell.cellStartLine > position.row) {
        foundCell = cell;
        break;
      }
    }
    if (foundCell === undefined) {
      return noCompletions;
    }
    if (foundCell.cell_type === "raw") {
      const schema = (await getSchemas()).schemas["front-matter"];
      // complete the yaml front matter
      context = {
        ...context,
        line,
        position,
        schema,
        code: foundCell.source,
        schemaName: "front-matter",
      };
      // user asked for autocomplete on "---": report none
      if (positionInTicks(context)) {
        return noCompletions;
      }
      context = trimTicks(context);

      return automationFromGoodParseYAML(kind, context);
    } else if (foundCell.cell_type === "math") {
      throw new Error(
        `internal error, don't know how to complete cell of type ${foundCell.cell_type}`,
      );
    } else if (foundCell.cell_type === "markdown") {
      // we're inside a markdown, no completions
      return noCompletions;
    } else if (foundCell.cell_type.language) {
      return automationFromGoodParseScript(kind, {
        ...context,
        language: foundCell.cell_type.language,
        code: foundCell.source,
        position: {
          row: position.row - foundCell.cellStartLine,
          column: position.column,
        },
        line,
      });
      // complete the yaml inside a chunk
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
            ...context,
            filetype: "yaml",
            code: cell.source,
            schema: (await getSchemas()).schemas["front-matter"],
            schemaName: "front-matter",
            line,
            position, // we don't need to adjust position because front matter only shows up at start of file.
          }),
        ) as ValidationResult[];
        lints.push(...innerLints);
      } else if (cell.cell_type === "markdown" || cell.cell_type === "math") {
        // nothing to lint in markdown or math cells
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
            row: position.row - (linesSoFar + 1),
          },
        }) as ValidationResult[];
        lints.push(...innerLints);
      }

      linesSoFar += adjustedCellSize(cell);
    }
    
    return lints;
  }
}

// deno-lint-ignore require-await
async function automationFromGoodParseYAML(
  kind: AutomationKind,
  context: YamlIntelligenceContext,
): Promise<CompletionResult | ValidationResult[]> {
  // user asked for autocomplete on "---": report none
  if ((kind === "completions") && positionInTicks(context)) {
    return noCompletions;
  }

  // RStudio sends us here in Visual Editor mode for the YAML front matter
  // but includes the --- delimiters, so we trim those.
  context = trimTicks(context);

  if (guessChunkOptionsFormat(asMappedString(context.code).value) === "knitr") {
    // if the chunk options are in knitr format, don't validate or
    // autocomplete
    if (kind === "validation") {
      return [];
    } else {
      return noCompletions;
    }
  }

  const func = (
    kind === "completions"
      ? completionsFromGoodParseYAML
      : validationFromGoodParseYAML
  );
  return func(context);
}

async function automationFromGoodParseScript(
  kind: AutomationKind,
  context: YamlIntelligenceContext,
): Promise<CompletionResult | ValidationResult[]> {
  const codeLines = rangedLines(asMappedString(context.code).value);
  let language;
  let codeStartLine;

  if (!context.language) {
    if (codeLines.length < 2) {
      // need both language and code to autocomplete. length < 2 implies
      // we're missing one of them at least: skip.
      if (kind === "completions") {
        return noCompletions;
      } else {
        return [];
      }
    }
    const m = codeLines[0].substring.match(/.*{([a-z]+)}/);
    if (!m) {
      // couldn't recognize language in script, return no intelligence
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

  const mappedCode = mappedString(
    context.code,
    [{
      start: codeLines[codeStartLine].range.start,
      end: codeLines[codeLines.length - 1].range.end,
    }],
  );

  const {
    yaml,
  } = await partitionCellOptionsMapped(language, mappedCode);

  if (yaml === undefined) {
    if (kind === "completions") {
      return noCompletions;
    } else {
      return [];
    }
  }

  const schemas = (await getSchemas()).schemas;
  const schema = schemas.engines[context.engine || "markdown"];
  const commentPrefix = kLangCommentChars[language] + "| ";

  context = {
    ...context,
    line: context.line.slice(commentPrefix.length),
    code: yaml,
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

  return automationFromGoodParseYAML(kind, context);
}

// NB we keep this async for consistency
// deno-lint-ignore require-await
async function automationFileTypeDispatch(
  filetype: string,
  kind: AutomationKind,
  context: YamlIntelligenceContext,
) {
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

function exportSmokeTest(
  kind: AutomationKind,
  context: YamlIntelligenceContext,
) {
  console.error(JSON.stringify({ kind, context }, null, 2));
}

export async function getAutomation(
  kind: AutomationKind,
  context: YamlIntelligenceContext,
) {
  const extension = context.path.split(".").pop() || "";
  const schemas = (await getSchemas()).schemas;
  const schema = ({
    "yaml": extension === "qmd" ? schemas["front-matter"] : schemas.config,
    "markdown": undefined, // can't be known ahead of time
    "script": undefined,
  })[context.filetype];
  const schemaName = ({
    "yaml": extension === "qmd" ? "front-matter" : "config",
    "markdown": undefined, // can't be known ahead of time
    "script": undefined,
  })[context.filetype];

  const result = await automationFileTypeDispatch(context.filetype, kind, {
    ...context,
    code: asMappedString(context.code),
    schema,
    schemaName,
  });

  return result || null;
}

let automationInit = false;
const mustInitSemaphore = new Semaphore(1);

export async function initAutomation(path: string) {
  if (automationInit) {
    return;
  }

  await mustInitSemaphore.runExclusive(async () => {
    const before = performance.now();
    if (automationInit) {
      return;
    }
    automationInit = true;
    setMainPath(path);

    const schemaDefs = (await getSchemas()).definitions;
    for (const [_key, value] of Object.entries(schemaDefs)) {
      await withValidator(value, async (_validator) => {
      });
    }
    const after = performance.now();
    console.log(`Initialization time: ${after - before}ms`);
    hasInitSemaphore.release();
  });

  await hasInitSemaphore.runExclusive(async () => {});
}

export const QuartoYamlEditorTools = {
  // helpers to facilitate repro'ing in the browser
  getAutomation: function (
    params: { context: YamlIntelligenceContext; kind: AutomationKind },
  ) {
    const {
      context,
      kind,
    } = params;
    return getAutomation(kind, context);
  },
  exportSmokeTest,

  getCompletions: async function (
    context: YamlIntelligenceContext,
    path: string,
  ) {
    try {
      await initAutomation(path);
      return await getAutomation("completions", context);
    } catch (e) {
      console.log("Error found during autocomplete", e);
      exportSmokeTest("completions", context);
      return null;
    }
  },

  getLint: async function (context: YamlIntelligenceContext, path: string) {
    try {
      await initAutomation(path);
      return await getAutomation("validation", context);
    } catch (e) {
      console.log("Error found during linting", e);
      exportSmokeTest("validation", context);
      return null;
    }
  },
};
