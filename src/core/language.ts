/*
 * language.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync, expandGlobSync } from "fs/mod.ts";
import { extname, join } from "../deno_ral/path.ts";

import {
  kLang,
  kLanguageDefaults,
  kLanguageDefaultsKeys,
} from "../config/constants.ts";
import { FormatLanguage, Metadata } from "../config/types.ts";
import { dirAndStem, normalizePath } from "./path.ts";
import { resourcePath } from "./resources.ts";
import { mergeConfigs } from "./config.ts";
import { readAndValidateYamlFromFile } from "./schema/validated-yaml.ts";
import { RenderFlags } from "../command/render/types.ts";
import { getSchemaDefinition } from "./lib/yaml-validation/schema.ts";
import { cacheMap } from "./cache.ts";

type TranslationCacheValue = {
  file?: string;
  result: FormatLanguage;
};

const translationCache = cacheMap(
  async (file: string) => {
    if (existsSync(file)) {
      const errMsg = "Validation of format language object failed.";
      const formatLanguageSchema = getSchemaDefinition("format-language");
      const result = await readAndValidateYamlFromFile(
        file,
        formatLanguageSchema,
        errMsg,
      );
      return {
        file: normalizePath(file),
        language: result as FormatLanguage,
      };
    } else {
      return {
        language: {} as FormatLanguage,
      };
    }
  },
);

// https://stackoverflow.com/a/6969486
function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export async function readLanguageTranslations(
  translationFile: string,
  lang?: string,
): Promise<{ language: FormatLanguage; files: string[] }> {
  // read and parse yaml if it exists (track files read)
  const files: string[] = [];

  // read the original file
  const {
    file,
    language,
  } = await translationCache(translationFile);
  if (file) {
    files.push(file);
  }

  // determine additional variations to read
  const ext = extname(translationFile);
  let [dir, stem] = dirAndStem(translationFile);
  stem = escapeRegExp(stem);
  const variations: string[] = [];
  if (lang) {
    // enumerate variations dictated by this lang
    const subtags = lang.split("-");
    for (let i = 0; i < subtags.length; i++) {
      variations.push(subtags.slice(0, i + 1).join("-"));
    }
  } else {
    // enumerate all variations
    const glob = stem + "-*" + ext;
    const variationRe = new RegExp(
      "^" + stem + "-(.*?)" + ext,
    );
    for (
      const entry of expandGlobSync(glob, {
        root: dir,
        includeDirs: false,
        caseInsensitive: true,
      })
    ) {
      const match = entry.name.match(variationRe);
      if (match) {
        variations.push(match[1]);
      }
    }
  }

  // read the variations
  for (const variation of variations) {
    const {
      file: variationFile,
      language: translations,
    } = await translationCache(join(dir, stem + "-" + variation + ext));
    if (variationFile) {
      files.push(variationFile);
    }
    // const translations = await maybeReadYaml(
    //   join(dir, stem + "-" + variation + ext),
    // );
    Object.keys(translations).forEach((key) => {
      // top level entries use the variation key
      if (kLanguageDefaultsKeys.includes(key)) {
        language[variation] = language[variation] || {};
        (language[variation] as FormatLanguage)[key] = translations[key];
        // objects use variation key + subkey
      } else if (typeof translations[key] === "object") {
        const targetKey = variation + "-" + key;
        language[targetKey] = language[targetKey] || {};
        language[targetKey] = {
          ...language[targetKey] as Record<string, unknown>,
          ...translations[key] as Record<string, unknown>,
        };
      }
    });
  }

  return { language, files };
}

export function readDefaultLanguageTranslations(lang: string) {
  return readLanguageTranslations(
    resourcePath(join("language", "_language.yml")),
    lang,
  );
}

export async function resolveLanguageMetadata(metadata: Metadata, dir: string) {
  if (typeof (metadata[kLanguageDefaults]) === "string") {
    const translationsFile = join(dir, metadata[kLanguageDefaults] as string);
    if (!existsSync(translationsFile)) {
      throw new Error(
        "Specified 'language' file does not exist: " + translationsFile,
      );
    }
    const translations = await readLanguageTranslations(translationsFile);
    metadata[kLanguageDefaults] = translations.language;
    return translations.files;
  } else if (typeof (metadata[kLanguageDefaults]) !== "object") {
    metadata[kLanguageDefaults] = {};
    return [];
  } else {
    return [];
  }
}

export function translationsForLang(language: FormatLanguage, lang: string) {
  // start with the defaults
  let translations = {} as FormatLanguage;
  Object.keys(language).forEach((key) => {
    if (kLanguageDefaultsKeys.includes(key)) {
      translations[key] = language[key];
    }
  });

  // merge any variations (starting with most general)
  const subtags = lang.split("-");
  for (let i = 0; i < subtags.length; i++) {
    const variation = subtags.slice(0, i + 1).join("-");
    if (typeof (language[variation]) === "object") {
      translations = mergeConfigs(
        translations,
        language[variation],
      );
    }
  }

  return translations;
}

export async function formatLanguage(
  metadata: Metadata,
  language?: FormatLanguage,
  flags?: RenderFlags,
) {
  // start with system defaults for the current language
  const langCode = (
    flags?.pandocMetadata?.[kLang] ||
    metadata[kLang] ||
    "en"
  ) as string;
  const defaultLanguge = translationsForLang(
    (await readDefaultLanguageTranslations(langCode)).language,
    langCode,
  );

  // merge any user provided language w/ the defaults
  language = mergeConfigs(defaultLanguge, language);

  // now select the correct variations based on the lang code and translations
  return translationsForLang(language, langCode);
}
