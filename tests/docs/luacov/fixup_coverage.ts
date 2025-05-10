export type CoverageEntry = {
  count: number;
  name: string;
  entries: number[];
};

export function fixupCoverageNames(
  text: string,
): Record<string, CoverageEntry> {
  let count = 0;
  let name = "";
  const allEntries: Record<string, CoverageEntry> = {};

  for (const line of text.split("\n")) {
    if (line === "") {
      continue;
    }
    const entries = line.split(":");
    if (entries.length < 2) {
      const numEntries = line.trim().split(" ").map((x) => parseInt(x));
      if (allEntries[name] === undefined) {
        allEntries[name] = {
          count,
          name,
          entries: numEntries,
        };
      } else {
        allEntries[name] = {
          count: allEntries[name].count + count,
          name,
          entries: allEntries[name].entries.map((x: number, i: number) =>
            x + numEntries[i]
          ),
        };
      }
      continue;
    }
    let countStr: string;
    [countStr, name] = entries;
    count = parseInt(countStr);
    // exceedingly dumb path normalizer
    let oldLength;
    if (name.startsWith("/")) {
      do {
        oldLength = name.length;
        name = name.replaceAll(/[/]([^/]+)[/]\.\.[/]/g, "/").replaceAll(
          "/./",
          "/",
        );
      } while (name.length < oldLength);
    }
  }
  return allEntries;
}

export function fixupCoverageNamesAsText(text: string) {
  const result = [];
  for (const entry of Object.values(fixupCoverageNames(text))) {
    result.push(`${entry.count}:${entry.name}`);
    result.push(entry.entries.join(" "));
  }
  return result.join("\n");
}

if (import.meta.main) {
  const text = Deno.readTextFileSync(Deno.args[0]);
  for (const entry of Object.values(fixupCoverageNames(text))) {
    console.log(`${entry.count}:${entry.name}`);
    console.log(entry.entries.join(" "));
  }
}

/*
22:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/extensions/quarto/docusaurus/docusaurus_renderers.lua
55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55
33:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/extensions/quarto/docusaurus/docusaurus_utils.lua
55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 55 55 55
86:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/extensions/quarto/kbd/kbd.lua
0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 55
334:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/extensions/quarto/video/video.lua
0 0 0 0 0 0 0 0 0 0 0 0 55 0 0 0 0 0 0 0 0 0 55 0 0 0 55 0 0 0 55 0 55 0 55 55 55 55 55 0 0 55 55 55 55 55 0 0 55 0 0 0 0 0 0 0 0 0 0 55 0 0 0 0 0 0 0 0 0 0 55 0 0 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 55 55 55 55 55 55 55 55 55 55 0 0 0 0 55 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 0 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 55 55
479:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/filters/./ast/customnodes.lua
0 0 0 0 0 55 0 55 55 55 0 55 67 67 15 52 4 0 48 0 55 0 55 30434 264 0 30170 55 0 55 3190 0 0 0 3190 3190 3190 9198 6008 6008 5917 5917 5917 0 5454 4701 1582 0 3190 0 0 1417 0 0 0 0 0 0 0 0 1417 3190 0 0 3190 618 2572 1553 0 1553 0 495 1058 0 660 660 660 660 660 0 0 0 0 0 0 1155 0 0 1155 0 0 0 0 0 0 0 1417 0 0 0 0 1417 1417 495 0 0 0 0 0 0 0 0 495 495 0 0 495 0 0 0 922 922 0 0 4757 3835 922 0 0 261 0 0 261 261 261 0 261 261 103 103 37 0 0 66 36 0 30 0 1080 0 922 18974 253 0 0 253 0 18721 468 0 18253 15640 0 2613 922 0 922 10011 8 0 8 8 0 0 0 0 0 0 10003 8 0 9995 3054 0 6941 922 0 922 0 0 0 0 0 0 0 0 0 0 0 0 922 55 0 55 33 33 29 4 4 0 0 0 0 0 33 33 33 33 33 33 0 33 55 0 55 33 33 33 0 33 33 55 0 55 55 55 0 0 36 36 86 50 50 50 0 91 0 0 33 185 33 33 0 160 160 33 0 127 127 127 7 0 120 120 0 0 120 0 0 0 0 120 120 0 0 120 120 2 118 0 0 118 0 33 0 203 203 145 145 0 58 58 0 58 0 0 0 0 0 58 36 0 58 58 30 0 28 0 91 33 55 0 0 33 0 0 0 33 33 0 66 363 33 0 220 187 33 33 55 0 0 264 264 264 0 0 0 264 264 264 264 0 264 0 0 0 264 264 0 264 55 0 0 605 605 0 0 0 0 605 0 0 0 0 605 0 605 1155 550 605 0 0 0 0 0 0 0 605 605 1320 880 440 0 165 0 0 605 33 0 33 33 0 0 0 0 0 605 0 0 605 660 0 0 1650 1650 0 0 0 0 1650 440 0 0 0 1650 1705 0 0 3866 3866 3866 0 0 0 0 0 0 55 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 55 0 55 0 55 55 55 0 0 55 55 0 0 0 0 0 55 0 55 0 110 0 55
37:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/filters/./ast/emulatedfilter.lua
0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 0 110 110 0 0 0 0 0 0 0 0 0 0 0 0 0 0 110 110 55
22:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/filters/./ast/parse.lua
0 0 0 0 0 0 3599 1920 1920 1920 7 0 1679 1679 55 0 55 55 55 55 55 110
64:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/filters/./ast/render.lua
0 0 0 0 0 55 0 29 58 0 13 42 0 29 55 0 55 0 0 0 0 32 0 3 29 0 7 0 22 0 32 32 3 0 0 32 32 0 0 0 0 32 105 105 32 0 0 0 0 0 0 0 0 0 0 0 0 55 0 55 55 55 55 110
153:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/filters/./ast/runemulation.lua
0 0 0 0 0 55 0 0 55 3466 0 3411 550 0 0 0 0 550 1100 550 54 0 550 550 496 0 0 0 0 0 2915 0 0 0 0 2915 0 2915 0 0 2915 0 0 0 6326 3411 0 0 3411 0 3411 3411 3411 55 55 55 55 0 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 0 55 55 0 55 55 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 55 55 0 55 0 0 55 0 3575 3520 0 3355 165 221 56 112 56 56 0 165 0 0 0 0 0 55 0 55 55 0 55 0 55 55 110 55 55 0 0 110 55 0 55 0 55 0 0 0 0 0 55 110
73:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/filters/./ast/traceexecution.lua
0 0 0 0 0 55 0 0 0 0 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 110 55 2970 55 110 55
195:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/filters/./ast/wrappedwriter.lua
0 0 0 0 0 55 110 55 110 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 110
156:/Users/cscheid/repos/github/quarto-dev/quarto-cli/src/resources/filters/./common/base64.lua
0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 55 55 0 0 0 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 110 0 110 0 0 0 0 55 110 7370 110 110 110 220 7150 110 110 55 0 55 55 3630 3575 55 55 55 0 55 55 0 55 0 55 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 55 0 55 40 40 40 40 2640 2600 2560 0 40 40 0 40 40 40 40 40 924 884 884 884 0 0 0 0 0 0 0 0 884 884 0 884 884 0 40 12 12 12 28 20 20 20 0 40 110
*/
