# -*- coding: utf-8 -*-

import codecs


def read_unicode_file(file_path):
    with codecs.open(file_path, encoding="utf-8") as f:
        return f.read()
