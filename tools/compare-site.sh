#!/bin/bash
# Uses https://github.com/cscheid/quarto-regress to render two versions of a website as
# a simple snapshot test. Usage

# To compare against 1.4.68,
# ./tools/compare-site.sh 1.4.68

v1=$1
v2=99.9.9

remove_numbers () {
  mkdir -p __compare
  mv _site __compare/_site_$version
  cd __compare/_site_$version
  # remove files that make no sense to compare
  rm docs/download/_prerelease.json
  rm _redirects

  ## FIXME: we should try to diff the .docx files as well, but we don't right now.
  find . -name "*.docx" -type f -delete

  find . -name "*.ipynb" -type f -exec gsed -i "s/\"id\"\: \"[0-9a-f-]\+\"/\"id\": \"uuid\"/g" {} \;
  gsed -i "s/<lastmod>.\\+<\/lastmod>//g" sitemap.xml
  cd ../..=
}

rm -rf __compare

QUARTO_FORCE_VERSION=0.0.0 qv $v1 render
version=$v1 
remove_numbers

QUARTO_FORCE_VERSION=0.0.0 quarto render
version=$v2
remove_numbers

echo "Diff output:"
diff -r _site_$v1 _site_$v2

