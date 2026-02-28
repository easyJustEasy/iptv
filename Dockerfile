FROM node:20-bookworm

WORKDIR /app

# 1. 清理默认源
RUN rm -rf /etc/apt/sources.list.d/* && \
    echo "deb http://mirrors.aliyun.com/debian bookworm main non-free non-free-firmware\n\
    deb http://mirrors.aliyun.com/debian bookworm-updates main non-free non-free-firmware\n\
    deb http://mirrors.aliyun.com/debian-security bookworm-security main non-free non-free-firmware" > /etc/apt/sources.list

# 2. 使用淘宝 NPM 和 Playwright 镜像
RUN npm config set registry https://registry.npmmirror.com
ENV PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright

# 3. 安装 Playwright 浏览器（含系统依赖）
RUN npx playwright install --with-deps chromium


# 4. 安装项目依赖
COPY package*.json ./
RUN npm install

# 5. 复制代码
COPY . ./


EXPOSE 7000

CMD ["node", "server.js"]