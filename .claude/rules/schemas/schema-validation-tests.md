---
paths:
  - "src/resources/schema/**/*"
  - "tests/unit/schema-validation/**/*"
---

# Testing schema changes

Test whether a YAML value is accepted or rejected with a table-driven unit test under `tests/unit/schema-validation/`, validating against the real schema (example: `front-matter-social-metadata.test.ts`), not with a smoke-all document per value.
Unit tests load the generated schema resources, so run `dev-call build-artifacts` after a schema edit before running them.
Helpers, which schema to use for front matter vs `_quarto.yml`, and how to prove RED: `llm-docs/testing-patterns.md` § "Schema Validation Tests".
