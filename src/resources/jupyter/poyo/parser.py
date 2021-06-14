# -*- coding: utf-8 -*-

import functools
import logging

from ._nodes import Root, Section, Simple

from .exceptions import (
    NoMatchException,
    NoParentException,
    NoTypeException,
    IgnoredMatchException,
)

from .patterns import (
    COMMENT,
    BLANK_LINE,
    DASHES,
    LIST,
    SIMPLE,
    SECTION,
    LIST_ITEM,
    NULL,
    TRUE,
    FALSE,
    FLOAT,
    INT,
    STR,
    MULTILINE_STR,
)

logger = logging.getLogger(__name__)


def log_callback(wrapped_function):
    """Decorator that produces DEBUG level log messages before and after
    calling a parser method.

    If a callback raises an IgnoredMatchException the log will show 'IGNORED'
    instead to indicate that the parser will not create any objects from
    the matched string.

    Example:
        DEBUG:poyo.parser:parse_simple <-     123: 456.789
        DEBUG:poyo.parser:parse_int <- 123
        DEBUG:poyo.parser:parse_int -> 123
        DEBUG:poyo.parser:parse_float <- 456.789
        DEBUG:poyo.parser:parse_float -> 456.789
        DEBUG:poyo.parser:parse_simple -> <Simple name: 123, value: 456.789>
    """

    def debug_log(message):
        """Helper to log an escaped version of the given message to DEBUG"""
        logger.debug(message.encode("unicode_escape").decode())

    @functools.wraps(wrapped_function)
    def _wrapper(parser, match, **kwargs):
        func_name = wrapped_function.__name__

        debug_log(
            u"{func_name} <- {matched_string}".format(
                func_name=func_name, matched_string=match.group()
            )
        )

        try:
            result = wrapped_function(parser, match, **kwargs)
        except IgnoredMatchException:
            debug_log(u"{func_name} -> IGNORED".format(func_name=func_name))
            raise

        debug_log(u"{func_name} -> {result}".format(func_name=func_name, result=result))

        return result

    return _wrapper


class _Parser(object):
    def __init__(self, source):
        self.pos = 0
        self.source = source
        self.max_pos = len(self.source)

        self.root = Root()
        self.seen = [self.root]

        self.rules = (
            (COMMENT, self.parse_comment),
            (BLANK_LINE, self.parse_blankline),
            (DASHES, self.parse_dashes),
            (LIST, self.parse_list),
            (MULTILINE_STR, self.parse_multiline_str),
            (SIMPLE, self.parse_simple),
            (SECTION, self.parse_section),
        )

        self.tag_rules = (
            (NULL, self.parse_null),
            (TRUE, self.parse_true),
            (FALSE, self.parse_false),
            (INT, self.parse_int),
            (FLOAT, self.parse_float),
            (STR, self.parse_str),
        )

    def find_at_level(self, level):
        for candidate in reversed(self.seen):
            if candidate.level < level:
                return candidate
        raise NoParentException("Unable to find element at level {}".format(level))

    def read_from_tag(self, string):
        for pattern, callback in self.tag_rules:
            match = pattern.match(string)

            if not match:
                # Pattern does not match, try the next one
                continue

            if match.group() != string:
                # Unable to match the full string, try the next pattern
                continue

            return callback(match)

        error_message = 'Unable to determine type for "{}"'
        raise NoTypeException(error_message.format(string))

    @log_callback
    def parse_comment(self, match):
        """Ignore line comments."""
        raise IgnoredMatchException

    @log_callback
    def parse_blankline(self, match):
        """Ignore blank lines."""
        raise IgnoredMatchException

    @log_callback
    def parse_dashes(self, match):
        """Ignore lines that contain three dash symbols."""
        raise IgnoredMatchException

    @log_callback
    def parse_list(self, match):
        groups = match.groupdict()
        level = len(groups["indent"])
        parent = self.find_at_level(level)

        item_matches = LIST_ITEM.findall(groups["items"])

        list_items = [self.read_from_tag(value) for value in item_matches]

        variable = self.read_from_tag(groups["variable"])
        return Simple(variable, level, list_items, parent=parent)

    @log_callback
    def parse_simple(self, match):
        groups = match.groupdict()

        level = len(groups["indent"])
        parent = self.find_at_level(level)

        variable = self.read_from_tag(groups["variable"])
        value = self.read_from_tag(groups["value"])

        return Simple(variable, level, value, parent=parent)

    @log_callback
    def parse_section(self, match):
        groups = match.groupdict()

        level = len(groups["indent"])
        parent = self.find_at_level(level)

        return Section(self.read_from_tag(groups["variable"]), level, parent=parent)

    @log_callback
    def parse_null(self, match):
        return None

    @log_callback
    def parse_true(self, match):
        return True

    @log_callback
    def parse_false(self, match):
        return False

    @log_callback
    def parse_int(self, match):
        return int(match.group())

    @log_callback
    def parse_float(self, match):
        return float(match.group())

    @log_callback
    def parse_str(self, match):
        quotes = match.group("quotes")
        return match.group().strip(quotes)

    def join_lines(self, lines, keep_newlines=False):
        result = ""
        concat = "\n" if keep_newlines else " "
        for line in lines:
            if line:
                result += line + concat
            else:
                result += "\n"
        return result.rstrip(" ").replace(" \n", "\n")

    @log_callback
    def parse_multiline_str(self, match):
        groups = match.groupdict()
        keep_newlines = groups["blockstyle"] == "|"
        chomp = groups["chomping"]
        level = len(groups["indent"])
        parent = self.find_at_level(level)
        variable = self.read_from_tag(groups["variable"])
        lines = groups["lines"].splitlines()
        if not lines:
            return Simple(variable, level, "", parent=parent)

        first_indent = groups["forceindent"]
        if first_indent:
            first_indent = int(first_indent)
        else:
            first_indent = len(lines[0]) - len(lines[0].lstrip())
        value = self.join_lines([l[first_indent:] for l in lines], keep_newlines)
        if not chomp:
            value = value.rstrip("\n") + "\n"
        elif chomp == "-":
            value = value.rstrip("\n")
        return Simple(variable, level, value.rstrip(""), parent=parent)

    def find_match(self):
        """Try to find a pattern that matches the source and calll a parser
        method to create Python objects.

        A callback that raises an IgnoredMatchException indicates that the
        given string data is ignored by the parser and no objects are created.

        If none of the pattern match a NoMatchException is raised.
        """
        for pattern, callback in self.rules:
            match = pattern.match(self.source, pos=self.pos)

            if not match:
                continue

            try:
                node = callback(match)
            except IgnoredMatchException:
                pass
            else:
                self.seen.append(node)

            return match

        raise NoMatchException(
            "None of the known patterns match for {}" "".format(self.source[self.pos :])
        )

    def __call__(self):
        """Parse the given string data and sequentually update the current
        cursor position until the end is reached.

        Return the Root object if successful.
        """
        while self.pos < self.max_pos:
            match = self.find_match()
            self.pos = match.end()
        return self.root()


def parse_string(string):
    parser = _Parser(string)
    return parser()
