/*
 * yaml-intelligence.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import {
  AutomationKind,
  PositionKind,
  YamlIntelligenceContext,
} from "./types.ts";

import { buildTreeSitterAnnotation, locateCursor } from "./annotated-yaml.ts";

import {
  attemptParsesAtLine,
  getTreeSitter,
  getYamlPredecessors,
  locateFromIndentation,
} from "./parsing.ts";

import { initState, setInitializer } from "../yaml-validation/state.ts";

import { guessChunkOptionsFormat } from "../guess-chunk-options-format.ts";
import { asMappedString, MappedString, mappedString } from "../mapped-text.ts";
import { lineColToIndex, lines } from "../text.ts";
import { breakQuartoMd, QuartoMdCell } from "../break-quarto-md.ts";
import { rangedLines } from "../ranged-text.ts";
import {
  kLangCommentChars,
  partitionCellOptionsText,
} from "../partition-cell-options.ts";

import {
  expandAliasesFrom,
  schemaAccepts,
  setSchemaDefinition,
} from "../yaml-validation/schema.ts";

import { withValidator } from "../yaml-validation/validator-queue.ts";

import { navigateSchemaByInstancePath as navigateSchema } from "../yaml-validation/schema-navigation.ts";

import { resolveSchema } from "../yaml-validation/resolve.ts";

import {
  schemaCompletions,
  walkSchema,
} from "../yaml-validation/schema-utils.ts";

import { mappedIndexToLineCol } from "../mapped-text.ts";

import { lineOffsets } from "../text.ts";

import {
  ArraySchema,
  Completion,
  ConcreteSchema,
  LocalizedError,
  ObjectSchema,
  Schema,
  schemaType,
} from "../yaml-schema/types.ts";
import { getFormatAliases } from "../yaml-schema/format-aliases.ts";
import { getFrontMatterSchema } from "../yaml-schema/front-matter.ts";
import { getEngineOptionsSchema } from "../yaml-schema/chunk-metadata.ts";
import {
  getExtensionConfigSchema,
  getProjectConfigSchema,
} from "../yaml-schema/project-config.ts";
import {
  getYamlIntelligenceResource,
  setYamlIntelligenceResources,
} from "./resources.ts";
import { loadDefaultSchemaDefinitions } from "../yaml-schema/definitions.ts";
import { patchMarkdownDescriptions } from "./descriptions.ts";
import { hover } from "./hover.ts";

interface IDEContext {
  formats: string[];
  project_formats: string[];
  line: string;
  position: {
    row: number;
    column: number;
  };
  client?: string;
  explicit?: boolean;
}

interface CompletionContext {
  schema: Schema;
  path: (number | string)[];
  word: string;
  indent: number;
  commentPrefix: string;
  context: IDEContext;
  completionPosition?: "key" | "value";
  positionKind: PositionKind;
}

interface ValidationResult {
  "start.row": number;
  "start.column": number;
  "end.row": number;
  "end.column": number;
  "text": string;
  "type": string;
}

function getTagValue(schema: Schema, tag: string): unknown | undefined {
  if (schema === true || schema === false) {
    return undefined;
  }
  return schema.tags && schema.tags[tag];
}

function positionInTicks(context: YamlIntelligenceContext) {
  // This calls lines() somewhat superfluously
  const code = asMappedString(context.code);
  const {
    position,
  } = context;

  // breakQuartoMd can produce an extra line at the end of the yaml front matter.
  const trimCode = code.value.trimEnd();
  const codeLines = lines(trimCode);
  return (code.value.startsWith("---") &&
    (position.row === 0)) ||
    (trimCode.endsWith("---") &&
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

export async function validationFromGoodParseYAML(
  context: YamlIntelligenceContext,
): Promise<ValidationResult[]> {
  const code = asMappedString(context.code); // full contents of the buffer

  const result = await withValidator(context.schema!, async (validator) => {
    const parser = await getTreeSitter();

    for (const parseResult of attemptParsesAtLine(context, parser) || []) {
      const lints = [];
      const {
        parse: tree,
        code: mappedCode,
      } = parseResult;
      const annotation = buildTreeSitterAnnotation(tree, mappedCode);
      if (annotation === null) {
        continue;
      }
      const validationResult = await validator.validateParse(code, annotation);
      const errorsBySpan: Record<string, LocalizedError> = {};
      const spanString = (e: LocalizedError): string =>
        `${e.location.start.line}-${e.location.start.column}-${e.location.end.line}-${e.location.end.column}`;

      for (const error of validationResult.errors) {
        const key = spanString(error);
        // only show one error per span
        if (errorsBySpan[key] === undefined) {
          errorsBySpan[key] = error;
        }
      }
      for (const [_key, error] of Object.entries(errorsBySpan)) {
        let text;
        if (error.niceError && error.niceError.heading) {
          // use a new nice error if available
          text = error.niceError.heading;
          if (error.niceError.info["did-you-mean-key"]) {
            text = text + " (" + error.niceError.info["did-you-mean-key"] + ")";
          } else if (error.niceError.info["did-you-mean-value"]) {
            text = text + " (" + error.niceError.info["did-you-mean-value"] +
              ")";
          }
          if (error.niceError.info["suggestion-fix"]) {
            text = text + " (" + error.niceError.info["suggestion-fix"] + ")";
          }
        } else {
          // default to standard error message otherwise
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

  if (code.value === "") {
    return [];
  }
  const locF = mappedIndexToLineCol(code);

  // ignore bad lookups (from empty lines at the end of file)
  const ls = Array
    .from(lineOffsets(code.value))
    .map((offset) => {
      try {
        return locF(offset).line;
      } catch (_e) {
        return undefined;
      }
    }).filter((x) => x !== undefined);

  const toOriginSourceLines = (targetSourceLine: number) =>
    ls[targetSourceLine];

  const predecessors = getYamlPredecessors(
    code.value,
    context.position.row - 1,
  ).map(toOriginSourceLines);

  // keep only the lints that are not in the predecessor path of the cursor
  if (context.explicit === undefined) {
    return result;
  }
  if (!context.explicit) {
    return result.filter((lint) =>
      predecessors.indexOf(lint["start.row"]) === -1
    );
  } else {
    return result;
  }
}

async function completionsFromGoodParseYAML(context: YamlIntelligenceContext) {
  const {
    line, // editing line up to the cursor
    position, // row/column of cursor (0-based)
    schema, // schema of yaml object
  } = context;

  const positionKind = context.positionKind || "metadata";

  // if this is a yaml inside a language chunk, it will have a
  // comment prefix which we need to know about in order to
  // autocomplete linebreaks correctly.
  const commentPrefix = context.commentPrefix || "";

  const parser = await getTreeSitter();
  let word = "";
  if (line.slice(-1) !== ":") {
    // take the last word after spaces
    word = line.split(" ").slice(-1)[0];
  }

  if (line.trim().length === 0) {
    // we're in a pure-whitespace line, we should locate entirely based on indentation
    const path = locateFromIndentation(context);
    const indent = line.length;
    const rawCompletions = completions({
      schema: schema!,
      path,
      word,
      indent,
      commentPrefix,
      context,
      completionPosition: "key",
      positionKind,
    });
    return rawCompletions;
  }
  const indent = line.trimEnd().length - line.trim().length;

  const completeEmptyLineOnIndentation = (
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
    const rawCompletions = completions({
      schema: schema!,
      path,
      word,
      indent,
      commentPrefix,
      context,
      completionPosition: "key",
      positionKind,
    });
    return rawCompletions;
  };
  // are we in a whitespace span before the end of the line?
  // if so, we should adjust the column position inwards
  // to the start of the whitespace span.
  const trimEnd = line.trimEnd();
  const trimEndCorrection = (position.column - 1) >= trimEnd.length
    ? line.length - trimEnd.length
    : 0;

  for (const parseResult of attemptParsesAtLine(context, parser)) {
    const {
      parse: tree,
      code: mappedCode,
      deletions,
    } = parseResult;
    const lineAfterDeletions = line.substring(0, line.length - deletions);

    if (lineAfterDeletions.trim().length === 0) {
      const result = completeEmptyLineOnIndentation(
        deletions,
        mappedCode,
      );
      return result;
    } else {
      const doc = buildTreeSitterAnnotation(tree, mappedCode);
      if (doc === null) {
        continue;
      }
      const index = lineColToIndex(mappedCode.value)({
        line: position.row,
        column: position.column - deletions - trimEndCorrection,
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

      const completionOnValuePosition = line.indexOf(":") !== -1;
      const completionOnArraySequence = line.indexOf("-") === -1;

      const rawCompletions = completions({
        schema: schema!,
        path,
        word,
        indent,
        commentPrefix,
        context,
        // filter raw completions depending on cursor context. We use "_" to denote
        // the cursor position. We need to handle:
        //
        // 1. "     _": empty line
        // 2. "     foo: _": completion on value position of object
        // 3. "     - _": completion on array sequence
        // 4. "     - foo: ": completion on value position of object inside array sequence
        // 5. "     foo_": completion on key position in partially-completed word
        //
        // case 1 was handled upstream of this, so we don't need to handle it here
        // cases 2 and 4 take only value completions
        // case 3 takes all completions, so no work is needed
        completionPosition: completionOnValuePosition // this picks up cases 2 and 4
          ? "value"
          : completionOnArraySequence // this picks up case 5 (and 1, but case one was already handled.)
          ? "key"
          : undefined,
        positionKind,
      });
      // never followup a suggestion in value position
      if (completionOnValuePosition) {
        rawCompletions.completions = rawCompletions.completions.map((c) => ({
          ...c,
          suggest_on_accept: false,
        }));
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
  cacheable: false,
};

// a minimal uniqBy implementation so we don't need to pull in
// the entirety of lodash.
//
// if keyFun returns undefined, elements are considered unique
function uniqBy<T>(lst: T[], keyFun: (item: T) => string | undefined): T[] {
  const itemSet = new Set<string>();
  return lst.filter((item) => {
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

// Currently, the only special case we have is for "execute-only" tags
// in paths that don't start with execute in yaml metadata completions
function dropCompletionsFromSchema(
  obj: CompletionContext,
  completion: Completion,
) {
  const matchingSchema = resolveSchema(completion.schema!);
  const {
    path,
    positionKind,
  } = obj;

  if (positionKind === "code-cell") {
    return false;
  }
  if (completion.type === "value") {
    return false;
  }
  // drop ": " from the key completion
  const subPath = [completion.value.slice(0, -2)];

  const matchingSubSchemas = navigateSchema(matchingSchema, subPath);
  if (matchingSubSchemas.length === 0) {
    return false;
  }

  const executeOnly = matchingSubSchemas.every((s: Schema) =>
    s !== false && s !== true &&
    s.tags && s.tags["execute-only"]
  );
  if (path.length > 0 && path[0] === "execute") {
    // don't complete on schemas that do not have "execute-only" but
    // paths that start on path fragments of "execute"
    return !executeOnly;
  } else {
    // don't complete on schemas that have "execute-only" but
    // paths that start on path fragments other than "execute"
    return executeOnly;
  }
}

function completions(obj: CompletionContext): CompletionResult {
  const {
    schema,
    indent,
    commentPrefix,
    context,
    completionPosition,
  } = obj;
  let word = obj.word;
  let path = obj.path;
  const maybeSchemaId = (schema: Schema) => {
    if (schema === true || schema === false) {
      return "";
    } else {
      return schema.$id;
    }
  };

  let matchingSchemas = uniqBy(
    navigateSchema(schema, path),
    maybeSchemaId,
  );
  if (matchingSchemas.length === 0) {
    // attempt to match against partial word
    const candidateSchemas = uniqBy(
      navigateSchema(schema, path.slice(0, -1), word !== ""),
      maybeSchemaId,
    );
    if (candidateSchemas.length === 0) {
      return {
        token: word,
        completions: [],
        cacheable: true,
      };
    } else {
      // found a match: crop path and go on.
      matchingSchemas = candidateSchemas;
      word = String(path[path.length - 1]);
      path = path.slice(0, -1);
      obj = {
        ...obj,
        word,
        path,
      };
    }
  }

  const aliases = getFormatAliases();
  const formats = [
    ...Array.from(context.formats),
    ...Array.from(context.project_formats),
    // keep only pandoc valid formats here
  ].filter((x) => aliases["pandoc-all"].indexOf(x) !== -1);

  // indent mappings and sequences automatically
  let completions = matchingSchemas.map((schema) => {
    const result = schemaCompletions(schema);
    // in case you're wondering why we filter on completion.schema
    // here rather than on schema a few lines above, that's because
    // schema combinators need to be resolved to the actual schemas
    // with completions before we can extract tags and use them. Consider
    // that schema can be
    //
    // anyOf:
    //   - some-schema-without-tags
    //   - some-schema-with-tags
    //
    // and some completion.schema will hold some-schema-with-tags
    // (and other will hold some-schema-without-tags). We need to
    // decide to drop on the inner, "specific" schemas.
    const keptCompletions = result
      .filter((completion) => !dropCompletionsFromSchema(obj, completion));

    return keptCompletions.map((completion) => {
      // we only change indentation on keys
      if (
        !completion.suggest_on_accept ||
        completion.type === "value" ||
        !schemaAccepts(completion.schema!, "object")
      ) {
        return completion;
      }

      const key = completion.value.split(":")[0];
      const matchingSubSchemas = navigateSchema(completion.schema, [key]);

      // the following rule is correct and necessary, but quite
      // ugly.
      //
      // The idea is we never want to set `suggest_on_accept: true` on a
      // completion that can ask for more than one type. This can
      // occur in two types of situations.
      //
      // First, the matching subschema itself can have more than one type of completion
      // (scalar, object, or array). Second, if the completion is in an array,
      // then we need to check if the array item schema itself is valid

      const canSuggestOnAccept = (ss: Schema): boolean => {
        const matchingTypes: Set<string> = new Set();

        walkSchema(ss, (s) => {
          const t = schemaType(s);
          switch (t) {
            case "object":
              matchingTypes.add("object");
              return true;
            case "array":
              matchingTypes.add("array");
              return true;
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

        const arraySubSchemas: ArraySchema[] = [];
        // now find all array subschema to recurse on
        walkSchema(ss, {
          "array": (s: ArraySchema) => {
            arraySubSchemas.push(s);
            return true;
          },
          "object": (_: ObjectSchema) => true,
        });
        return arraySubSchemas.every((s) => {
          if (s.items === undefined) {
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
          value: completion.value,
        };
      }

      if (
        matchingSubSchemas.some((subSchema: Schema) =>
          schemaAccepts(subSchema, "object")
        )
      ) {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix +
            " ".repeat(indent + 2),
        };
      } else if (
        matchingSubSchemas.some((subSchema: Schema) =>
          schemaAccepts(subSchema, "array")
        )
      ) {
        return {
          ...completion,
          value: completion.value + "\n" + commentPrefix +
            " ".repeat(indent + 2) + "- ",
        };
      } else {
        return completion;
      }
    });
  }).flat();
  completions = completions.filter((c) => c.value.startsWith(word));
  completions = completions.filter((c) => {
    if (c.type === "value") {
      return !(c.schema && getTagValue(c.schema, "hidden"));
    } else if (c.type === "key") {
      const key = c.value.split(":")[0];
      const matchingSubSchemas = navigateSchema(c.schema, [key]);
      if (matchingSubSchemas.length === 0) {
        return true;
      }
      return !(matchingSubSchemas.every((s) => getTagValue(s, "hidden")));
    } else {
      // should never get here.
      return true;
    }
  });
  completions = completions.filter((c) => {
    if (formats.length === 0) {
      // don't filter on tags if there's no detected formats anywhere.
      return true;
    }
    // handle format-enabling and -disabling tags
    let formatTags: string[] = [];
    if (c.type === "key") {
      // c.schema is known to be an object here.
      const objSchema = c.schema as ObjectSchema;
      let value = objSchema.properties && objSchema.properties[c.display];
      if (value === undefined) {
        for (const key of Object.keys(objSchema.patternProperties || {})) {
          const regexp = new RegExp(key);
          if (c.display.match(regexp)) {
            value = objSchema.patternProperties![key];
            break;
          }
        }
      }
      if (value === undefined) {
        // can't follow the schema to check tags in key context;
        // don't hide
        return true;
      }
      formatTags = (getTagValue(value, "formats") as string[]) || [];
    } else if (c.type === "value") {
      formatTags = (c.schema && getTagValue(c.schema, "formats") as string[]) ||
        [];
    } else {
      // weird completion type?
      return false;
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
  });
  completions = completions.map((c) => {
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

  if (completionPosition) {
    completions = completions.filter((c) => c.type === completionPosition);
  }

  // uniqBy the final completions array on their completion values.

  completions = uniqBy(completions, (completion) => completion.value);

  // if there's exactly a colon before the cursor, add a space to the value completions
  if (context.line[context.position.column - 1] === ":") {
    for (const completion of completions) {
      completion.value = " " + completion.value;
    }
  }
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

  const result = await breakQuartoMd(
    asMappedString(context.code),
    undefined,
    true,
  );

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
    debugger;
    let foundCell = undefined;
    for (const cell of result.cells) {
      // use sourceWithYaml when it exists (code cells)
      // but otherwise use cell.source (metadata cells)
      const size = lines((cell.sourceWithYaml || cell.source).value).length;
      if (size + cell.cellStartLine > position.row) {
        foundCell = cell;
        break;
      }
    }
    if (foundCell === undefined) {
      return noCompletions;
    }
    if (foundCell.cell_type === "raw") {
      const schema = await getFrontMatterSchema();
      // complete the yaml front matter
      context = {
        ...context,
        line,
        position,
        schema,
        code: foundCell.source,
        schemaName: "front-matter",
        positionKind: "metadata",
      };
      // user asked for autocomplete on "---": report none
      if (positionInTicks(context)) {
        return noCompletions;
      }
      context = trimTicks(context);

      return automationFromGoodParseYAML(kind, context);
    } else if (foundCell.cell_type === "markdown") {
      // we're inside a markdown, no completions
      return noCompletions;
    } else if (foundCell.cell_type.language) {
      // complete the yaml inside a cell
      return automationFromGoodParseScript(kind, {
        ...context,
        language: foundCell.cell_type.language,
        code: foundCell.sourceWithYaml!,
        position: {
          row: position.row - foundCell.cellStartLine,
          column: position.column,
        },
        line,
        positionKind: "code-cell",
      });
    } else {
      // do not complete what we do not understand
      return noCompletions;
    }
  } else {
    // TODO the logic here is pretty similar to the one in completions, but
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
            schema: await getFrontMatterSchema(),
            schemaName: "front-matter",
            line,
            position, // we don't need to adjust position because front matter only shows up at start of file.
            positionKind: "metadata",
          }),
        ) as ValidationResult[];
        lints.push(...innerLints);
      } else if (cell.cell_type === "markdown") {
        // nothing to lint in markdown cells
        continue;
      } else if (cell.cell_type.language) {
        if (cell.cell_type.language === "_directive") {
          return noIntelligence(kind);
        }
        const innerLints = await automationFromGoodParseScript(kind, {
          ...context,
          filetype: "script",
          code: cell.sourceWithYaml!,
          language: cell.cell_type.language,
          line,
          position: {
            ...position,
            row: position.row - (linesSoFar + 1),
          },
          positionKind: "code-cell",
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
    return noIntelligence(kind);
  }

  const func = kind === "completions"
    ? completionsFromGoodParseYAML
    : validationFromGoodParseYAML;
  return func(context);
}

async function automationFromGoodParseScript(
  kind: AutomationKind,
  context: YamlIntelligenceContext,
): Promise<CompletionResult | ValidationResult[]> {
  if (context.language === "_directive") {
    return noIntelligence(kind);
  }
  const codeLines = rangedLines(asMappedString(context.code).value);
  let language;
  let codeStartLine;

  if (!context.language) {
    if (codeLines.length < 2) {
      // need both language and code to autocomplete. length < 2 implies
      // we're missing one of them at least: skip.
      return noIntelligence(kind);
    }
    const m = codeLines[0].substring.match(/.*{([a-z]+)\s*.*}/);
    if (!m) {
      // couldn't recognize language in script, return no intelligence
      return noIntelligence(kind);
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
  } = partitionCellOptionsText(language, mappedCode);

  if (yaml === undefined) {
    return noIntelligence(kind);
  }

  const engines = await getEngineOptionsSchema();
  const schema = engines[context.engine || "markdown"];
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
      return automationFromGoodParseYAML(kind, {
        ...context,
        positionKind: "metadata",
      });
    case "script":
      return automationFromGoodParseScript(kind, {
        ...context,
        positionKind: "code-cell",
      });
    default:
      return null;
  }
}

function exportSmokeTest(
  kind: AutomationKind | "hover",
  context: YamlIntelligenceContext,
) {
  console.error(JSON.stringify({ kind, context }, null, 2));
}

const determineSchema = async (context: YamlIntelligenceContext): Promise<{
  schema: ConcreteSchema | undefined;
  schemaName: string | undefined;
}> => {
  const extension = context.path === null
    ? ""
    : (context.path.split(".").pop() || "");

  if (context.filetype !== "yaml") {
    return {
      schema: undefined,
      schemaName: undefined,
    };
  }

  if (extension === "qmd") {
    const frontMatterSchema = await getFrontMatterSchema();
    return {
      schema: frontMatterSchema,
      schemaName: "front-matter",
    };
  }
  const extensionConfigNames = [
    "_extension.yml",
    "_extension.yaml",
  ];
  if (
    context.path &&
    extensionConfigNames.some((name) => context.path!.endsWith(name))
  ) {
    const extensionConfigSchema = await getExtensionConfigSchema();
    return {
      schema: extensionConfigSchema,
      schemaName: "extension-config",
    };
  } else {
    const projectConfigSchema = await getProjectConfigSchema();
    return {
      schema: projectConfigSchema,
      schemaName: "project-config",
    };
  }
};

export async function getAutomation(
  kind: AutomationKind,
  context: YamlIntelligenceContext,
) {
  const {
    schema,
    schemaName,
  } = await determineSchema(context);

  const result = await automationFileTypeDispatch(context.filetype, kind, {
    ...context,
    code: asMappedString(context.code),
    schema,
    schemaName,
  });

  return result || null;
}

export async function initYamlIntelligence(obj: {
  resourceModule: Record<string, unknown>;
  patchMarkdown?: boolean;
}) {
  const {
    resourceModule,
    patchMarkdown,
  } = obj;
  setYamlIntelligenceResources(resourceModule);

  await loadDefaultSchemaDefinitions();

  // call all of these to add them to the definitions list so
  // the markdown translation patching is done in the correct order.
  // NOTE the order here needs to match the order on build-schema-file.ts:buildIntelligenceResources()
  getFormatAliases();
  await getFrontMatterSchema();
  await getProjectConfigSchema();
  await getEngineOptionsSchema();

  for (
    const schema of getYamlIntelligenceResource(
      "schema/external-schemas.yml",
    ) as ConcreteSchema[]
  ) {
    setSchemaDefinition(schema);
  }

  try {
    const extendedLangCommentChars: Record<string, string | [string, string]> =
      getYamlIntelligenceResource(
        "handlers/lang-comment-chars.yml",
      ) as Record<string, string | [string, string]>;
    for (
      const [lang, comment] of Object.entries(extendedLangCommentChars)
    ) {
      kLangCommentChars[lang] = comment;
    }
  } catch (_e) {
    // empty, we're catching getYamlIntelligenceResource's exception here
    // in the case we're bootstrapping the yamlIntelligenceResource file.
    console.warn(`"handlers/lang-comment-chars.yml" not found.
initialization does not contain language extensions`);
  }

  if (patchMarkdown === undefined || patchMarkdown) {
    patchMarkdownDescriptions();
  }
}

const noIntelligence = (kind: string) => {
  if (kind === "completions") {
    return noCompletions;
  } else {
    return [];
  }
};

async function init(
  context: YamlIntelligenceContext,
) {
  const ideInit = async () => {
    const resourceModule = (await import(
      "../../../resources/editor/tools/yaml/yaml-intelligence-resources.json",
      { assert: { type: "json" } }
    )).default as Record<string, unknown>;

    await getTreeSitter();

    if (context.client && context.client === "lsp") {
      await initYamlIntelligence({ resourceModule, patchMarkdown: false });
    } else {
      await initYamlIntelligence({ resourceModule });
    }
  };
  setInitializer(ideInit);
  await initState();
}

export async function getCompletions(
  context: YamlIntelligenceContext,
  _path: string,
) {
  try {
    await init(context);
    return await getAutomation("completions", context);
  } catch (e) {
    console.log("Error found during autocomplete", e);
    exportSmokeTest("completions", context);
    return null;
  }
}

export async function getLint(
  context: YamlIntelligenceContext,
  _path: string,
) {
  try {
    await init(context);
    return await getAutomation("validation", context);
  } catch (e) {
    console.log("Error found during linting", e);
    exportSmokeTest("validation", context);
    return null;
  }
}

export async function getHover(
  context: YamlIntelligenceContext,
  _path: string,
) {
  try {
    await init(context);
    return hover(context);
  } catch (e) {
    console.log("Error found during hover", e);
    exportSmokeTest("hover", context);
    return null;
  }
}
