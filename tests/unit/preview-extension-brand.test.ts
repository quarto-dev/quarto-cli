/*
 * preview-extension-brand.test.ts
 *
 * Tests that project metadata contributed by an extension through
 * `contributes.metadata.project` is merged on a ProjectContext built without
 * RenderOptions, which is how `quarto preview` builds it, and that the render
 * path keeps its own behaviour.
 *
 * The bug: mergeExtensionMetadata() only ran when renderOptions was present,
 * so the contributed `project.brand` never reached project.config.project and
 * the brand was silently ignored during preview (#14783).
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals, assertRejects } from "../asserts.ts";
import { join } from "../../src/deno_ral/path.ts";
import { LightDarkBrandDarkFlag } from "../../src/core/brand/brand.ts";
import { singleFileProjectContext } from "../../src/project/types/single-file/single-file.ts";
import { projectContext } from "../../src/project/project-context.ts";
import { refreshProjectContext } from "../../src/project/serve/watch.ts";
import { refreshPreviewProject } from "../../src/command/preview/preview.ts";
import { getLogger } from "../../src/deno_ral/log.ts";
import { BaseHandler } from "log/base-handler";
import { ProjectContext } from "../../src/project/types.ts";
import { notebookContext } from "../../src/render/notebook/notebook-context.ts";
import { renderServices } from "../../src/command/render/render-services.ts";
import { RenderOptions } from "../../src/command/render/types.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";
import { withTempDir, writeDefaultProject, writeFixture } from "../utils.ts";

const BRAND_YML = `color:
  palette:
    imperial-red: "#BC1E22"
  primary: imperial-red
`;

const DOCUMENT = "---\ntitle: test\nformat: typst\n---\n";

function extensionYml(projectMetadata: string) {
  return `title: Test Extension
author: Test Author
version: 1.0.0
quarto-required: ">=1.4.0"
contributes:
  metadata:
    project:
${projectMetadata}`;
}

// Write an extension contributing the given project metadata, plus the brand
// file that metadata may point at, next to the document under test.
function writeExtension(
  dir: string,
  projectMetadata: string,
  name = "test-extension",
) {
  const extensionDir = `_extensions/${name}`;
  writeFixture(
    dir,
    `${extensionDir}/_extension.yml`,
    extensionYml(projectMetadata),
  );
  writeFixture(dir, `${extensionDir}/brand.yml`, BRAND_YML);
}

// The palette entry is unique to the extension's brand.yml, so asserting it
// proves that this file, and not some fallback, was the one resolved.
function assertContributedBrand(
  brand: LightDarkBrandDarkFlag | undefined,
  context: string,
) {
  assert(
    brand !== undefined,
    `brand contributed by the extension must resolve ${context}`,
  );
  assertEquals(
    brand.light?.data.color?.palette?.["imperial-red"],
    "#BC1E22",
    `the resolved brand must be the one contributed by the extension ${context}`,
  );
}

unitTest(
  "projectResolveBrand - single-file: extension-contributed brand resolves without renderOptions (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const file = join(tmpDir, "test.qmd");
      let project;

      try {
        writeFixture(tmpDir, "test.qmd", DOCUMENT);
        writeExtension(tmpDir, "      brand: brand.yml\n");

        // preview builds the context this way: no renderOptions.
        project = await singleFileProjectContext(file, notebookContext());

        assertContributedBrand(
          await project.resolveBrand(),
          "for a single file",
        );
      } finally {
        // Release the project's disk cache before removing the dir, otherwise
        // Windows holds a lock on the temp directory.
        project?.cleanup?.();
      }
    });
  },
);

unitTest(
  "projectResolveBrand - project (_quarto.yml present): extension-contributed brand resolves without renderOptions (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      let project;

      try {
        writeProject(tmpDir);
        writeExtension(tmpDir, "      brand: brand.yml\n");

        // preview builds the context this way: no renderOptions.
        project = await projectContext(tmpDir, notebookContext());
        assert(
          project !== undefined,
          "projectContext must resolve for a _quarto.yml dir",
        );

        assertContributedBrand(await project.resolveBrand(), "for a project");
      } finally {
        project?.cleanup?.();
      }
    });
  },
);

unitTest(
  "projectResolveBrand - single-file: extension-contributed brand still resolves with renderOptions (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const file = join(tmpDir, "test.qmd");
      const nbContext = notebookContext();
      const services = renderServices(nbContext);
      const renderOptions = { services, flags: {} } as RenderOptions;
      let project;

      try {
        writeFixture(tmpDir, "test.qmd", DOCUMENT);
        writeExtension(tmpDir, "      brand: brand.yml\n");

        // render builds the context this way: renderOptions present.
        project = await singleFileProjectContext(
          file,
          nbContext,
          renderOptions,
        );

        assertContributedBrand(await project.resolveBrand(), "for a render");
      } finally {
        project?.cleanup?.();
        services.cleanup();
      }
    });
  },
);

unitTest(
  "singleFileProjectContext: extension-contributed output-dir forces clean on the render path (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const file = join(tmpDir, "test.qmd");
      const nbContext = notebookContext();
      const services = renderServices(nbContext);
      const renderOptions = { services, flags: {} } as RenderOptions;
      let project;

      try {
        writeFixture(tmpDir, "test.qmd", DOCUMENT);
        writeExtension(tmpDir, '      output-dir: "_out"\n');

        project = await singleFileProjectContext(
          file,
          nbContext,
          renderOptions,
        );

        assertEquals(
          project.config?.project?.["output-dir"],
          "_out",
          "the contributed output-dir must be merged",
        );
        assertEquals(
          renderOptions.forceClean,
          true,
          "the render path must force the clean that --output-dir implies",
        );
      } finally {
        project?.cleanup?.();
        services.cleanup();
      }
    });
  },
);

unitTest(
  "singleFileProjectContext: extension-contributed output-dir merges without renderOptions (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const file = join(tmpDir, "test.qmd");
      let project;

      try {
        writeFixture(tmpDir, "test.qmd", DOCUMENT);
        writeExtension(tmpDir, '      output-dir: "_out"\n');

        project = await singleFileProjectContext(file, notebookContext());

        assertEquals(
          project.config?.project?.["output-dir"],
          "_out",
          "the contributed output-dir must be merged without renderOptions too",
        );
      } finally {
        project?.cleanup?.();
      }
    });
  },
);

// One valid key and one key the strict project schema rejects, so a test can
// tell "the whole contribution was dropped" from "it was partially applied".
const MALFORMED_METADATA = '      output-dir: "_out"\n' +
  "      not-a-project-key: true\n";

unitTest(
  "singleFileProjectContext: a malformed extension does not break a context built without renderOptions (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const file = join(tmpDir, "test.qmd");
      let project;

      try {
        writeFixture(tmpDir, "test.qmd", DOCUMENT);
        writeExtension(tmpDir, MALFORMED_METADATA);

        // preview and inspect must degrade to "metadata not applied" here.
        project = await singleFileProjectContext(file, notebookContext());

        assertEquals(
          project.config?.project?.["output-dir"],
          undefined,
          "the whole contribution of a malformed extension must be dropped",
        );
      } finally {
        project?.cleanup?.();
      }
    });
  },
);

unitTest(
  "projectContext: a malformed extension does not break a context built without renderOptions (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      let project;

      try {
        writeProject(tmpDir);
        writeExtension(tmpDir, MALFORMED_METADATA);

        project = await projectContext(tmpDir, notebookContext());
        assert(
          project !== undefined,
          "projectContext must still resolve with a malformed extension",
        );
        assertEquals(
          project.config?.project?.["output-dir"],
          undefined,
          "the whole contribution of a malformed extension must be dropped",
        );
      } finally {
        project?.cleanup?.();
      }
    });
  },
);

unitTest(
  "singleFileProjectContext: a malformed extension is fatal with the fatal policy (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const file = join(tmpDir, "test.qmd");
      const nbContext = notebookContext();
      const services = renderServices(nbContext);
      const renderOptions = { services, flags: {} } as RenderOptions;

      try {
        writeFixture(tmpDir, "test.qmd", DOCUMENT);
        writeExtension(tmpDir, MALFORMED_METADATA);

        await assertRejects(
          () =>
            singleFileProjectContext(file, nbContext, renderOptions, {
              extensionMetadataPolicy: "fatal",
            }),
          Error,
          "contributes invalid project metadata",
        );
      } finally {
        services.cleanup();
      }
    });
  },
);

unitTest(
  "projectContext: a malformed extension is fatal with the fatal policy (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const nbContext = notebookContext();
      const services = renderServices(nbContext);
      const renderOptions = { services, flags: {} } as RenderOptions;

      try {
        writeProject(tmpDir);
        writeExtension(tmpDir, MALFORMED_METADATA);

        await assertRejects(
          () =>
            projectContext(tmpDir, nbContext, renderOptions, false, {
              extensionMetadataPolicy: "fatal",
            }),
          Error,
          "contributes invalid project metadata",
        );
      } finally {
        services.cleanup();
      }
    });
  },
);

unitTest(
  "projectResolveBrand - single-file: one malformed extension does not drop what a valid one contributes (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const file = join(tmpDir, "test.qmd");
      let project;

      try {
        writeFixture(tmpDir, "test.qmd", DOCUMENT);
        writeExtension(tmpDir, MALFORMED_METADATA, "broken-extension");
        writeExtension(tmpDir, "      brand: brand.yml\n", "brand-extension");

        project = await singleFileProjectContext(file, notebookContext());

        assertContributedBrand(
          await project.resolveBrand(),
          "when a sibling extension is malformed",
        );
        assertEquals(
          project.config?.project?.["output-dir"],
          undefined,
          "the contribution of the malformed extension must still be dropped",
        );
      } finally {
        project?.cleanup?.();
      }
    });
  },
);

// Records the warnings that the code under test logs, then restores the
// handlers of the default logger.
class WarningRecorder extends BaseHandler {
  messages: string[] = [];
  override log(msg: string) {
    this.messages.push(msg);
  }
}

async function recordWarnings(run: () => Promise<void>): Promise<string[]> {
  const logger = getLogger();
  const saved = logger.handlers;
  const recorder = new WarningRecorder("WARN");
  logger.handlers = [recorder];
  try {
    await run();
  } finally {
    logger.handlers = saved;
  }
  return recorder.messages;
}

function writeProject(dir: string) {
  writeDefaultProject(dir);
  writeFixture(dir, "index.qmd", DOCUMENT);
}

unitTest(
  "projectContext: an invalid extension warns once across rebuilds and keeps the valid brand (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const contexts: ProjectContext[] = [];

      try {
        writeProject(tmpDir);
        writeExtension(tmpDir, MALFORMED_METADATA, "once-broken-extension");
        writeExtension(
          tmpDir,
          "      brand: brand.yml\n",
          "once-brand-extension",
        );

        const warnings = await recordWarnings(async () => {
          for (let i = 0; i < 2; i++) {
            const context = await projectContext(tmpDir, notebookContext());
            assert(context !== undefined, "projectContext must resolve");
            contexts.push(context);
          }
        });

        assertEquals(
          warnings.filter((w) => w.includes("once-broken-extension")).length,
          1,
          "the warning must be logged once for two builds",
        );
        assertContributedBrand(
          await contexts[1].resolveBrand(),
          "next to an invalid extension",
        );
      } finally {
        contexts.forEach((context) => context.cleanup());
      }
    });
  },
);

unitTest(
  "refreshProjectContext: an invalid extension does not throw on refresh (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const nbContext = notebookContext();
      const services = renderServices(nbContext);
      const renderOptions = { services, flags: {} } as RenderOptions;
      let refreshed: ProjectContext | undefined;

      try {
        writeProject(tmpDir);
        writeExtension(tmpDir, MALFORMED_METADATA, "refresh-broken-extension");
        writeExtension(
          tmpDir,
          "      brand: brand.yml\n",
          "refresh-brand-extension",
        );

        const previous = await projectContext(tmpDir, nbContext);
        assert(previous !== undefined, "projectContext must resolve");

        const next = await refreshProjectContext(
          previous,
          nbContext,
          renderOptions,
        );
        refreshed = next;

        assert(
          next !== previous,
          "a successful refresh builds a new context",
        );
        assertContributedBrand(await next.resolveBrand(), "after a refresh");
      } finally {
        refreshed?.cleanup();
        services.cleanup();
      }
    });
  },
);

unitTest(
  "refreshProjectContext: picks up a contribution changed in _extension.yml during preview",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const nbContext = notebookContext();
      // preview keeps one set of services for its whole lifetime and the
      // watcher refreshes with it, so reuse the same renderOptions throughout
      const services = renderServices(nbContext);
      const renderOptions = { services, flags: {} } as RenderOptions;
      let project: ProjectContext | undefined;

      try {
        writeProject(tmpDir);
        writeExtension(tmpDir, "      brand: brand.yml\n", "switch-extension");
        const extensionDir = join(tmpDir, "_extensions", "switch-extension");
        Deno.writeTextFileSync(
          join(extensionDir, "other-brand.yml"),
          'color:\n  palette:\n    cobalt: "#1E5ABC"\n  primary: cobalt\n',
        );

        project = await projectContext(tmpDir, nbContext, renderOptions);
        assert(project !== undefined, "projectContext must resolve");
        assertContributedBrand(await project.resolveBrand(), "at startup");

        Deno.writeTextFileSync(
          join(extensionDir, "_extension.yml"),
          extensionYml("      brand: other-brand.yml\n"),
        );
        project = await refreshProjectContext(project, nbContext, renderOptions);

        const brand = await project.resolveBrand();
        assertEquals(
          brand?.light?.data.color?.palette?.["cobalt"],
          "#1E5ABC",
          "the refreshed context must use the brand now named in _extension.yml",
        );
      } finally {
        project?.cleanup();
        services.cleanup();
      }
    });
  },
);

unitTest(
  "refreshProjectContext: keeps the previous context when the rebuild fails (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const nbContext = notebookContext();
      const services = renderServices(nbContext);
      const renderOptions = { services, flags: {} } as RenderOptions;
      let previous: ProjectContext | undefined;

      try {
        writeProject(tmpDir);
        previous = await projectContext(tmpDir, nbContext);
        assert(previous !== undefined, "projectContext must resolve");

        writeFixture(tmpDir, "_quarto.yml", "project: [\n");

        const refreshed = await refreshProjectContext(
          previous,
          nbContext,
          renderOptions,
        );

        assert(
          refreshed === previous,
          "a failed rebuild must keep the previous context",
        );
      } finally {
        previous?.cleanup();
        services.cleanup();
      }
    });
  },
);

unitTest(
  "projectContext: the fatal policy cleans up the context before it rethrows (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      writeProject(tmpDir);
      writeExtension(tmpDir, MALFORMED_METADATA, "fatal-broken-extension");

      await assertRejects(
        () =>
          projectContext(tmpDir, notebookContext(), undefined, false, {
            extensionMetadataPolicy: "fatal",
          }),
        Error,
        "contributes invalid project metadata",
      );

      // withTempDir removes the directory afterwards, which fails on Windows
      // if the context still holds its disk cache open.
    });
  },
);

unitTest(
  "singleFileProjectContext: the fatal policy cleans up the context before it rethrows (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const file = join(tmpDir, "test.qmd");

      writeFixture(tmpDir, "test.qmd", DOCUMENT);
      writeExtension(tmpDir, MALFORMED_METADATA, "fatal-single-extension");

      await assertRejects(
        () =>
          singleFileProjectContext(file, notebookContext(), undefined, {
            extensionMetadataPolicy: "fatal",
          }),
        Error,
        "contributes invalid project metadata",
      );
    });
  },
);

unitTest(
  "refreshPreviewProject: a single file picks up a contribution changed in _extension.yml",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const file = join(tmpDir, "test.qmd");
      let previous: ProjectContext | undefined;
      let next: ProjectContext | undefined;

      try {
        Deno.writeTextFileSync(file, DOCUMENT);
        writeExtension(tmpDir, "      brand: brand.yml\n", "switch-extension");
        const extensionDir = join(tmpDir, "_extensions", "switch-extension");
        Deno.writeTextFileSync(
          join(extensionDir, "other-brand.yml"),
          'color:\n  palette:\n    cobalt: "#1E5ABC"\n  primary: cobalt\n',
        );

        previous = await singleFileProjectContext(file, notebookContext());
        assertContributedBrand(await previous.resolveBrand(), "at startup");

        let cleanedUp = false;
        const originalCleanup = previous.cleanup;
        previous.cleanup = () => {
          cleanedUp = true;
          originalCleanup();
        };

        Deno.writeTextFileSync(
          join(extensionDir, "_extension.yml"),
          extensionYml("      brand: other-brand.yml\n"),
        );
        next = await refreshPreviewProject(file, previous);

        assert(
          next !== previous,
          "a successful rebuild must return a new context",
        );
        const brand = await next.resolveBrand();
        assertEquals(
          brand?.light?.data.color?.palette?.["cobalt"],
          "#1E5ABC",
          "the rebuilt context must use the brand now named in _extension.yml",
        );
        assert(cleanedUp, "the previous context must be cleaned up");
      } finally {
        // the helper cleans up previous on success; clean up whichever
        // context is still live
        if (next && next !== previous) {
          next.cleanup();
        } else {
          previous?.cleanup();
        }
      }
    });
  },
);

unitTest(
  "refreshPreviewProject: keeps the previous context when the rebuild fails",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const nbContext = notebookContext();
      let previous: ProjectContext | undefined;

      try {
        writeProject(tmpDir);
        previous = await projectContext(tmpDir, nbContext);
        assert(previous !== undefined, "projectContext must resolve");

        Deno.writeTextFileSync(join(tmpDir, "_quarto.yml"), "project: [\n");

        const refreshed = await refreshPreviewProject(
          join(tmpDir, "index.qmd"),
          previous,
        );

        assert(
          refreshed === previous,
          "a failed rebuild must keep the previous context",
        );
      } finally {
        previous?.cleanup();
      }
    });
  },
);

unitTest(
  "the warning says no project metadata from the extension was applied (#14783)",
  async () => {
    await initYamlIntelligenceResourcesFromFilesystem();

    await withTempDir(async (tmpDir) => {
      const file = join(tmpDir, "test.qmd");
      let project: ProjectContext | undefined;

      try {
        writeFixture(tmpDir, "test.qmd", DOCUMENT);
        writeExtension(tmpDir, MALFORMED_METADATA, "message-extension");

        const warnings = await recordWarnings(async () => {
          project = await singleFileProjectContext(file, notebookContext());
        });

        assert(
          warnings.some((w) =>
            w.includes("No project metadata from message-extension was applied")
          ),
          `expected the "not applied" warning, got: ${warnings.join(" | ")}`,
        );
      } finally {
        project?.cleanup();
      }
    });
  },
);
