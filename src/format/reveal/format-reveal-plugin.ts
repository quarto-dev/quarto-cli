/*
* format-reveal-plugin.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { kIncludeInHeader } from "../../config/constants.ts";

import {
  Format,
  FormatExtras,
  kTemplatePatches,
  Metadata,
} from "../../config/types.ts";
import { camelToKebab, mergeConfigs } from "../../core/config.ts";
import { copyMinimal, pathWithForwardSlashes } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { sessionTempFile } from "../../core/temp.ts";
import { readYaml } from "../../core/yaml.ts";

const kRevealjsPlugins = "revealjs-plugins";

interface RevealPluginBundle {
  plugin: string;
  config?: Metadata;
}

interface RevealPlugin {
  path: string;
  name: string;
  script: string;
  stylesheet?: string;
  config?: Metadata;
}

export function revealPluginExtras(format: Format, revealDir: string) {
  // directory to copy plugins into
  const pluginsDir = join(revealDir, "plugin");

  // accumlate content to inject
  const names: string[] = [];
  const scripts: string[] = [];
  const stylesheets: string[] = [];
  const config: Metadata = {};

  // built-in plugins + user plugins
  const pluginBundles: Array<RevealPluginBundle | string> = [{
    plugin: formatResourcePath("revealjs", join("plugins", "line-highlight")),
  }];
  if (Array.isArray(format.metadata[kRevealjsPlugins])) {
    pluginBundles.push(
      ...(format.metadata[kRevealjsPlugins] as Array<
        RevealPluginBundle | string
      >),
    );
  }

  // read plugins
  for (let bundle of pluginBundles) {
    // convert string to plugin
    if (typeof (bundle) === "string") {
      bundle = {
        plugin: bundle,
      };
    }

    // read from bundle
    const plugin = pluginFromBundle(bundle);

    // note name
    names.push(plugin.name);

    // copy plugin (plugin dir uses a kebab-case version of name)
    const pluginDir = join(pluginsDir, camelToKebab(plugin.name));
    copyMinimal(bundle.plugin, pluginDir);

    // note script
    const pluginScript = join(pluginDir, plugin.script);
    scripts.push(pathWithForwardSlashes(pluginScript));

    // note stylesheet
    if (plugin.stylesheet) {
      const pluginStylesheet = join(pluginDir, plugin.stylesheet);
      stylesheets.push(pathWithForwardSlashes(pluginStylesheet));
    }

    // add to config
    if (plugin.config) {
      for (const key of Object.keys(plugin.config)) {
        config[key] = plugin.config[key];
      }
    }
  }

  // inject them into extras
  const extras: FormatExtras = {
    [kIncludeInHeader]: [],
    html: {
      [kTemplatePatches]: [],
    },
  };

  // link tags for stylesheets
  const linkTags = stylesheets.map((file) => {
    return `<link href="${file}" rel="stylesheet">`;
  }).join("\n");
  const linkTagsInclude = sessionTempFile({ suffix: ".html" });
  Deno.writeTextFileSync(linkTagsInclude, linkTags);
  extras[kIncludeInHeader]?.push(linkTagsInclude);

  // patch function for script + reveal registration
  extras.html?.[kTemplatePatches]?.push((template) => {
    // plugin scripts
    const kRevealJsPlugins = "<!-- reveal.js plugins -->";
    const scriptTags = scripts.map((file) => {
      return `  <script src="${file}"></script>`;
    }).join("\n");
    template = template.replace(
      kRevealJsPlugins,
      kRevealJsPlugins + "\n" + scriptTags,
    );
    // plugin registration
    const kRevealPluginArray = "plugins: [";
    template = template.replace(
      kRevealPluginArray,
      kRevealPluginArray + names.join(", ") + ",\n",
    );
    // plugin config
    const configJs: string[] = [];
    Object.keys(config).forEach((key) => {
      configJs.push(`${key}: ${JSON.stringify(config[key])}`);
    });
    if (configJs.length > 0) {
      const kRevealInitialize = "Reveal.initialize({";
      template = template.replace(
        kRevealInitialize,
        kRevealInitialize + "\n" + configJs.join(",") + ",\n",
      );
    }

    // return patched template
    return template;
  });

  // return
  return extras;
}

function pluginFromBundle(bundle: RevealPluginBundle): RevealPlugin {
  // confirm it's a directory
  if (!existsSync(bundle.plugin) || !Deno.statSync(bundle.plugin).isDirectory) {
    throw new Error(
      "Specified Reveal plugin directory '" + bundle.plugin +
        "' does not exist.",
    );
  }
  // read the plugin definition (and provide the path)
  const plugin = readYaml(join(bundle.plugin, "plugin.yml")) as RevealPlugin;
  plugin.path = bundle.plugin;

  // validate plugin
  validatePlugin(plugin);

  // merge user config into plugin config
  if (typeof (bundle.config) === "object") {
    plugin.config = mergeConfigs(
      plugin.config || {} as Metadata,
      bundle.config || {} as Metadata,
    );
  }

  // return plugin
  return plugin;
}

function validatePlugin(plugin: RevealPlugin) {
  if (typeof (plugin.name) !== "string") {
    throw new Error("Reveal plugin definition must include a name.");
  }
  if (typeof (plugin.script) !== "string") {
    throw new Error("Reveal plugin definition must include a script.");
  }
  if (!existsSync(join(plugin.path, plugin.script))) {
    throw new Error(
      "Reveal plugin script '" + plugin.script + "' not found.",
    );
  }
  if (plugin.stylesheet) {
    if (!existsSync(join(plugin.path, plugin.stylesheet))) {
      throw new Error(
        "Reveal plugin stylesheet '" + plugin.stylesheet + "' not found.",
      );
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
