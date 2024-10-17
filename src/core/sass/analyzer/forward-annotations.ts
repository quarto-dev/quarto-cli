import { annotateNode } from "./ast-utils.ts";

export const forwardAnnotations = (ast: any) => {
  const pragmaAnnotation = "quarto-scss-analysis-annotation";
  const annotationStack: Record<string, string>[] = [{}];
  let currentAnnotation: Record<string, unknown> = annotationStack[0];
  let hasAnnotations: boolean = false;
  for (const node of ast.children) {
    if (node.type === "comment_singleline") {
      const value = node?.value?.trim();
      if (value.startsWith(pragmaAnnotation)) {
        let payload: Record<string, any> = {};
        try {
          payload = JSON.parse(value.slice(pragmaAnnotation.length).trim());
        } catch (e) {
          console.error("Could not parse annotation payload", e);
          continue;
        }
        if (payload.action === "push") {
          annotationStack.push(JSON.parse(JSON.stringify(currentAnnotation)));
          currentAnnotation = annotationStack[annotationStack.length - 1];
        } else if (payload.action === "pop" && annotationStack.length) {
          annotationStack.pop();
          currentAnnotation = annotationStack[annotationStack.length - 1];
        }

        for (const [key, value] of Object.entries(payload)) {
          if (key === "action") {
            continue;
          }
          if (value === null) {
            delete currentAnnotation[key];
          } else {
            currentAnnotation[key] = value;
          }
        }
        hasAnnotations = Object.keys(currentAnnotation).length > 0;
      }
    }
    if (node.type === "declaration" && hasAnnotations) {
      annotateNode(node, currentAnnotation);
    }
  }
  return ast;
};
