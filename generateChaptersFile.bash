#!/usr/local/bin/bash
echo "This is old. I have manually checked all chapters, "
(for x in $( gls -v OEBPS/xhtml/P*.xhtml ); do echo $x 1>&2; cat $x | grep '<span class="title"' | gsed 's#^.*<span class="title">\([^<]*\)</span>.*$#\1#g' | gsed "s%\$%\t${x}%g"; done ) > OEBPS/allchapters
cat OEBPS/allchapters | jq --raw-input --slurp 'split("\n")' | jq '.[] | split("\t")' | jq --slurp "." > OEBPS/chapters2.json