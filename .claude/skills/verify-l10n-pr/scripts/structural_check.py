# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "ruamel.yaml",
# ]
# ///
"""Structural checks for a quarto-cli `_language-<code>.yml` localization file
against the base `src/resources/language/_language.yml`. No translation
quality judgment — that needs a human or an MT spot-check (see SKILL.md)."""

import re
import sys

from ruamel.yaml import YAML

PLACEHOLDER_RE = re.compile(r"\{\d+\}")
WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)


def load(path):
    yaml = YAML()
    yaml.preserve_quotes = True
    with open(path, encoding="utf-8") as f:
        return yaml.load(f)


def check_key_parity(base, target):
    base_keys, target_keys = set(base), set(target)
    missing = sorted(base_keys - target_keys)
    extra = sorted(target_keys - base_keys)
    if missing:
        print(f"MISSING KEYS ({len(missing)}): {missing}")
    if extra:
        print(f"EXTRA KEYS ({len(extra)}): {extra}")
    if not missing and not extra:
        print(f"Key parity OK ({len(base_keys)} keys)")


def check_placeholders(base, target):
    problems = []
    for key, base_val in base.items():
        target_val = target.get(key)
        if not isinstance(base_val, str) or not isinstance(target_val, str):
            continue
        base_ph = sorted(PLACEHOLDER_RE.findall(base_val))
        target_ph = sorted(PLACEHOLDER_RE.findall(target_val))
        if base_ph != target_ph:
            problems.append((key, base_ph, target_ph))
    if problems:
        print(f"PLACEHOLDER MISMATCHES ({len(problems)}):")
        for key, base_ph, target_ph in problems:
            print(f"  {key}: base={base_ph} target={target_ph}")
    else:
        print("Placeholder consistency OK")


def check_whitespace_and_empty(base, target):
    problems = []
    for key, val in target.items():
        base_val = base.get(key)
        if isinstance(val, str):
            if val != val.strip():
                problems.append((key, "leading/trailing whitespace in value"))
            if val.strip() == "" and isinstance(base_val, str) and base_val.strip() != "":
                problems.append((key, "empty value but base has content"))
        elif isinstance(base_val, str) and base_val.strip() != "":
            problems.append((key, f"null/non-string value ({val!r}) but base has content"))
    if problems:
        print(f"WHITESPACE/EMPTY ISSUES ({len(problems)}):")
        for key, issue in problems:
            print(f"  {key}: {issue}")
    else:
        print("Whitespace/empty check OK")


def check_raw_line_trailing_whitespace(path):
    """Catches whitespace outside the quoted value (e.g. `key: "val" ` with a
    trailing space after the closing quote) that git diff --check would flag
    but a parsed-value check misses."""
    problems = []
    with open(path, encoding="utf-8") as f:
        for lineno, line in enumerate(f, start=1):
            stripped = line.rstrip("\n")
            if stripped != stripped.rstrip():
                problems.append(lineno)
    if problems:
        print(f"RAW LINE TRAILING WHITESPACE ({len(problems)}): lines {problems}")
    else:
        print("Raw line trailing-whitespace check OK")


def _meaningful_words(text):
    """Words worth comparing. ASCII words shorter than 5 chars are dropped as
    likely function words (the/of/in/...). Non-ASCII words are kept at any
    length: unspaced scripts (CJK) tokenize a whole phrase as one run, and
    many languages' words for "navigation" are short (e.g. 2 Hangul/Hanzi
    characters), so the ASCII stopword heuristic doesn't transfer."""
    words = set()
    for w in WORD_RE.findall(text):
        if w.isascii() and len(w) < 5:
            continue
        words.add(w.lower())
    return words


def check_navigation_landmark_rule(target):
    """Language-agnostic heuristic for quarto's accessibility rule: values for
    navigation-*-label keys must not contain the language's word for
    "navigation" (screen readers already announce the landmark role). We don't
    know each language's word for "navigation", so instead compare each label
    value's words against the words in *this same file's* `toggle-navigation`
    value, which is expected to contain that word. A shared word/stem is a
    likely rule violation worth a human look, not a certain one."""
    reference = target.get("toggle-navigation")
    if not isinstance(reference, str):
        print("Navigation-landmark check skipped: no `toggle-navigation` key found")
        return
    reference_words = _meaningful_words(reference)
    if not reference_words:
        print("Navigation-landmark check skipped: no meaningful words found in `toggle-navigation` value")
        return
    label_keys = [k for k in target if re.match(r"^navigation-.*-label$", k)]
    flagged = []
    skipped = []
    for key in label_keys:
        val = target.get(key)
        if not isinstance(val, str):
            continue
        val_words = _meaningful_words(val)
        if not val_words:
            skipped.append(key)
            continue
        shared = {
            w
            for w in val_words
            for r in reference_words
            if w in r or r in w
        }
        if shared:
            flagged.append((key, val, shared))
    if flagged:
        print(f"NAVIGATION-LANDMARK RULE — POSSIBLE VIOLATIONS ({len(flagged)}):")
        for key, val, shared in flagged:
            print(f"  {key} = {val!r} shares {shared} with toggle-navigation = {reference!r}")
        print("  (heuristic, not certain — confirm against the accessibility rule comment in _language.yml)")
    else:
        checked = len(label_keys) - len(skipped)
        print(f"Navigation-landmark check OK ({checked} label keys checked)")
    if skipped:
        print(f"  Skipped {len(skipped)} label(s) with no meaningful words to compare: {skipped}")


def main():
    if len(sys.argv) != 3:
        print("usage: structural_check.py <base _language.yml> <target _language-XX.yml>")
        sys.exit(1)
    base = load(sys.argv[1])
    target = load(sys.argv[2])
    check_key_parity(base, target)
    print()
    check_placeholders(base, target)
    print()
    check_whitespace_and_empty(base, target)
    print()
    check_raw_line_trailing_whitespace(sys.argv[2])
    print()
    check_navigation_landmark_rule(target)


if __name__ == "__main__":
    main()
