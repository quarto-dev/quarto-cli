import yaml
import json
import glob

class Trie:

    def __init__(self):
        self.children = {}
        self.values = []

    def insert(self, path, value):
        node = self
        for c in path:
            if c not in node.children:
                node.children[c] = Trie()
            node = node.children[c]
        node.values.append(value)

    def json(self):
        if not self.children:
            return self.values
        return {k: v.json() for k, v in self.children.items()}
    
    def tabulator_leaf(self):
        result = {}
        for v in self.values:
            result[v["format"]] = v["table_cell"]
        return result

    def tabulator(self):
        if not self.children:
            return []
        result = []
        for k, v in self.children.items():
            d = {
                "feature": k,
                **v.tabulator_leaf()
            }
            children = v.tabulator()
            if children:
                d["_children"] = children
            result.append(d)
        return result

    def depth(self):
        if not self.children:
            return 0
        return max([v.depth() for v in self.children.values()]) + 1

    def size(self):
        if not self.children:
            return 1
        return sum([v.size() for v in self.children.values()])
    
    def walk(self, visitor):
        visitor(self)
        for v in self.children.values():
            v.walk(visitor)

def extract_metadata_from_file(file):
    with open(file, "r") as f:
        lines = f.readlines()
    start = None
    end = None
    for i, line in enumerate(lines):
        if line.strip() == "---":
            if start is None:
                start = i
            else:
                end = i
                metadata = yaml.load("".join(lines[start+1:end]), Loader=yaml.SafeLoader)
                return metadata
    raise ValueError("No metadata found in file %s" % file)

def table_cell(entry, _feature, _format_name, format_config):
    if type(format_config) == str:
        format_config = {}
    result = []
    quality = format_config.get("quality", "unknown")
    if quality is not None:
        # use forbidden sign for -1, yellow circle for 0, and green circle for 1
        qualities = {-1: "&#x1F6AB;", 0: "&#x26A0;", 1: "&#x2713;"}
        colors = {-1: "#b05050", 0: "#c09060", 1: "#5050b0"}
        # use question mark icon for missing
        color = colors.get(quality, "inherit")
        quality_icon = qualities.get(quality, "&#x2753;")
        result.append(f"<span style='color: {color}'>{quality_icon}</span>")
    link = "<a href='%s' target='_blank'><i class='fa-solid fa-link' aria-label='link'></i></a>" % entry
    result.append(link)
    return "".join(result)

def compute_trie():
    trie = Trie()
    for entry in glob.glob("qmd-files/**/document.qmd", recursive=True):
        feature = entry.split("/")[1:-1]
        front_matter = extract_metadata_from_file(entry)
        try:
            format = front_matter["format"]
        except KeyError:
            raise Exception("No format found in %s" % entry)
        for format_name, format_config in format.items():
            trie.insert(feature, {
                "feature": "/".join(feature),
                "format": format_name,
                "format_config": format_config,
                "table_cell": table_cell(entry, feature, format_name, format_config)
            })
    return trie

def render_features_formats_data(trie = None):
    if trie is None:
        trie = compute_trie()
    entries = trie.tabulator()
    return "```{=html}\n<script type='text/javascript'>\nvar tableData = %s;\n</script>\n```\n" % json.dumps(entries, indent=2)

def compute_quality_summary(trie = None):
    if trie is None:
        trie = compute_trie()
    quality_summary = {"unknown": 0, -1: 0, 0: 0, 1: 0}
    n_rows = 0
    def visit(node):
        nonlocal n_rows
        n_rows = n_rows + 1
        for v in node.values:
            config = v["format_config"]
            if type(config) == str:
                config = {}
            quality = config.get("quality", "unknown")
            if quality_summary.get(quality) is None:
                raise ValueError("Invalid quality value %s" % quality)
            quality_summary[quality] += 1
    trie.walk(visit)
    return {"n_rows": n_rows, "quality": quality_summary}