#!/bin/zsh -l

# Always package from the extension root, including when opened from Finder.
cd -- "${0:A:h}" || exit 1
vsce pack
