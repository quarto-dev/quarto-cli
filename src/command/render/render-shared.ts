import {
  projectContext,
  projectContextForDirectory,
} from "../../project/project-context.ts";
import { renderProject } from "./project.ts";
import { renderFiles } from "./render.ts";
import { RenderOptions, RenderResult } from "./types.ts";

export async function render(
  path: string,
  options: RenderOptions,
): Promise<RenderResult> {
  // determine target context/files
  const context = await projectContext(path);

  if (Deno.statSync(path).isDirectory) {
    // if the path is a sub-directory of the project, then create
    // a files list that is only those files in the subdirectory
    let files: string[] | undefined;
    if (context) {
      const renderDir = Deno.realPathSync(path);
      const projectDir = Deno.realPathSync(context.dir);
      if (renderDir !== projectDir) {
        files = context.files.input.filter((file) =>
          file.startsWith(renderDir)
        );
      }
    }

    // all directories are considered projects
    return renderProject(
      context || await projectContextForDirectory(path),
      options,
      files,
    );
  } else if (context?.config) {
    // if there is a project file then treat this as a project render
    // if the passed file is in the render list
    const renderPath = Deno.realPathSync(path);
    if (
      context.files.input.map((file) => Deno.realPathSync(file)).includes(
        renderPath,
      )
    ) {
      return renderProject(context, options, [path]);
    }
  }

  // otherwise it's just a file render
  const result = await renderFiles([path], options);
  return {
    files: result.files.map((result) => {
      return {
        input: result.input,
        markdown: result.markdown,
        format: result.format,
        file: result.file,
        supporting: result.supporting,
        resourceFiles: [],
      };
    }),
    error: result.error,
  };
}
