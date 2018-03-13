#!/bin/bash
m=$1
if [ $# -eq 0 ]
  then
    m='[!]'
fi
git add . &&
git commit -m "$m" &&
git checkout master &&
git pull &&
git merge --no-edit develop master &&
git push &&
git checkout develop &&
pm2 deploy ecosystem.config.js production
