#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
set -x
# test
npm run-script check-format
npm run-script test
sudo docker build . -t photo-assassin
sudo docker-compose -f ./docker-compose.yml -f ./docker-compose.dev.yml up -d
npm run-script integration-test
sudo docker-compose -f ./docker-compose.yml -f ./docker-compose.dev.yml down
