The macOS notarization procedure doesn't like directories with periods in their names.

We replace all the periods with dashes, then edit the import map to do the right thing.

This needs to happen every time we update our `deno vendor` dependencies.
