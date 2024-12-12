#!/usr/bin/env -S deno run --unstable

import * as fs from 'stdlib/fs';
import * as yaml from 'stdlib/yaml';
import * as path from 'stdlib/path';

const formatKeep: Record<string, string> = {
  'pdf': 'tex',
  'typst': 'typ',
};

const formatOutput: Record<string, string> = {
  'pdf': 'pdf',
  'html': 'html',
  'typst': 'pdf',
  'dashboard': 'html',
  'docx': 'docx',
  'pptx': 'pptx',
  'docusaurus-md': 'mdx',
  'revealjs': 'html',
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
    return 0;
  }

  console.log(qmdFile);
  const qmdbase = path.basename(qmdFile).slice(0, -4);
  let qmddir = path.dirname(qmdFile);
  if(qmddir.includes('..') || qmdFile.startsWith('/')) {
    console.warn("Warning: currently unable to replicate absolute or .. paths. Try running from the common root directory of the files if you get AlreadyExists errors.")
    qmddir = '.'
  }
  const meta = await extractMetadataFromFile(qmdFile);

  const mdformat = meta['format'];
  if (!mdformat) {
    console.log(`does not contain format, skipping`, qmdFile);
    return 0;
  }
  const formats = typeof mdformat === 'string' ? [mdformat] : Object.keys(mdformat);

  let nprocessed = 0;
  for (const format of formats) {
    const outext = formatOutput[format];
    if (!outext) {
      console.log(`unsupported format ${format}, skipping`, qmdFile);
      continue;
    }
    const outdir = path.join(outputRoot, qmddir, qmdbase, format);
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
      if(dryRun) {
        console.log(`mv ${src} ${dest}`);
      } else {
        try {
          await fs.move(src, dest);
          console.log(`√ mv ${src} ${dest}`);
        } catch (error) {
          if(error instanceof Deno.errors.NotFound) {
            console.log(`x mv ${src} ${dest}`);
          }
          else {
              console.error(error);
              Deno.exit(1);
          }
        }
      }
    }
    nprocessed++;
  }
  return nprocessed;
}

if (import.meta.main) {
  const startTime = performance.now();
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
  const counts = await Promise.all(promises);
  const count = counts.reduce((a, b) => a+b, 0)
  const endTime = performance.now();
  const elapsed = endTime - startTime;
  console.log(`Rendered ${count} documents in ${(elapsed/1000.).toFixed(2)} seconds`);
}
