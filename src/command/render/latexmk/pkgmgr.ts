/*
 * pkgmgr.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import * as ld from "../../../core/lodash.ts";

import { ProcessResult } from "../../../core/process-types.ts";

import {
  findPackages,
  installPackages,
  TexLiveContext,
  updatePackages,
} from "./texlive.ts";
import { LatexmkOptions } from "./types.ts";

export interface PackageManager {
  autoInstall: boolean;
  searchPackages(searchTerms: string[]): Promise<string[]>;
  installPackages(pkgs: string[]): Promise<boolean>;
  updatePackages(all: boolean, self: boolean): Promise<ProcessResult>;
}

export function packageManager(
  mkOptions: LatexmkOptions,
  texLive: TexLiveContext,
): PackageManager {
  let lastPkgs: string[] = [];
  return {
    autoInstall: mkOptions.autoInstall === undefined
      ? true
      : mkOptions.autoInstall,
    installPackages: async (pkgs: string[]) => {
      // See whether we just tried to install the same packages or
      // if there are no packages detected to install
      // (if so, just give up as we can't suceed)
      const difference = ld.difference(pkgs, lastPkgs);
      if (difference.length > 0) {
        // Attempt to install the packages
        await installPackages(
          pkgs,
          texLive,
          mkOptions.engine.tlmgrOpts,
          mkOptions.quiet,
        );

        // Note that we tried to install these packages
        lastPkgs = pkgs;

        // Try running the engine again now that we've installed packages
        return true;
      } else {
        // We have already tried installing these packages, don't install the packages
        return false;
      }
    },
    updatePackages: (all: boolean, self: boolean) => {
      return updatePackages(
        all,
        self,
        texLive,
        mkOptions.engine.tlmgrOpts,
        mkOptions.quiet,
      );
    },
    searchPackages: (searchTerms: string[]) => {
      return findPackages(
        searchTerms,
        texLive,
        mkOptions.engine.tlmgrOpts,
        mkOptions.quiet,
      );
    },
  };
}
