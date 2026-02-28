# 1. 基础镜像：使用 Playwright 官方镜像 (已包含 Chromium 和系统依赖)
# 注意：请根据实际可用的标签调整版本号，v1.56.1 如果不存在，可改用 v1.49.0 或 latest
FROM node:20-bookworm
# 设置工作目录
WORKDIR /app

# 2. 安装 Node.js (使用 NodeSource 脚本安装 LTS 版本，例如 Node 20)
# 如果镜像里没有 curl，请先 apt-get update && apt-get install -y curl
USER root
# 验证版本
RUN node -v && npm -v

# 3. 复制项目文件
# 先复制 package.json 和 lock 文件，利用 Docker 缓存层加速构建
COPY package*.json ./


RUN npm install

RUN npx playwright install chromium --with-deps

# 复制源代码
COPY . .


# 6. 暴露端口 (根据你的 server.js 配置)
EXPOSE 7000

# 7. 启动命令
# 假设你的入口文件是 server.js
CMD ["node", "server.js"]