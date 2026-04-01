# ensurePdfTextPositions Test API

A test predicate for verifying the spatial layout of text in rendered PDFs. Use this to assert that elements appear in the correct positions relative to each other.

## Requirements

- **Tagged PDFs only**: This API requires PDFs with PDF 1.4+ structure tree support (MCIDs linking text to semantic elements)
- **Typst**: Works out of the box (Typst produces tagged PDFs by default)
- **LaTeX**: Not currently supported (requires `\DocumentMetadata{}` before `\documentclass`)

## Basic Usage

Add assertions to your `.qmd` file's YAML front matter:

```yaml
_quarto:
  tests:
    typst:
      ensurePdfTextPositions:
        - # First array: positive assertions (these must be true)
          - subject: "Chapter 1"
            relation: above
            object: "Introduction text"
          - subject: "Margin note"
            relation: rightOf
            object: "Body paragraph"
        - [] # Second array: negative assertions (these must NOT be true)
      noErrors: default
```

## Text Selectors

A selector identifies text in the PDF. It can be a simple string or an object with options.

### Simple String Selector

```yaml
subject: "Hello World"
```

Searches for text containing "Hello World". The text must appear exactly once in the PDF.

### Object Selector

```yaml
subject:
  text: "Hello World"
  role: "H1"
  page: 1
  edge: left
  granularity: "Div"
```

| Field | Description |
|-------|-------------|
| `text` | Text to search for (required unless `role: "Page"`) |
| `role` | Expected PDF structure role (see Roles below) |
| `page` | Page number, 1-indexed (required for `role: "Page"`) |
| `edge` | Override which edge to use: `left`, `right`, `top`, `bottom` |
| `granularity` | Aggregate bounding box to ancestor with this role |

## Roles

Standard PDF structure roles: `P`, `H1`, `H2`, `H3`, `Figure`, `Table`, `Span`, `Div`, etc.

### Special Roles

**`Decoration`** - For untagged page elements like headers, footers, and page numbers:

```yaml
subject:
  text: "Page 1"
  role: "Decoration"
```

- Uses raw text item bounds (no structure tree lookup)
- Allows multiple matches (uses first match)

**`Page`** - Represents the entire page area:

```yaml
subject:
  role: "Page"
  page: 2
```

- The `text` field is ignored
- Useful for negative assertions (e.g., "this text should NOT be on page 1")

## Relations

### Directional Relations

Assert spatial ordering between elements.

| Relation | Meaning | Default Edges |
|----------|---------|---------------|
| `above` | Subject is above object | subject.bottom < object.top |
| `below` | Subject is below object | subject.top > object.bottom |
| `leftOf` | Subject is left of object | subject.right < object.left |
| `rightOf` | Subject is right of object | subject.left > object.right |

**Distance constraints** (optional):

```yaml
- subject: "Title"
  relation: above
  object: "Subtitle"
  byMin: 10    # At least 10pt gap
  byMax: 50    # At most 50pt gap
```

### Alignment Relations

Assert that edges are aligned (within tolerance).

| Relation | Meaning |
|----------|---------|
| `topAligned` | Top edges match |
| `bottomAligned` | Bottom edges match |
| `leftAligned` | Left edges match |
| `rightAligned` | Right edges match |

```yaml
- subject: "Column A"
  relation: leftAligned
  object: "Column B"
  tolerance: 5  # Allow 5pt difference (default: 2pt)
```

### Tag-Only Assertions

Validate that text exists with a specific role (no position comparison):

```yaml
- subject:
    text: "Important"
    role: "H1"
```

## Edge Overrides

Override which edge is used for comparison:

```yaml
- subject:
    text: "Left column"
    edge: right        # Use right edge of subject
  relation: leftOf
  object:
    text: "Right column"
    edge: left         # Use left edge of object
```

Default edges per relation:

| Relation | Subject Edge | Object Edge |
|----------|--------------|-------------|
| `leftOf` | right | left |
| `rightOf` | left | right |
| `above` | bottom | top |
| `below` | top | bottom |
| `leftAligned` | left | left |
| `rightAligned` | right | right |
| `topAligned` | top | top |
| `bottomAligned` | bottom | bottom |

## Granularity

Aggregate the bounding box to an ancestor element:

```yaml
- subject:
    text: "cell content"
    granularity: "Table"  # Use entire table's bbox, not just the cell
  relation: below
  object: "Heading"
```

This walks up the structure tree to find an ancestor with the specified role and computes the bounding box from all its descendant content.

## Negative Assertions

The second array contains assertions that must NOT be true:

```yaml
_quarto:
  tests:
    typst:
      ensurePdfTextPositions:
        - # Positive (must be true)
          - subject: "Content"
            relation: below
            object: "Title"
        - # Negative (must NOT be true)
          - subject: "Margin note"
            relation: leftOf
            object: "Body text"
```

Negative assertions pass if:
- The elements are on different pages
- The spatial relation does not hold
- Either element is not found

## Coordinate System

- Origin: top-left corner of page
- X: increases rightward
- Y: increases downward

## Error Messages

### "Cannot compare positions: X is on page 1, Y is on page 2"

The two elements are on different pages. This is an error, not a pass or fail. If you expect elements to potentially be on different pages, use negative assertions.

### "Text X is ambiguous - found N matches"

The search text appears multiple times. Use a more specific string, or use `role: "Decoration"` if this is expected (e.g., repeated headers).

### "Text not found in PDF: X"

The search text doesn't exist in the PDF.

### "Text X has no MCID - PDF may not be tagged"

The text exists but isn't linked to the structure tree. Use `role: "Decoration"` for untagged elements.

## Examples

### Verify heading hierarchy

```yaml
ensurePdfTextPositions:
  - - subject: "Chapter 1"
      relation: above
      object: "Section 1.1"
    - subject: "Section 1.1"
      relation: above
      object: "Section 1.2"
  - []
```

### Verify margin layout

```yaml
ensurePdfTextPositions:
  - - subject: "Margin note text"
      relation: rightOf
      object: "Body paragraph"
    - subject: "Margin note text"
      relation: topAligned
      object: "Body paragraph"
  - []
```

### Verify header/footer positioning

```yaml
ensurePdfTextPositions:
  - - subject:
        text: "HEADER_TEXT"
        role: "Decoration"
      relation: above
      object: "Page content"
    - subject: "Page content"
      relation: above
      object:
        text: "FOOTER_TEXT"
        role: "Decoration"
  - []
```

### Verify elements are NOT on a specific page

```yaml
ensurePdfTextPositions:
  - []  # No positive assertions
  - # Negative: "Secret" should NOT be anywhere on page 1
    - subject: "Secret content"
      relation: above
      object:
        role: "Page"
        page: 1
```

### Verify minimum spacing

```yaml
ensurePdfTextPositions:
  - - subject: "Figure 1"
      relation: above
      object: "Figure 1 caption"
      byMin: 5   # At least 5pt gap
      byMax: 20  # At most 20pt gap
  - []
```

### Verify column alignment

```yaml
ensurePdfTextPositions:
  - - subject: "Row 1 Col A"
      relation: leftAligned
      object: "Row 2 Col A"
      tolerance: 1
    - subject: "Row 1 Col B"
      relation: leftAligned
      object: "Row 2 Col B"
      tolerance: 1
  - []
```
