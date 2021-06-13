# -*- coding: utf-8 -*-


class PoyoException(Exception):
    """Super class for all of Poyo's exceptions."""


class NoMatchException(PoyoException):
    """Raised when the parser cannot find a pattern that matches the given
    string.
    """


class NoParentException(PoyoException):
    """Raised when there is no parser object at the given level.
    """


class NoTypeException(PoyoException):
    """Raised when the parser is unable to determine the actual type for a
    given string.
    """


class IgnoredMatchException(PoyoException):
    """Raised when a match does result in a Python representation such as a
    comment or a blank line.
    """
