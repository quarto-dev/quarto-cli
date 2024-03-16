#!/bin/bash
#
# Use this script to drive `git bisect run` to find the commit that introduced a behavior:
#
# - create a test that fails
# - `git bisect start`
# - `git bisect new` to mark the current commit as the new behavior
# - Find a commit that is known to have the old and run `git bisect old` from there
# - `git bisect run tests/git-bisect-test.sh <test-name> [flip]`
#   - if `flip` is passed as the second argument, the script will return 1 on 
#     success and 0 on failure, so that the bisect will find the first commit 
#     that passes the test rather than the first commit that fails it

./configure.sh
cd tests
./run-fast-tests.sh $1

result=$?

if [ "$2" == "flip" ]; then
  if [ $result -eq 0 ]; then
    exit 1
  else
    exit 0
  fi
else
  if [ $result -eq 0 ]; then
    exit 0
  else
    exit 1
  fi
fi