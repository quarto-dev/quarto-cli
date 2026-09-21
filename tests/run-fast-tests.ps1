# Run tests without reconfiguring the environment (faster for repeated test runs)
#
# Environment variables set:
#   QUARTO_TESTS_NO_CONFIG - Skip running configure-test-env.ps1
#                            (don't reinstall/update R, Python, Julia dependencies)
#
# Note: This still activates .venv if present, so Python tests use correct dependencies.
#       Only use after running configure-test-env.ps1 at least once to set up environment.

$env:QUARTO_TESTS_NO_CONFIG="true"
& .\run-tests.ps1 @args
