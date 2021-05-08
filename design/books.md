# Basics

## Overview

- What is a Quarto book? A combination of multiple documents into a single manuscript or a website.
- Book website vs. normal website:

  - Has various other versions
  - Has numbered chapters/sections and cross references

- Examples

## Getting Started

quarto create-project --type book

- configuration (\_quarto.yml)

project:
type: book

book:
contents:
appendix

## Workflow

dev server / incremental preview

building all versions of the book

# Authoring

## Structure

- index page
- contents / references / appendix
- parts
- numbered and unnumbered sections

No YAML front matter, just level 1 header

## Code Execution

Rmd
ipynb

- cache
- freeze

## Cross References

- Chapters/sections
- Other stuff

## Callouts

- Callout types
- Handling in different formats

## Reader Tools

- Search
- Download
- Sharing
- Repo
- Comments

## Options

- Sidebar options
- Page navigation
- Attribution
