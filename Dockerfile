FROM node:9-alpine
RUN mkdir -p /app
WORKDIR /app
COPY . /app/
ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
RUN npm i -g yarn --registry=https://registry.npm.taobao.org \
  && YARN_REGISTRY='https://registry.npm.taobao.org' yarn --cache-folder /yarn-cache
ENTRYPOINT ["yarn"]
CMD ["start"]
