#!/bin/bash
sudo docker rm photo-assassin -f
case "$1" in
    "")
    echo "rebuilding docker image"
    sudo docker build . -t photo-assassin;;
    "--skip-build")
    echo "not rebuilding docker image";;
    *)
    echo "bad arg"
    exit 1;;
esac
npm run-script build
sudo docker run -d --rm --name photo-assassin -p 3000:3000 --env-file .env --volume=`pwd`/secret:/home/node/app/secret --volume=`pwd`/dist:/home/node/app/dist photo-assassin
npm run-script integration-test