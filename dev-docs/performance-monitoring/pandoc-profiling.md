To perform fine-grained profiling of Pandoc Lua filters, we use custom binaries:

- a patch of Lua that supports sample-based profiling
- a custom binary of Pandoc linked against that version of Lua

## Compile the custom Lua version

This has currently only been tested on Macos and Linux.

```
$ git clone git@github.com:cscheid/lua-fast-profiler.git
$ cd lua-fast-profiler
$ git checkout feature/fast-profiler-5.4
$ make
```

You should have `lua` and `liblua.a` in the `lua-fast-profiler` directory.

This version of Lua adds a new debugging hook, "time".
This hook triggers at specified intervals, and is enabled using the letter `t` in the `debug.sethook` call.
The debug hook callback also supports the "alarm" hook, used when calling the `sethook` callback.

Quarto ships with a custom Lua profiler that supports these hooks and performs low-overhead stack profiling.

## Compile the custom Pandoc binary

Clone the Pandoc repository, and then

```
$ C_INCLUDE_PATH=<path-lua-fast-profiler> LIBRARY_PATH=<path-lua-fast-profiler> cabal build pandoc-cli --constraint 'lua +system-lua'
```

## Use the custom Pandoc binary

```
$ QUARTO_PANDOC=<path-to-built-pandoc> quarto render ...
```

To get Lua profiling output from Quarto, use the `lua-profiler-output` metadata option to provide an output file name.
The output will be written as JSON, in a format compatible with [Perfetto](https://ui.perfetto.dev).
The default sampling interval is 5ms, but you can customize that by setting the `lua-profiler-interval-ms` metadata option.

## Analyze profile

The resulting profile can be visualized and analyzed as a trace file at <https://ui.perfetto.dev>.
