import * as path from 'stdlib/path';

const srcTemplate = path.parse('../src/resources/formats/typst/pandoc/quarto/typst-template.typ');
const destTemplate = path.parse('../src/resources/create/extensions/format-typst/_extensions/qstart-filesafename-qend/typst-template.typ');
const srcShow = path.parse('../src/resources/formats/typst/pandoc/quarto/typst-show.typ');
const destShow = path.parse('../src/resources/create/extensions/format-typst/_extensions/qstart-filesafename-qend/typst-show.typ');

const templatePreamble = `
// This is an example typst template (based on the default template that ships
// with Quarto). It defines a typst function named 'article' which provides
// various customization options. This function is called from the 
// 'typst-show.typ' file (which maps Pandoc metadata function arguments)
//
// If you are creating or packaging a custom typst template you will likely
// want to replace this file and 'typst-show.typ' entirely. You can find 
// documentation on creating typst templates and some examples here: 
//   - https://typst.app/docs/tutorial/making-a-template/
//   - https://github.com/typst/templates
`;

const showPreamble = `
// Typst custom formats typically consist of a 'typst-template.typ' (which is
// the source code for a typst template) and a 'typst-show.typ' which calls the
// template's function (forwarding Pandoc metadata values as required)
//
// This is an example 'typst-show.typ' file (based on the default template  
// that ships with Quarto). It calls the typst function named 'article' which 
// is defined in the 'typst-template.typ' file. 
//
// If you are creating or packaging a custom typst template you will likely
// want to replace this file and 'typst-template.typ' entirely. You can find
// documentation on creating typst templates here and some examples here:
//   - https://typst.app/docs/tutorial/making-a-template/
//   - https://github.com/typst/templates
`;

const encoder = new TextEncoder(), decoder = new TextDecoder();
const scriptDir = import.meta.dirname;

async function splicePartial(preamble : string, source : string, dest : string) {
  const template = await Deno.readFile(path.join(scriptDir, path.format(source)));
  const templateOut = preamble + decoder.decode(template);
  await Deno.writeFile(path.join(scriptDir, path.format(dest)), encoder.encode(templateOut));
}

await splicePartial(templatePreamble, srcTemplate, destTemplate);
await splicePartial(showPreamble, srcShow, destShow);