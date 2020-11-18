#!/usr/bin/env python

import sys
import json

input_json = json.load(sys.stdin)

json.dump(input_json, sys.stdout)
