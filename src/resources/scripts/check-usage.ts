import { readLines } from "https://deno.land/std@0.76.0/io/bufio.ts";

if (import.meta.main) {
  const patterns: RegExp[] = Deno.args.map(arg => new RegExp(arg));
  const sizedEntries: Record<string, number> = {};
  for await (const entry of readLines(Deno.stdin)) {
    if (entry.trim() === "") {
      continue;
    };
    let [url, size] = entry.split(" ");
    size = size.slice(1, -1);
    // heuristic: all urls we care about can be trimmed to the right of the first @
    //            for a simple group-by
    url = url.split("@")[0];
    let sizeNo = 0;
    if (size.endsWith("KB")) {
      sizeNo = Number(size.slice(0, -2)) * 1024;
    } else if (size.endsWith("B")) {
      sizeNo = Number(size.slice(0, -1));
    } else {
      console.log(`Don't know how to read ${size}`);
      continue;
    }
    if (patterns.length && !patterns.some((pattern: RegExp) => entry.match(pattern))) {
      continue;
    }
    sizedEntries[url] = (sizedEntries[url] || 0) + ~~sizeNo;
  }

  let sizedEntriesArray = Object.entries(sizedEntries);
  sizedEntriesArray.sort((a, b) => a[1] - b[1]);
  let sum = 0;
  for (const entry of sizedEntriesArray) {
    console.log(`${entry[0]} ${entry[1]}`);
    sum += entry[1];
  }
  console.log(`Overall: ${sum}`);
}
