#!/usr/bin/env bash

# Run tests without reconfiguring the environment (faster for repeated test runs)
#
# Environment variables set:
#   QUARTO_TESTS_FORCE_NO_VENV - Skip activating .venv virtual environment
#                                 (tests use system Python packages instead)
#   QUARTO_TESTS_NO_CONFIG - Skip running configure-test-env.sh
#                            (don't reinstall/update R, Python, Julia dependencies)
#   QUARTO_TESTS_NO_CHECK - Not currently used by run-tests.sh
#                           (kept for backward compatibility in case checked elsewhere)
#
# Note: Only use after running configure-test-env.sh at least once to set up environment.
#       Consider removing QUARTO_TESTS_FORCE_NO_VENV if Python tests require .venv packages.

QUARTO_TESTS_FORCE_NO_VENV=true QUARTO_TESTS_NO_CONFIG=true QUARTO_TESTS_NO_CHECK=true ./run-tests.sh $*