import { RenderContext } from "../../command/render/types.ts";
import { HandlerContext, LanguageHandler, PandocIncludeType } from "./types.ts";
import { breakQuartoMd } from "../break-quarto-md.ts";
import { asMappedString } from "../mapped-text.ts";

const handlers: Record<string, LanguageHandler> = {};

export function install(language: string, handler: LanguageHandler) {
  handlers[language] = handler;
}

function makeHandlerContext(
  _renderContext: RenderContext,
): HandlerContext {
  return {
    format: "html",
    addResource(_name: string, _contents: string) {
    },
    addInclude(_content: string, _where: PandocIncludeType) {
    },
  };
}

// returns a transformed render context
// with changed markdown prior to passing it to engines etc.
export async function handleRenderContext(
  plainRender: RenderContext,
): Promise<RenderContext> {
  debugger;

  const handler = makeHandlerContext(plainRender);
  const mdCells =
    (await breakQuartoMd(asMappedString(plainRender.target.markdown), false))
      .cells;
  const newCells: string[] = [];
  const languageCellsPerLanguage: Record<
    string,
    { index: number; source: string }[]
  > = {};

  for (let i = 0; i < mdCells.length; ++i) {
    const cell = mdCells[i];
    newCells.push(cell.sourceVerbatim.value);
    if (
      cell.cell_type === "math" ||
      cell.cell_type === "raw" ||
      cell.cell_type === "markdown"
    ) {
      continue;
    }
    const language = cell.cell_type.language;
    if (handlers[language] === undefined) {
      continue;
    }
    if (languageCellsPerLanguage[language] === undefined) {
      languageCellsPerLanguage[language] = [];
    }
    languageCellsPerLanguage[language].push({
      index: i,
      source: cell.source.value,
    });
  }
  for (const [language, cells] of Object.entries(languageCellsPerLanguage)) {
    const languageHandler = handlers[language]!;
    const transformedCells = languageHandler.document(
      handler,
      cells.map((cell) => cell.source),
    );
    for (let i = 0; i < transformedCells.length; ++i) {
      newCells[cells[i].index] = transformedCells[i];
    }
  }

  const newTarget = await plainRender.target.refreshTarget(newCells.join("\n"));
  return {
    ...plainRender,
    target: newTarget,
  };
}
