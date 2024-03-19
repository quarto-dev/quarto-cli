#!/usr/bin/env -S deno run --unstable

import * as fs from 'https://deno.land/std/fs/mod.ts';
import * as yaml from 'https://deno.land/std/yaml/mod.ts';
import * as path from 'https://deno.land/std/path/mod.ts';

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

async function extractMetadataFromFile(file: string): Promise<any> {
  const fileContents = await Deno.readTextFile(file);
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

async function renderAndMoveArtifacts(dryRun: boolean, outputRoot: string, qmdFile : string) {
  if (!qmdFile.endsWith('.qmd')) {
    console.log('expecting only .qmd files, skipping', qmdFile);
    return;
  }

  console.log(qmdFile);
  const qmdbase = path.basename(qmdFile).slice(0, -4);
  const qmddir = path.dirname(qmdFile);
  const meta = await extractMetadataFromFile(qmdFile);

  const mdformat = meta['format'];
  if (!mdformat) {
    console.log(`does not contain format, skipping`, qmdFile);
    return;
  }
  const formats = typeof mdformat === 'string' ? [mdformat] : Object.keys(mdformat);

  for (const format of formats) {
    const outext = formatOutput[format];
    if (!outext) {
      console.log(`unsupported format ${format}, skipping`, qmdFile);
      continue;
    }
    const outdir = path.join(outputRoot, qmdbase, format);
    console.log(`mkdir -p ${outdir}`);
    if (!dryRun && !await fs.exists(outdir)) {
      await Deno.mkdir(outdir, { recursive: true });
    }
    const metadata: string[] = [];
    const keepext = formatKeep[format];
    if (keepext) {
      metadata.push('-M', `keep-${keepext}:true`);
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
    console.log('quarto', ...qcmd);
    if (!dryRun) {
      const cmd = new Deno.Command('quarto', {
          args: qcmd
      });
      const output = await cmd.output();
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
      const src = path.join(qmddir, movefile);
      const dest = path.join(outdir, movefile);
      console.log(`mv ${src} ${dest}`);
      if (!dryRun) {
        try {
          await fs.move(src, dest);
        } catch (error) {
          if(error instanceof Deno.errors.NotFound) {
              console.log('... not found');
          }
          else {
              console.error(error);
              Deno.exit(1);
          }
        }
      }
    }
  }
}

if (import.meta.main) {
  const args = Deno.args;
  if (args.includes('--help') || args.includes('-h') || args.filter(arg => !arg.startsWith('-')).length < 2) {
    console.log('usage: render-all-formats.ts [--dryrun] output-root doc.qmd ...');
    console.log('  creates output-root/doc/format/...');
    console.log('  output-root should be empty');
    Deno.exit(1);
  }

  let dryRun = false;
  let argc = 0;
  if (args[argc] === '--dryrun') {
    dryRun = true;
    argc += 1;
  } else if (args[argc].startsWith('--')) {
    console.log('unsupported option', args[argc]);
    Deno.exit(1);
  }

  const outputRoot = args[argc];
  const qmdFiles = args.slice(argc + 1);

  const promises = qmdFiles.map(renderAndMoveArtifacts.bind(null, dryRun, outputRoot));
  await Promise.all(promises);
}
