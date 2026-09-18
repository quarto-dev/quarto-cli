# RevealJS Multiplex Server (Local Test Instance)

This is a local instance of the [reveal/multiplex](https://github.com/reveal/multiplex) server used for testing Quarto's RevealJS multiplex feature.

## Purpose

This server enables testing of the multiplex presentation feature without relying on external services. It:

- Generates tokens (secret/socketId pairs)
- Manages socket.io connections between master and client presentations
- Broadcasts presentation state changes from master to clients

## Usage

The server is automatically started by Playwright's `webServer` configuration when running tests. It listens on `http://localhost:1948` by default.

## Installation

Dependencies are automatically installed by `tests/integration/playwright-tests.test.ts` before running Playwright tests.

Manual installation:
```bash
npm install
```

## Running Manually

```bash
npm start
```

## Attribution

Server code is from the [reveal/multiplex](https://github.com/reveal/multiplex) repository.
