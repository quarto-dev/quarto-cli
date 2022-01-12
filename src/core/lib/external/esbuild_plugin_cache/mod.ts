
// This is https://deno.land/x/esbuild_plugin_cache@v0.2.8/mod.ts
// with imports minimally changed to work with the versions we have

import { Plugin } from 'esbuild/mod.d.ts'
import * as Cache from 'https://deno.land/x/cache@0.2.13/mod.ts'
import { resolve } from 'https://deno.land/x/importmap@0.1.4/mod.ts'
import { join } from 'path/mod.ts'

//prettier-ignore
type Loader = 'js' | 'jsx' | 'ts' | 'tsx' | 'css' | 'json' | 'text' | 'base64' | 'file' | 'dataurl' | 'binary' | 'default';

interface Config {
  importmap: { imports: { [key: string]: string } }
  directory: string
}

export function cache({ importmap = { imports: {} }, directory }: Config): Plugin {
  Cache.configure({ directory })
  return {
    name: 'deno-cache',
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        const resolvedPath = resolve(args.path, importmap)
        if (resolvedPath.startsWith('http')) {
          return {
            path: resolvedPath,
            namespace: 'deno-cache',
          }
        }
        if (args.namespace === 'deno-cache') {
          return {
            path: new URL(resolvedPath, args.importer).toString(),
            namespace: 'deno-cache',
          }
        }
        return { path: join(args.resolveDir, resolvedPath) }
      })
      build.onLoad({ filter: /.*/, namespace: 'deno-cache' }, async (args) => {
        const file = await Cache.cache(args.path, undefined, 'deps')
        const contents = await Deno.readTextFile(file.path)
        const ext = file.meta.url.split('.').pop() as Loader
        const loader = ext.match(/"j|tsx?$/) ? ext : 'js'
        return { contents, loader }
      })
    },
  }
}
