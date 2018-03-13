# youzan

## 环境

node: latest

## 配置

默认: `config/default.js`

开发: `config/development.js`

生产: `config/production.js`

测试: `config/test.js`

### 覆盖

本地: `config/local.js`

环境变量: `NODE_CONFIG='{"mongodb":{"uri":""},"redis":{"host":"","password":"", "port":6379,"db": 2},"youzan":{"default":{"clientID":"","clientSecret":"","kdt_id":"","kdt_name":""}}}'`

## 安装

`yarn`

## 开发

`yarn dev`

## 测试

`yarn test`
