/*
 * format-reveal-plugin.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { ensureDirSync, existsSync } from "../../deno_ral/fs.ts";
import { basename, join } from "../../deno_ral/path.ts";
import { kIncludeInHeader, kSelfContained } from "../../config/constants.ts";

import { error } from "../../deno_ral/log.ts";

import {
  Format,
  FormatDependency,
  FormatExtras,
  kDependencies,
  Metadata,
  PandocFlags,
} from "../../config/types.ts";
import { camelToKebab, mergeConfigs } from "../../core/config.ts";
import { pathWithForwardSlashes } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { TempContext } from "../../core/temp.ts";
import { optionsToKebab, revealMetadataFilter } from "./metadata.ts";
import { revealMultiplexPlugin } from "./format-reveal-multiplex.ts";
import { isSelfContained } from "../../command/render/render-info.ts";

import { readAndValidateYamlFromFile } from "../../core/schema/validated-yaml.ts";

import { revealPluginSchema } from "./schemas.ts";
import { copyMinimal } from "../../core/copy.ts";
import { kRevealJSPlugins } from "../../extension/constants.ts";
import { ExtensionContext } from "../../extension/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { filterExtensions } from "../../extension/extension.ts";
import {
  RevealPlugin,
  RevealPluginBundle,
  RevealPluginScript,
} from "./format-reveal-plugin-types.ts";

const kRevealjsPlugins = "revealjs-plugins";

const kRevealSlideTone = "slide-tone";
const kRevealMenu = "menu";
const kRevealChalkboard = "chalkboard";

const kRevealPluginOptions = [
  // reveal.js-menu
  "side",
  "width",
  "numbers",
  "titleSelector",
  "useTextContentForMissingTitles",
  "hideMissingTitles",
  "markers",
  "custom",
  "themes",
  "themesPath",
  "transitions",
  "openButton",
  "openSlideNumber",
  "keyboard",
  "sticky",
  "autoOpen",
  "delayInit",
  "openOnInit",
  "loadIcons",
  // reveal.js-chalkboard
  "boardmarkerWidth",
  "chalkWidth",
  "chalkEffect",
  "storage",
  "src",
  "readOnly",
  "transition",
  "theme",
  "background",
  "grid",
  "eraser",
  "boardmarkers",
  "chalks",
  "rememberColor",
  // reveal-pdfexport
  "pdfExportShortcut",
];

const kRevealPluginKebabOptions = optionsToKebab(kRevealPluginOptions);

export function isPluginBundle(
  plugin: RevealPluginBundle | RevealPlugin,
): plugin is RevealPluginBundle {
  return (plugin as RevealPluginBundle).plugin !== undefined;
}

export async function revealPluginExtras(
  input: string,
  format: Format,
  flags: PandocFlags,
  temp: TempContext,
  revealUrl: string,
  revealDestDir: string,
  extensionContext?: ExtensionContext,
  project?: ProjectContext,
) {
  // directory to copy plugins into

  const pluginsDestDir = join(revealDestDir, "plugin");

  // accumlate content to inject
  const register: string[] = [];
  const scripts: RevealPluginScript[] = [];
  const stylesheets: string[] = [];
  const config: Metadata = {};
  const metadata: string[] = [];
  const dependencies: FormatDependency[] = [];

  // built-in plugins
  const pluginBundles: Array<RevealPlugin | RevealPluginBundle | string> = [
    {
      plugin: formatResourcePath("revealjs", join("plugins", "line-highlight")),
    },
    { plugin: formatResourcePath("revealjs", join("plugins", "pdfexport")) },
  ];

  // menu plugin (enabled by default)
  const menuPlugin = revealMenuPlugin(format);
  if (menuPlugin) {
    pluginBundles.push(menuPlugin);
  }

  // chalkboard plugin (optional)
  const chalkboardPlugiln = revealChalkboardPlugin(format);
  if (chalkboardPlugiln) {
    pluginBundles.push(chalkboardPlugiln);
  }

  // tone plugin (optional)
  const tonePlugin = revealTonePlugin(format);
  if (tonePlugin) {
    dependencies.push(toneDependency());
    pluginBundles.push(tonePlugin);
  }

  // multiplex plugin (optional)
  const multiplexPlugin = revealMultiplexPlugin(format);
  if (multiplexPlugin) {
    pluginBundles.push(multiplexPlugin);
  }

  const resolvePluginPath = async (plugin: string) => {
    // Look for an extension
    let extensions = await extensionContext?.find(
      plugin,
      input,
      kRevealJSPlugins,
      project?.config,
      project?.dir,
    ) || [];

    // Filter the extensions
    extensions = filterExtensions(
      extensions || [],
      plugin,
      "revealjs-plugins",
    );

    // Return any contributed plugins
    if (extensions.length > 0) {
      return extensions[0].contributes[kRevealJSPlugins] || [];
    } else {
      return [plugin];
    }
  };

  const resolvePlugin = async (
    plugin: string | RevealPluginBundle | RevealPlugin,
  ) => {
    if (typeof plugin === "string") {
      // This is just a simple path
      // If the path can be resolved to a file on disk then
      // don't treat it as an extension
      if (existsSync(plugin)) {
        return [plugin];
      } else {
        return await resolvePluginPath(plugin);
      }
    } else {
      if (isPluginBundle(plugin)) {
        // This is a plugin bundle, so try to resolve that
        const path = plugin.plugin;
        const resolvedPlugins = await resolvePluginPath(path);

        const pluginBundles = resolvedPlugins.map(
          (resolvedPlug): RevealPluginBundle => {
            if (typeof resolvedPlug === "string") {
              return {
                plugin: resolvedPlug,
                config: plugin.config,
              };
            } else if (isPluginBundle(resolvedPlug)) {
              return {
                plugin: resolvedPlug.plugin,
                config: mergeConfigs(
                  plugin.config,
                  resolvedPlug.config,
                ),
              };
            } else {
              return plugin;
            }
          },
        );
        return pluginBundles;
      } else {
        return Promise.resolve([plugin]);
      }
    }
  };

  if (Array.isArray(format.metadata[kRevealjsPlugins])) {
    for (const plugin of format.metadata[kRevealJSPlugins]) {
      const resolvedPlugins = await resolvePlugin(plugin);
      pluginBundles.push(...resolvedPlugins);
    }
  }

  // add general support plugin (after others so it can rely on their init)
  pluginBundles.push(
    { plugin: formatResourcePath("revealjs", join("plugins", "support")) },
  );

  // read plugins
  for (let bundle of pluginBundles) {
    // convert string to plugin
    if (typeof bundle === "string") {
      bundle = {
        plugin: bundle,
      };
    }

    // read from bundle
    const plugin = isPluginBundle(bundle)
      ? await pluginFromBundle(bundle)
      : bundle;

    // check for self-contained incompatibility
    if (isSelfContained(flags, format)) {
      if (plugin[kSelfContained] === false) {
        throw new Error(
          "Reveal plugin '" + plugin.name +
            " is not compatible with self-contained output",
        );
      }
    }

    // note name
    if (plugin.register !== false) {
      register.push(plugin.name);
    }

    // copy plugin (plugin dir uses a kebab-case version of name)
    const pluginUrl = pathWithForwardSlashes(
      join(revealUrl, "plugin", camelToKebab(plugin.name)),
    );
    const pluginDir = join(pluginsDestDir, camelToKebab(plugin.name));
    if (isPluginBundle(bundle)) {
      copyMinimal(bundle.plugin, pluginDir);
    } else {
      ensureDirSync(pluginDir);
      plugin.script?.forEach((script) => {
        Deno.copyFileSync(
          join(plugin.path, script.path),
          join(pluginDir, basename(script.path)),
        );
      });
      plugin.stylesheet?.forEach((style) => {
        Deno.copyFileSync(
          join(plugin.path, style),
          join(pluginDir, basename(style)),
        );
      });
    }

    // note scripts
    if (plugin.script) {
      for (const script of plugin.script) {
        script.path = pathWithForwardSlashes(join(pluginUrl, script.path));
        scripts.push(script);
      }
    }

    // note stylesheet
    if (plugin.stylesheet) {
      for (const stylesheet of plugin.stylesheet) {
        const pluginStylesheet = pathWithForwardSlashes(
          join(pluginUrl, stylesheet),
        );
        stylesheets.push(pathWithForwardSlashes(pluginStylesheet));
      }
    }

    // add to config
    if (plugin.config) {
      for (const key of Object.keys(plugin.config)) {
        const kebabKey = camelToKebab(key);
        if (typeof (plugin.config[key]) === "object") {
          config[key] = plugin.config[key];

          // see if the user has yaml to merge
          if (typeof (format.metadata[kebabKey]) === "object") {
            config[key] = mergeConfigs(
              revealMetadataFilter(
                config[key] as Metadata,
                kRevealPluginKebabOptions,
              ),
              revealMetadataFilter(
                format.metadata[kebabKey] as Metadata,
                kRevealPluginKebabOptions,
              ),
            );
          }
        } else {
          config[key] = plugin.config[key];
          if (format.metadata[key] !== undefined) {
            config[key] = format.metadata[key];
          }
        }
      }
    }

    // note metadata we should forward into reveal config
    if (plugin.metadata) {
      metadata.push(...plugin.metadata);
    }
  }

  // inject them into extras
  const extras: FormatExtras = {
    [kIncludeInHeader]: [],
    html: {
      [kDependencies]: dependencies,
    },
  };

  // link tags for stylesheets
  const linkTags = stylesheets.map((file) => {
    return `<link href="${file}" rel="stylesheet">`;
  }).join("\n");
  const linkTagsInclude = temp.createFile({ suffix: ".html" });
  Deno.writeTextFileSync(linkTagsInclude, linkTags);
  extras[kIncludeInHeader]?.push(linkTagsInclude);

  // inject top level options used by plugins into config
  metadata.forEach((option) => {
    if (format.metadata[option] !== undefined) {
      config[option] = format.metadata[option];
    }
  });

  const result = {
    pluginInit: {
      scripts,
      register,
      revealConfig: config,
    },
    extras,
  };

  // return
  return result;
}

function revealMenuPlugin(format: Format) {
  return {
    plugin: formatResourcePath("revealjs", join("plugins", "menu")),
    config: {
      menu: {
        custom: [{
          title: "Tools",
          icon: '<i class="fas fa-gear"></i>',
          content: revealMenuTools(format),
        }],
        openButton: format.metadata[kRevealMenu] !== false,
      },
    },
  };
}

function revealChalkboardPlugin(format: Format) {
  if (format.metadata[kRevealChalkboard]) {
    return {
      plugin: formatResourcePath("revealjs", join("plugins", "chalkboard")),
    };
  } else {
    return undefined;
  }
}

function revealMenuTools(format: Format) {
  const tools = [
    {
      title: "Fullscreen",
      key: "f",
      handler: "fullscreen",
    },
    {
      title: "Speaker View",
      key: "s",
      handler: "speakerMode",
    },
    {
      title: "Slide Overview",
      key: "o",
      handler: "overview",
    },
    {
      title: "PDF Export Mode",
      key: "e",
      handler: "togglePdfExport",
    },
    {
      title: "Scroll View Mode",
      key: "r",
      handler: "toggleScrollView",
    },
  ];
  if (format.metadata[kRevealChalkboard]) {
    tools.push(
      {
        title: "Toggle Chalkboard",
        key: "b",
        handler: "toggleChalkboard",
      },
      {
        title: "Toggle Notes Canvas",
        key: "c",
        handler: "toggleNotesCanvas",
      },
      {
        title: "Download Drawings",
        key: "d",
        handler: "downloadDrawings",
      },
    );
  }
  tools.push({
    title: "Keyboard Help",
    key: "?",
    handler: "keyboardHelp",
  });
  const lines = ['<ul class="slide-menu-items">'];
  lines.push(...tools.map((tool, index) => {
    return `<li class="slide-tool-item${
      index === 0 ? " active" : ""
    }" data-item="${index}"><a href="#" onclick="RevealMenuToolHandlers.${tool.handler}(event)"><kbd>${
      tool
        .key || " "
    }</kbd> ${tool.title}</a></li>`;
  }));

  lines.push("</ul>");
  return lines.join("\n");
}

function revealTonePlugin(format: Format) {
  if (format.metadata[kRevealSlideTone]) {
    return { plugin: formatResourcePath("revealjs", join("plugins", "tone")) };
  } else {
    return undefined;
  }
}

function toneDependency() {
  const dependency: FormatDependency = {
    name: "tone",
    scripts: [{
      name: "tone.js",
      path: formatResourcePath("revealjs", join("tone", "tone.js")),
    }],
  };
  return dependency;
}

async function pluginFromBundle(
  bundle: RevealPluginBundle,
): Promise<RevealPlugin> {
  // confirm it's a directory
  if (!existsSync(bundle.plugin) || !Deno.statSync(bundle.plugin).isDirectory) {
    throw new Error(
      "Specified Reveal plugin directory '" + bundle.plugin +
        "' does not exist.",
    );
  }

  let plugin;

  try {
    // read the plugin definition (and provide the path)
    plugin = (await readAndValidateYamlFromFile(
      join(bundle.plugin, "plugin.yml"),
      revealPluginSchema,
      "Validation of reveal plugin object failed.",
    )) as RevealPlugin;
    plugin.path = bundle.plugin;
  } catch (e) {
    error(
      `Validation of plugin configuration ${
        join(bundle.plugin, "plugin.yml")
      } failed.`,
    );
    throw e;
  }

  // convert script and stylesheet to arrays
  if (plugin.script && !Array.isArray(plugin.script)) {
    plugin.script = [plugin.script];
  }
  plugin.script = plugin.script?.map((script) => {
    if (typeof script === "string") {
      return {
        path: script,
      };
    } else {
      return script;
    }
  });

  if (plugin.stylesheet && !Array.isArray(plugin.stylesheet)) {
    plugin.stylesheet = [plugin.stylesheet];
  }
  plugin.stylesheet = plugin.stylesheet?.map((stylesheet) =>
    String(stylesheet)
  );

  // validate plugin
  validatePlugin(plugin);

  // merge user config into plugin config
  if (typeof (bundle.config) === "object") {
    plugin.config = mergeConfigs(
      plugin.config || {} as Metadata,
      bundle.config || {} as Metadata,
    );
  }

  // ensure that metadata is an array
  if (typeof (plugin.metadata) === "string") {
    plugin.metadata = [plugin.metadata];
  }

  // return plugin
  return plugin;
}

function validatePlugin(plugin: RevealPlugin) {
  if (typeof (plugin.name) !== "string") {
    throw new Error("Reveal plugin definition must include a name.");
  }
  if (!Array.isArray(plugin.script)) {
    throw new Error("Reveal plugin definition must include a script.");
  }
  for (const script of plugin.script) {
    if (!existsSync(join(plugin.path, script.path))) {
      throw new Error(
        "Reveal plugin script '" + script + "' not found.",
      );
    }
  }

  if (plugin.stylesheet) {
    for (const stylesheet of plugin.stylesheet) {
      if (!existsSync(join(plugin.path, stylesheet))) {
        throw new Error(
          "Reveal plugin stylesheet '" + stylesheet + "' not found.",
        );
      }
    }
  }
  if (plugin.config) {
    if (
      typeof (plugin.config) !== "object"
    ) {
      throw new Error(
        "Reveal plugin config must be an object.",
      );
    }
  }
}
