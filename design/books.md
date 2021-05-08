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

# Authoring

## Workflow

dev server / incremental preview

cache and freeze

building all versions of the book

## Structure

- index page
- contents / references / appendix
- parts
- numbered and unnumbered sections

No YAML front matter, just level 1 header

## Cross References

- Chapters/sections
- Other stuff

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
