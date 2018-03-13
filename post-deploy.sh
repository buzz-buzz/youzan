#!/bin/bash
yarn &&
pm2 startOrGracefulReload ecosystem.config.js --only youzan-dev &&
pm2 save
