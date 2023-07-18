import { expandGlobSync } from "https://deno.land/std/fs/expand_glob.ts";
import { relative } from "https://deno.land/std/path/mod.ts";
import { parse } from "https://deno.land/std/flags/mod.ts";

// Command line flags to use when calling `run-paralell-tests.sh`.
const flags = parse(Deno.args, {
  boolean: ["json-for-ci", "verbose", "dry-run"],
  string: ["n", "timing-file"],
  default: {
    verbose: false,
    "dry-run": false,
    "json-for-ci": false,
    "timing-file": "timing.txt",
  },
});

// Name of the file containing test timing for buckets grouping
const timingFile = flags["timing-file"];
// Use detailed smoke-all timing results when generating json for CI matrix runs
const detailedSmokeAll = flags["json-for-ci"];

const smokeAllTestFile = "./smoke/smoke-all.test.ts";

try {
  Deno.readTextFileSync(timingFile);
} catch (e) {
  console.log(e);
  console.log(
    `'${timingFile}' missing. Run './run-tests.sh' with QUARTO_TEST_TIMING='${timingFile}'`,
  );
  Deno.exit(1);
}

const lines = Deno.readTextFileSync(timingFile).trim().split("\n");
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

// Regex to match detailed smoke-all results
const RegSmokeAllFile = new RegExp("smoke\/smoke-all\.test\.ts -- (.*)$");
let dontUseDetailledSmokeAll = false;

// Checking that timed tests still exists, otherwise log and exclude
for (let i = 0; i < lines.length; i += 2) {
  const name = lines[i].trim();
  if (RegSmokeAllFile.test(name)) {
    // Detailled smoke-all timed tests are found
    if (!detailedSmokeAll) {
      // Detailled tests are not used so they are ignored.
      dontUseDetailledSmokeAll = true;
      continue;
    } else {
      // checking smoke file existence
      const smokeFile = name.split(" -- ")[1];
      const currentSmokeFiles = new Set(
        [...expandGlobSync("docs/smoke-all/**/*.{qmd,ipynb}", {
          globstar: true,
        })]
          .map((entry) => `${relative(Deno.cwd(), entry.path)}`),
      );
      if (!currentSmokeFiles.has(smokeFile)) {
        flags.verbose &&
          console.log(
            `Test ${name} in '${timingFile}' does not exists anymore. Update '${timingFile} with 'run ./run-tests.sh with QUARTO_TEST_TIMING='${timingFile}'`,
          );
        continue;
      }
    }
  } else {
    // Regular smoke tests
    if (!currentTests.has(name)) {
      flags.verbose &&
        console.log(
          `Test ${name} in '${timingFile}' does not exists anymore. Update '${timingFile} with 'run ./run-tests.sh with QUARTO_TEST_TIMING='${timingFile}'`,
        );
      continue;
    }
  }
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

// console.log(
//   testTimings.map((a) => (a.timing.real)).reduce((a, b) => a + b, 0),
// );
// console.log(testTimings.sort((a, b) => a.timing.real - b.timing.real));
// Deno.exit(0);

const buckets: TestTiming[][] = [];
const nBuckets = Number(flags.n) || navigator.hardwareConcurrency;
const bucketSizes = (new Array(nBuckets)).fill(0);

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

// If we don't use detailled smoke-all, be sure to place smoke-all.tests.ts first for its own bucket
if (dontUseDetailledSmokeAll) {
  failed = true;
  flags.verbose &&
    console.log(`${smokeAllTestFile} will run it is own bucket`);
  buckets[0].push({
    name: smokeAllTestFile,
    timing: { real: 99999, user: 99999, sys: 99999 },
  });
  bucketSizes[0] += 99999;
}
// Add other test to the bucket will less overall timing
for (const timing of testTimings) {
  const ix = argmin(bucketSizes);
  buckets[ix].push(timing);
  bucketSizes[ix] += timing.timing.real;
}

for (const currentTest of currentTests) {
  // smoke-all.tests.ts is handled specifically
  if (
    currentTest.match(/smoke-all\.test\.ts/) &&
    (detailedSmokeAll || dontUseDetailledSmokeAll)
  ) {
    continue;
  }
  if (!timedTests.has(currentTest) && !RegSmokeAllFile.test(currentTest)) {
    flags.verbose && console.log(`Missing test ${currentTest} in timing.txt`);
    failed = true;
    // add missing timed tests, randomly to buckets
    buckets[Math.floor(Math.random() * nBuckets)].push({
      name: currentTest,
      timing: { real: 0, user: 0, sys: 0 },
    });
  }
}

flags.verbose && console.log(`Will run in ${nBuckets} cores`);
// FIXME: Not sure this still applies after new smoke-all treatment
if (!failed && flags.verbose) {
  console.log(
    `Expected speedup: ${
      (bucketSizes.reduce((a, b) => a + b, 0) / Math.max(...bucketSizes))
        .toFixed(
          2,
        )
    }`,
  );
}

// DRY-RUN MODE
if (flags["dry-run"]) {
  console.log(JSON.stringify(buckets, null, 2));
  Deno.exit(0);
}

if (flags["json-for-ci"]) {
  // JSON for CI matrix (GHA MODE)
  flags.verbose && console.log("Buckets of tests to run in parallel");
  const bucketSimple = buckets.map((bucket) => {
    return bucket.map((tt) => {
      tt.name = RegSmokeAllFile.test(tt.name)
        ? tt.name.split(" -- ")[1]
        : tt.name;
      return tt.name;
    });
  });
  //flags.verbose && console.log(buckets.map((e) => e.length));
  console.log(JSON.stringify(bucketSimple, null, 2));
} else {
  // LOCAL EXECUTION ON CORES
  console.log("Running `run-test.sh` in parallel... ");
  Promise.all(buckets.map((bucket, i) => {
    const cmd: string[] = ["./run-tests.sh"];
    cmd.push(...bucket.map((tt) => tt.name));
    return Deno.run({ cmd }).status();
  })).then(() => {
    console.log("Running `run-test.sh` in parallel... END");
  });
}
