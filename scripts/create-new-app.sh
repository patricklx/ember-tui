#!/bin/bash
set -ex


pnpx ember-cli new "$@" --typescript
cd $1

curl https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/scripts/setup.sh | bash -s -- "$@"
