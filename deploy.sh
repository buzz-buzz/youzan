#!/bin/bash
git checkout master &&
git pull &&
git merge --no-edit develop master &&
git push &&
git checkout develop &&
pm2 deploy ecosystem.config.js production
