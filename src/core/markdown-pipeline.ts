/*
 * markdown-pipeline.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { Document, Element, Node } from "./deno-dom.ts";

export interface PipelineMarkdown {
  blocks?: Record<string, string>;
  inlines?: Record<string, string>;
}

export interface MarkdownPipelineHandler {
  getUnrendered: () => PipelineMarkdown | undefined;
  processRendered: (rendered: Record<string, Element>, doc: Document) => void;
}

export interface MarkdownPipeline {
  markdownAfterBody(): string;
  readMarkdown(doc: Document): Record<string, Element>;
  processRenderedMarkdown(doc: Document): void;
}

export const createMarkdownPipeline = (
  envelopeId: string,
  handlers: MarkdownPipelineHandler[],
): MarkdownPipeline => {
  return {
    markdownAfterBody() {
      const pipelineMarkdown: PipelineMarkdown = {};
      handlers.forEach((handler) => {
        const handlerPipelineMarkdown = handler.getUnrendered();
        if (handlerPipelineMarkdown) {
          const inlines = handlerPipelineMarkdown.inlines;
          if (inlines) {
            pipelineMarkdown.inlines = pipelineMarkdown.inlines || {};
            for (const key of Object.keys(inlines)) {
              pipelineMarkdown.inlines[key] = inlines[key];
            }
          }
          const blocks = handlerPipelineMarkdown.blocks;
          if (blocks) {
            pipelineMarkdown.blocks = pipelineMarkdown.blocks || {};
            for (const key of Object.keys(blocks)) {
              pipelineMarkdown.blocks[key] = blocks[key];
            }
          }
        }
      });
      return createMarkdownRenderEnvelope(envelopeId, pipelineMarkdown);
    },
    readMarkdown(doc: Document) {
      return readEnvelope(doc, envelopeId);
    },
    processRenderedMarkdown(doc: Document) {
      processMarkdownRenderEnvelope(
        doc,
        envelopeId,
        handlers.map((handler) => {
          return handler.processRendered;
        }),
      );
    },
  };
};

export function createMarkdownRenderEnvelope(
  envelopeId: string,
  pipelineMarkdown: PipelineMarkdown,
) {
  const envelope = markdownEnvelopeWriter(envelopeId);
  if (pipelineMarkdown.inlines) {
    for (const key of Object.keys(pipelineMarkdown.inlines)) {
      envelope.addInline(key, pipelineMarkdown.inlines[key]);
    }
  }
  if (pipelineMarkdown.blocks) {
    for (const key of Object.keys(pipelineMarkdown.blocks)) {
      envelope.addBlock(key, pipelineMarkdown.blocks[key]);
    }
  }
  return envelope.toMarkdown();
}

export function processMarkdownRenderEnvelope(
  doc: Document,
  envelopeId: string,
  processors: Array<
    (renderedMarkdown: Record<string, Element>, doc: Document) => void
  >,
) {
  const renderedMarkdown = readEnvelope(doc, envelopeId);
  processors.forEach((processor) => {
    processor(renderedMarkdown, doc);
  });
}

const markdownEnvelopeWriter = (envelopeId: string) => {
  const renderList: string[] = [];
  const hiddenSpan = (id: string, contents: string) => {
    return `[${contents}]{.hidden .markdown-pipeline render-id="${id}"}`;
  };

  const hiddenDiv = (id: string, contents: string) => {
    return `\n:::{.hidden .markdown-pipeline render-id="${id}"}\n${contents}\n:::\n`;
  };

  return {
    addBlock: (id: string, value: string) => {
      renderList.push(hiddenDiv(id, value));
    },
    addInline: (id: string, value: string) => {
      renderList.push(hiddenSpan(id, value));
    },
    toMarkdown: () => {
      const contents = renderList.join("\n");
      return `\n:::{#${envelopeId} .hidden}\n${contents}\n:::\n`;
    },
  };
};

const readEnvelope = (doc: Document, envelopeId: string) => {
  const envelope = doc.getElementById(envelopeId);
  const contents: Record<string, Element> = {};
  const addContent = (node: Node) => {
    const el = node as Element;
    const id = el.getAttribute("data-render-id");
    if (id) {
      contents[id] = el;
    }
  };

  if (envelope) {
    const blockNodes = envelope.querySelectorAll("div[data-render-id]");
    blockNodes.forEach((blockNode) => {
      addContent(blockNode);
    });

    const inlineNodes = envelope.querySelectorAll("span[data-render-id]");
    inlineNodes.forEach((inlineNode) => {
      addContent(inlineNode);
    });

    envelope.remove();
  }

  return contents;
};
