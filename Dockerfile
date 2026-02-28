FROM node:20-bookworm

# ==========================================
# 1. 彻底替换 APT 源（兼容 deb822 格式）
# ==========================================
RUN rm -f /etc/apt/sources.list.d/*.sources && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    echo "deb https://mirrors.tuna.tsinghua.edu.cn/debian-security bookworm-security main contrib non-free non-free-firmware" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        curl ca-certificates wget gnupg \
    && rm -rf /var/lib/apt/lists/*

# ==========================================
# 2. 设置工作目录与环境变量
# ==========================================
WORKDIR /app

# 关键：设置 Playwright 国内镜像（支持 CfT）
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

# ==========================================
# 3. 安装 Node 依赖
# ==========================================
COPY package*.json ./
RUN npm install -g pnpm && pnpm install

# ==========================================
# 4. 手动安装 Playwright Chromium 所需系统依赖（Bookworm 正确列表）
# ==========================================
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libnss3 \
        libnspr4 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libasound2 \
        libpango-1.0-0 \
        libcairo2 \
        libatspi2.0-0 \
        libxshmfence1 \
        libwayland-client0 \
        libwayland-cursor0 \
        libwayland-egl1 \
        libwayland-server0 \
        libx11-xcb1 \
        libxcb-dri3-0 \
        libxcb-shape0 \
        libxcb-shm0 \
        libxcb-sync1 \
        libxcb-xfixes0 \
        libxcb-randr0 \
        libxcb-render0 \
        libx11-6 \
        libxext6 \
        libice6 \
        libsm6 \
        libfontconfig1 \
        libfreetype6 \
        libexpat1 \
        libffi8 \
        libdbus-1-3 \
        libgtk-3-0 \
        libnotify4 \
        libsecret-1-0 \
        # 可选但推荐：避免 headless 模式警告
        xvfb xauth xfonts-base \
    && rm -rf /var/lib/apt/lists/*

# ==========================================
# 5. 仅下载浏览器（不依赖 --with-deps）
# ==========================================
RUN npx playwright install 

# ==========================================
# 6. 复制应用代码
# ==========================================
COPY . .

EXPOSE 7000
CMD ["node", "server.js"]