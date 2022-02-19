#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
set -x
# test
npm run-script check-format
npm run-script test
sudo docker build . -t photo-assassin
