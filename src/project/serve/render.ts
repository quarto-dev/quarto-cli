import { isAbsolute, join } from "path/mod.ts";

import { RenderResult } from "../../command/render/types.ts";
import { md5Hash } from "../../core/hash.ts";
import { PromiseQueue } from "../../core/promise.ts";
import { projectOutputDir } from "../project-shared.ts";
import { ProjectContext } from "../types.ts";

export class ServeRenderManager {
  public renderQueue() {
    return this.renderQueue_;
  }

  public fileRequiresReRender(
    file: string,
    inputFile: string,
    resourceFiles: string[],
    project: ProjectContext,
  ) {
    const lastRenderHash = this.fileRenders_.get(file);
    if (lastRenderHash) {
      return lastRenderHash !==
        this.fileRenderHash(file, inputFile, resourceFiles, project);
    } else {
      return true;
    }
  }

  public onRenderResult(
    result: RenderResult,
    resourceFiles: string[],
    project: ProjectContext,
  ) {
    const outputDir = projectOutputDir(project);
    result.files.forEach((resultFile) => {
      const file = isAbsolute(resultFile.file)
        ? resultFile.file
        : join(outputDir, resultFile.file);
      const inputFile = isAbsolute(resultFile.input)
        ? resultFile.input
        : join(project.dir, resultFile.input);
      this.fileRenders_.set(
        file,
        this.fileRenderHash(
          file,
          inputFile,
          resourceFiles,
          project,
        ),
      );
    });
  }

  private fileRenderHash(
    file: string,
    inputFile: string,
    resourceFiles: string[],
    project: ProjectContext,
  ) {
    const resourceHash = [
      file,
      inputFile,
      ...resourceFiles,
      ...(project.files.config || []),
      ...(project.files.configResources || []),
      ...(project.files.resources || []),
    ].reduce((hash, file) => {
      try {
        return hash + Deno.statSync(file).mtime?.toUTCString();
      } catch {
        return hash;
      }
    }, "");
    return md5Hash(Deno.readTextFileSync(file)) +
      md5Hash(Deno.readTextFileSync(inputFile)) +
      resourceHash;
  }

  private fileRenders_ = new Map<string, string>();
  private renderQueue_ = new PromiseQueue<RenderResult>();
}
