#!/usr/bin/env -S deno run --unstable

// import { existsSync, ensureDir, move } from 'fs/mod.ts';
import fs from 'node:fs';

// x import yaml from 'yaml/mod.ts';
// x import 'node:yaml;

// Relative import path "yaml/schema/failsafe.ts" not prefixed with / or ./ or ../
// and not in import map from "file:///Users/gordon/src/quarto-cli/src/core/yaml.ts"
// import readYamlFromMarkdownFile from "../src/core/yaml.ts";

// import { dirname, fromFileUrl, join } from 'https://deno.land/std/path/mod.ts';
import path from 'node:path';

const formatKeep: Record<string, string> = {
  'pdf': 'tex',
  'typst': 'typ'
};

const formatOutput: Record<string, string> = {
  'pdf': 'pdf',
  'html': 'html',
  'typst': 'pdf',
  'dashboard': 'html',
  'docx': 'docx',
  'pptx': 'pptx'
};

interface Metadata {
  [key: string]: any;
}

function extractMetadataFromFile(file: string): Metadata {
  const fileContents = Deno.readTextFileSync(file);
  const lines = fileContents.split('\n');
  let start: number | null = null;
  let end: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '---') {
      if (start === null) {
        start = i;
      } else {
        end = i;
        const metadata = yaml.parse(lines.slice(start + 1, end).join('\n'));
        return metadata;
      }
    }
  }
  throw new Error(`No metadata found in file ${file}`);
}

if (import.meta.main) {
  const args = Deno.args;
  if (args.length < 3) {
    console.log('usage: render-all-formats.ts [--dryrun] output-root doc.qmd ...');
    console.log('  creates output-root/doc/format/...');
    console.log('  output-root should be empty');
    Deno.exit(1);
  }

  let dryRun = false;
  let argc = 1;
  if (args[argc] === '--dryrun') {
    dryRun = true;
    argc += 1;
  } else if (args[argc].startsWith('--')) {
    console.log('unsupported option', args[argc]);
    Deno.exit(1);
  }

  const outputRoot = args[argc];
  const qmdFiles = args.slice(argc + 1);

  for (const qmdFile of qmdFiles) {
    if (!qmdFile.endsWith('.qmd')) {
      console.log('expecting only .qmd files, skipping', qmdFile);
      continue;
    }

    console.log(qmdFile);
    const qmdbase = path.basename(qmdFile).slice(0, -4);
    const meta = extractMetadataFromFile(qmdFilePath);
    //const meta = readYamlFromMarkdownFile(qmdFile);

    for (const [format, spec] of Object.entries(meta['format'])) {
      const outext = formatOutput[format];
      if (!outext) {
        console.log(`unsupported format ${format}, skipping`);
        continue;
      }
      const outdir = path.join(outputRoot, qmdbase, format);
      console.log(`mkdir -p ${outdir}`);
      if (!dryRun) {
        fs.ensureDir(outdir);
      }
      const metadata: string[] = [];
      const keepext = formatKeep[format];
      if (keepext) {
        metadata.push(`-M keep-${keepext}:true`);
        metadata.push('-M output-ext:pdf');
      }
      const qcmd = [
        'render',
        qmdFile,
        '-t',
        format,
        '-M',
        'keep-md:true',
        ...metadata
      ];
      console.log(qcmd.join(' '));
      if (!dryRun) {
        const cmd = Deno.Command('quarto', {
            args: qcmd
        });
        const output = cmd.outputSync();
        if (!output.success) {
            console.log(new TextDecoder().decode(output.stderr));
            Deno.exit(1);
        }
      }
      const movefiles = [
        `${qmdbase}.${outext}`,
        `${qmdbase}.${format}.md`
      ];
      if (keepext) {
        movefiles.push(`${qmdbase}.${keepext}`);
      }
      movefiles.push(`${qmdbase}_files`);
      for (const movefile of movefiles) {
        const dest = path.join(outdir, movefile);
        console.log(`mv ${movefile} ${dest}`);
        if (!dryRun) {
          try {
            await fs.move(movefile, dest);
          } catch (error) {
            console.log('... not found');
          }
        }
      }
    }
  }
}
