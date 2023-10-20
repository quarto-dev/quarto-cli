## A test manager server for parallel testing across many machines

NB: This requires the git version of quarto.

## Usage

To start the test manager server, run the following command:

```bash
cd quarto-cli/tests
quarto deno run test-manager.ts
```

To start a test worker, run the following command:

```bash
cd quarto-cli/tests
quarto deno run test-worker.ts $SERVER_URL
```

If you pass no further parameters, test worker will spawn as many threads as
reported by `navigator.hardwareConcurrency`. You can also specify the number of
threads to spawn:

```bash
cd quarto-cli/tests
quarto deno run test-worker.ts $SERVER_URL 5
```
