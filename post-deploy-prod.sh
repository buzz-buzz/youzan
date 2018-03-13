#!/bin/bash
yarn --prod &&
pm2 startOrGracefulReload ecosystem.config.js --env production --only youzan-prod &&
pm2 save
