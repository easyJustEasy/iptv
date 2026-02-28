const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'channels.json');
const SCRAPER_SCRIPT = path.join(__dirname, 'scraper.js');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 辅助函数：读取数据
function readData() {
    if (!fs.existsSync(DATA_FILE)) {
        return null;
    }
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.error('读取数据文件失败:', e.message);
        return null;
    }
}

// API: 获取频道列表
app.get('/api/channels', (req, res) => {
    const data = readData();
    if (data === null) {
        return res.status(404).json({ 
            error: '数据文件不存在', 
            message: '请先运行 "node scraper.js" 抓取数据，或在网页点击刷新按钮。' 
        });
    }
    res.json(data);
});

// API: 触发爬虫更新
app.post('/api/scrape', (req, res) => {
    console.log('🔄 收到刷新请求，正在启动爬虫子进程...');
    
    // 使用 child_process 异步执行 scraper.js
    // 注意：这里假设 node 环境变量可用
    const child = exec(`node "${SCRAPER_SCRIPT}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`爬虫执行错误: ${error.message}`);
            return res.status(500).json({ error: '爬虫执行失败', details: stderr || error.message });
        }
        if (stderr) {
            console.error(`爬虫标准错误: ${stderr}`);
        }
        console.log(`爬虫输出:\n${stdout}`);
        
        // 爬虫完成后，重新读取数据返回给前端
        const newData = readData();
        res.json({ 
            message: '抓取成功', 
            count: newData ? newData.length : 0,
            log: stdout 
        });
    });

    // 可选：如果爬虫时间很长，可以先返回一个“正在处理”的状态，这里为了简单等待完成
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`
    ========================================
    🚀 Express 服务已启动
    🌐 访问地址: http://localhost:${PORT}
    📡 数据接口: http://localhost:${PORT}/api/channels
    📝 数据文件: ${DATA_FILE}
    
    💡 提示: 
       - 如果数据为空，请运行: node scraper.js
       - 或者在网页上点击 "更新数据" 按钮
    ========================================
    `);
});