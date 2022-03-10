export type PandocIncludeType = "beforeBody" | "afterBody" | "inHeader";

export interface HandlerContext {
  format: string;
  addResource: (name: string, contents: string) => void;
  addInclude: (content: string, where: PandocIncludeType) => void;
}

export const baseHandler = {
  // if document() is overridden, then it's the only
  // method that will be called.
  document(
    handlerContext: HandlerContext,
    cells: string[],
  ): string[] {
    this.documentStart(handlerContext);
    const result = cells.map((cell) => this.cell(handlerContext, cell));
    this.documentEnd(handlerContext);
    return result;
  },

  // called once per document, no cells in particular
  documentStart(
    _handlerContext: HandlerContext,
  ) {
  },

  documentEnd(
    _handlerContext: HandlerContext,
  ) {
  },

  cell(
    _handlerContext: HandlerContext,
    cell: string,
  ): string {
    return cell;
  },
};

export type LanguageHandler = typeof baseHandler;
