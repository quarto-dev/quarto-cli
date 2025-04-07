import { existsSync } from "stdlib/fs";

const file = "_metadata.yml"
const contents = `
project:
  output-dir: _foobar123
`
if (existsSync(file)) {
    Deno.removeSync(file);
}    
Deno.writeTextFileSync(file, contents);

