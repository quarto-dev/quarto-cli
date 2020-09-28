
import { basename, extname, dirname, join } from 'path/mod.ts';

const kMarkdownExt = '.md';
const kKnitrExt = '.Rmd';
const kNbconvertExt = '.ipynb';

// parse input
const { args } = Deno;
const input = args[0];
const ext = extname(input);

// calculate output markdown for input
const mdOutput = (ext: string) => {
   const input_dir = dirname(input);
   const input_base = basename(input, ext);
   return join(input_dir, input_base + kMarkdownExt);
}

// determine output file and preprocessor
let output: string;
let preprocess: Deno.Process | null = null;

// knitr for .Rmd
if (ext.endsWith(kKnitrExt)) {

   output = mdOutput(kKnitrExt);
   preprocess = Deno.run({
      cmd: ["Rscript", "../src/preprocess/knitr.R", "--args", input, output],
   });

// nbconvert for .ipynb
} else if (ext.endsWith(kNbconvertExt)) {

   output = mdOutput(kNbconvertExt);
   preprocess = Deno.run({
      cmd: ["conda", "run", "-n", "quarto-cli", "python", "../src/preprocess/nbconv.py", input, output]
   });

// no preprocessing for .md
} else if (ext.endsWith(kMarkdownExt)) {

   output = mdOutput(kMarkdownExt);

// not supported
} else {

   Deno.stderr.write(new TextEncoder().encode('Unsupported input file: ' + input));
   Deno.exit(1);

}

// preprocess if necessary
if (preprocess) {
   await preprocess.status();
}

// run pandoc
const pandoc = Deno.run({
   cmd: ["pandoc", output]
});
await pandoc.status();

