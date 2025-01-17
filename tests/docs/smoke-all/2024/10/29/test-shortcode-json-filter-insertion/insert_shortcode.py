#!/usr/bin/env python
import json
import sys

inp = sys.stdin.read()
doc = json.loads(inp)

#######
# p_* are a bad version of a micro-panflute

def p_string(string):
  return {
    "t": "String",
    "c": string
  }

def p_meta_string(string):
  return {
    "t": "MetaString",
    "c": string
  }

def p_meta_val(val):
  if type(val) == str:
    return p_meta_string(val)
  if type(val) == dict:
    return p_meta_map(val)
  if type(val) == list:
    return p_meta_list(val)
  raise Exception("Unknown type: " + str(type(val)))

def p_meta_list(list):
  return {
    "t": "MetaList",
    "c": [p_meta_val(v) for v in list]
  }

def p_meta_map(dict):
  result = {}
  for k, v in dict.items():
    result[k] = p_meta_val(v)
  return {
    "t": "MetaMap",
    "c": result
  }

def p_attr(id, classes, attrs):
  return [id, classes, list([k, v] for k, v in attrs.items())]

def p_para(content):
  return {
    "t": "Para",
    "c": content
  }

#######

max_id = 0
for node in doc["meta"]["quarto-custom-node-data"]["c"]:
  if node["t"] == "MetaMap":
    max_id = max(max_id, int(node["c"]["quarto_custom_meta"]["c"]["id"]["c"]))

def shortcode_data():
  return {
    "name": "meta",
    "params": [ { "type": "param", "value": "baz" } ],
    "t": "Shortcode",
    "unparsed_content": r"{{< meta baz >}}",
    "quarto_custom_meta": {
      "id": str(max_id + 1) # this needs to be unique!!
    }
  }

def shortcode_span():
  return {
    "t": "Span",
    "c": [ 
      p_attr("", [], {"__quarto_custom": "true", "__quarto_custom_type": "Shortcode", "__quarto_custom_context": "Inline", "__quarto_custom_id": str(max_id + 1)}),
      [] # no content
    ]
  }

doc["meta"]["quarto-custom-node-data"]["c"].append(p_meta_val(shortcode_data()))
doc["blocks"].append(p_para([shortcode_span()]))

print(json.dumps(doc))