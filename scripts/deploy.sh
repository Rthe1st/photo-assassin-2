#!/bin/bash
set -euo pipefail
IFS=$'\n\t'
set -x
# test
npm run-script check-format
npm run-script test
sudo docker build . -t photo-assassin
# deploy
sudo docker save photo-assassin | bzip2 | ssh debian@51.38.70.123 docker load
rsync ./secret/.env.prod debian@51.38.70.123:/home/debian/.env
rsync ./docker-compose.yml debian@51.38.70.123:/home/debian/docker-compose.yml
ssh debian@51.38.70.123 'cd /home/debian; docker-compose up -d'
