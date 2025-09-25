# 使用 node:22-alpine 作为构建专用镜像
FROM node:22-alpine AS builder

# 设置工作目录
WORKDIR /opt/app

# 安装 SQLite 和构建所需的依赖
RUN apk add --no-cache python3 make g++ py3-setuptools


# 将 package.json 复制到工作目录
COPY package.json ./

# 安装依赖
RUN npm install

# 将当前目录下的所有文件复制到工作目录
COPY . .

# 构建应用
RUN npm run build


# 使用更小的基础镜像创建最终的生产镜像
FROM node:22-alpine AS production

#设置工作目录
WORKDIR /opt/app

# 只复制构建后的文件，避免复制整个项目
COPY --from=builder /opt/app/dist /opt/app/dist
COPY --from=builder /opt/app/public /opt/app/public
COPY --from=builder /opt/app/prompt_store.json /opt/app/prompt_store.json
 
# 复制 package.json 并只安装生产依赖
COPY --from=builder /opt/app/package.json ./
# 临时安装构建依赖来编译原生模块，然后在同一层中删除它们
RUN apk add --no-cache --virtual .build-deps python3 make g++ py3-setuptools && \
    npm install --omit=dev && \
    apk del .build-deps

#暴露端口
EXPOSE 3000

#启动应用
CMD ["npm", "start"]