const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ================= 配置区域 =================
const CONFIG = {
    url: 'https://www.lyngsat.com/stream/tvcountry/China.html',
    // 注意：绝对位置选择器非常脆弱，如果网站布局变化，需调整 nth-child(14)
    tableSelector: 'body > div:nth-child(1) > table > tbody > tr > td:nth-child(2) > table:nth-child(14)',
    linearText: 'Linear Streaming',
    outputFile: path.join(__dirname, 'channels.json'),
    headless: true, // 设为 false 可以看到浏览器运行过程，方便调试
    timeout: 30000
};

// ================= 主逻辑 =================

async function startScraping() {
    let browser;
    const results = [];

    try {
        // 1. 启动浏览器
        console.log(`🚀 正在启动浏览器 (Headless: ${CONFIG.headless})...`);
        browser = await chromium.launch({
            headless: CONFIG.headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        const page = await context.newPage();

        // 2. 访问主页
        console.log(`🌐 正在访问: ${CONFIG.url}`);
        await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: CONFIG.timeout });
        
        // 等待一下，防止反爬
        await page.waitForTimeout(1500);

        // 3. 定位表格
        console.log('🔍 正在定位目标表格...');
        const tableElement = await page.$(CONFIG.tableSelector);

        if (!tableElement) {
            throw new Error(`❌ 未找到表格！请检查选择器是否正确: ${CONFIG.tableSelector}\n提示：网站布局可能已更新，nth-child 索引可能发生变化。`);
        }

        // 4. 获取所有行
        const rows = await tableElement.$$('tr');
        console.log(`📋 找到 ${rows.length} 行数据，开始处理...`);

        let successCount = 0;
        let failCount = 0;

        // 5. 遍历每一行
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // 获取该行所有 td
            const cells = await row.$$('td');
            if (cells.length < 2) continue;

            // 获取第二个 td (索引 1)
            const targetCell = cells[1];
            const linkElem = await targetCell.$('a');

            if (!linkElem) continue;

            const name = (await linkElem.innerText()).trim();
            let href = await linkElem.getAttribute('href');

            if (!name || !href) continue;

            // 拼接完整 URL (详情页)
            const detailUrl = href.startsWith('http') ? href : `https://www.lyngsat.com${href}`;

            process.stdout.write(`\r⏳ 处理中: [${i + 1}/${rows.length}] ${name} ...`);

            // 6. 进入详情页查找 Linear Streaming
            let streamUrl = null;
            try {
                const detailPage = await context.newPage();
                // 设置较短的超时，避免卡死
                await detailPage.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                
                // 等待一小会儿让 JS 执行
                await detailPage.waitForTimeout(800);

                // 查找包含 "Linear Streaming" 文本的 a 标签
                const linearLink = await detailPage.$(`a:text("${CONFIG.linearText}")`);
                
                if (linearLink) {
                    let sHref = await linearLink.getAttribute('href');
                    if (sHref) {
                        streamUrl = sHref.startsWith('http') ? sHref : `https://www.lyngsat.com${sHref}`;
                    }
                }
                
                await detailPage.close();
            } catch (e) {
                // 详情页访问失败，跳过
            }

            if (streamUrl) {
                results.push({
                    name: name,
                    url: streamUrl
                });
                successCount++;
                process.stdout.write(` ✅\n`); 
            } else {
                failCount++;
            }
            
            // 随机延迟，模拟人类行为
            const delay = Math.floor(Math.random() * 500) + 200; 
            await page.waitForTimeout(delay);
        }

        // 7. 写入 JSON 文件
        console.log('\n-----------------------------');
        console.log(`💾 正在保存数据到 ${CONFIG.outputFile} ...`);
        
        fs.writeFileSync(CONFIG.outputFile, JSON.stringify(results, null, 2), 'utf-8');

        console.log(`🎉 抓取完成!`);
        console.log(`   ✅ 成功提取: ${successCount} 条`);
        console.log(`   ⚠️ 未找到流/失败: ${failCount} 条`);
        console.log(`   📄 文件已保存: ${CONFIG.outputFile}`);

    } catch (error) {
        console.error('\n❌ 发生严重错误:', error.message);
    } finally {
        // 清理资源
        if (browser) await browser.close();
        console.log('👋 浏览器已关闭');
    }
}

// 运行程序
startScraping();