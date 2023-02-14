import { expandGlobSync } from "https://deno.land/std/fs/expand_glob.ts";
import { relative } from "https://deno.land/std/path/mod.ts";

try {
  Deno.readTextFileSync("timing.txt");
} catch (e) {
  console.log(e);
  console.log("timing.txt missing. run ./tests.sh with QUARTO_TEST_TIMING=1");
  Deno.exit(1);
}

const lines = Deno.readTextFileSync("timing.txt").trim().split("\n");
const currentTests = new Set(
  [...expandGlobSync("**/*.test.ts", { globstar: true })].map((entry) =>
    `./${relative(Deno.cwd(), entry.path)}`
  ),
);
const timedTests = new Set<string>();

type Timing = {
  real: number;
  user: number;
  sys: number;
};
type TestTiming = {
  name: string;
  timing: Timing;
};

const testTimings: TestTiming[] = [];

for (let i = 0; i < lines.length; i += 2) {
  const name = lines[i].trim();
  const timingStrs = lines[i + 1].trim().replaceAll(/ +/g, " ").split(" ");
  const timing = {
    real: Number(timingStrs[0]),
    user: Number(timingStrs[2]),
    sys: Number(timingStrs[4]),
  };
  testTimings.push({ name, timing });
  timedTests.add(name);
}
let failed = false;
for (const timedTest of timedTests) {
  if (!currentTests.has(timedTest)) {
    console.log(`Missing test ${timedTest} in test suite`);
    failed = true;
  }
}
for (const currentTest of currentTests) {
  if (!timedTests.has(currentTest)) {
    console.log(`Missing test ${currentTest} in timing.txt`);
    failed = true;
  }
}
if (failed) {
  Deno.exit(1);
}

const buckets: TestTiming[][] = [];
const nBuckets = 8;
const bucketSizes = (new Array(8)).fill(0);

const argmin = (a: number[]): number => {
  let best = -1, bestValue = Infinity;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] < bestValue) {
      best = i;
      bestValue = a[i];
    }
  }
  return best;
};

for (let i = 0; i < nBuckets; ++i) {
  buckets.push([]);
}

for (const timing of testTimings) {
  const ix = argmin(bucketSizes);
  buckets[ix].push(timing);
  bucketSizes[ix] += timing.timing.real;
}

Promise.all(buckets.map((bucket) => {
  const cmd: string[] = ["./run-tests.sh"];
  cmd.push(...bucket.map((tt) => tt.name));
  return Deno.run({
    cmd,
  }).status();
}));

// for (const bucket of buckets) {
//   Deno.run();
// }
// console.log(bucketSizes);
