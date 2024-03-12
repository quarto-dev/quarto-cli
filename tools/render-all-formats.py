#!/usr/bin/env python3

import sys
import os
import subprocess
import yaml

format_keep = {
    'pdf': 'tex',
    'typst': 'typ'
}
format_output = {
    'pdf': 'pdf',
    'html': 'html',
    'typst': 'pdf',
    'dashboard': 'html',
    'docx': 'docx',
    'pptx': 'pptx'
}

def extract_metadata_from_file(file):
    with open(file, 'r') as f:
        lines = f.readlines()
    start = None
    end = None
    for i, line in enumerate(lines):
        if line.strip() == '---':
            if start is None:
                start = i
            else:
                end = i
                metadata = yaml.load(''.join(lines[start+1:end]), Loader=yaml.SafeLoader)
                return metadata
    raise ValueError('No metadata found in file %s' % file)


if len(sys.argv) < 3:
    print('usage: render-all-formats.py [--dryrun] output-root doc.qmd ...')
    print('  creates output-root/doc/format/...')
    print('  output-root should be empty')

dryrun = False
argc = 1
if sys.argv[argc] == '--dryrun':
    dryrun = True
    argc += 1
elif sys.argv[argc].startswith('--'):
    print('unsupported option', sys.argv[argc])
    sys.exit(1)

output_root = sys.argv[argc]
qmdfiles = sys.argv[argc+1:]

for qmdfile in qmdfiles:
    if not qmdfile.endswith('.qmd'):
        print('expecting only .qmd files, skipping', qmdfile)
        continue

    print(qmdfile)
    qmdbase = qmdfile[:-4]
    qmdroot = qmdbase.split('/')[-1]
    meta = extract_metadata_from_file(qmdfile)
    for format, spec in meta['format'].items():
        if not (outext := format_output.get(format)):
            print(f'unsupported format {format}, skipping')
            continue
        outdir = '/'.join([output_root, qmdroot, format])
        os.makedirs(outdir, exist_ok=True)
        metadata = []
        if keepext := format_keep.get(format):
            metadata = [
                '-M', f'keep-{keepext}:true',
                '-M', f'output-ext:pdf']
        qcmd = [
            'quarto',
            'render',
            qmdfile,
            '-t', format,
            '-M', 'keep-md:true',
            *metadata
        ]
        print(' '.join(qcmd))
        if not dryrun:
            result = subprocess.call(qcmd)
            if result != 0:
                sys.exit(1)
        movefiles = [
            f'{qmdbase}.{outext}',
            f'{qmdbase}.{format}.md'
        ]
        if keepext:
            movefiles.append(f'{qmdbase}.{keepext}')
        movefiles.append(f'{qmdbase}_files')
        for movefile in movefiles:
            filename = movefile.split('/')[-1]
            dest = f'{outdir}/{filename}'
            print(f'mv {movefile} {dest}')
            if not dryrun:
                try:
                    os.rename(movefile, dest)
                except FileNotFoundError:
                    print('... not found')
