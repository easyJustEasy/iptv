// ==========================================
// 1. 引入 playwright-extra 的 chromium
// ==========================================
const { chromium } = require('playwright-extra');

// ==========================================
// 2. 引入并实例化 stealth 插件 (注意末尾的 ())
// ==========================================
const stealth = require('puppeteer-extra-plugin-stealth')();

// ==========================================
// 3. 将插件添加到 chromium 实例
// ==========================================
chromium.use(stealth);

const fs = require('fs');
const path = require('path');

const CONFIG = {
    url: 'https://www.lyngsat.com/stream/tvcountry/China.html',
    tableSelector: 'body > div:nth-child(1) > table > tbody > tr > td:nth-child(2) > table:nth-child(14)',
    linearText: 'Linear Streaming',
    outputFile: path.join(__dirname, 'channels.json'),
    // 【重要】首次运行设为 false，观察是否有人机验证
    headless: false 
};

async function runScraper() {
    console.log('🚀 启动增强版爬虫 (官方推荐写法)...');
    let browser;

    try {
        // 启动浏览器
        browser = await chromium.launch({
            headless: CONFIG.headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'zh-CN',
            timezoneId: 'Asia/Shanghai'
        });

        const page = await context.newPage();

        console.log(`正在访问: ${CONFIG.url}`);
        
        // 访问页面
        await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 90000 });

        // === 等待安全验证通过 ===
        console.log('⏳ 检测并等待 Cloudflare 验证...');
        try {
            await page.waitForSelector('#cf-wrapper, .cf-spinner-container, #challenge-form, iframe[src*="challenges"]', { 
                state: 'detached', 
                timeout: 30000 
            });
            console.log('✅ 验证通过或未出现');
        } catch (e) {
            console.log('ℹ️ 验证检测超时，继续尝试获取内容...');
        }

        await page.waitForTimeout(2000);

        // === 定位表格 ===
        let tableElement = await page.$(CONFIG.tableSelector);

        if (!tableElement) {
            console.log('⚠️ 主选择器失效，尝试自动查找最大表格...');
            const allTables = await page.$$('table');
            let maxRows = 0;
            
            for (const t of allTables) {
                const rows = await t.$$('tr');
                if (rows.length > maxRows) {
                    maxRows = rows.length;
                    tableElement = t;
                }
            }
            
            if (!tableElement || maxRows < 5) {
                await page.screenshot({ path: 'error_debug.png', fullPage: true });
                throw new Error('无法找到频道表格。已保存截图 error_debug.png，请检查浏览器窗口。');
            }
            console.log(`✅ 找到备选表格 (${maxRows} 行)`);
        }

        const rows = await tableElement.$$('tr');
        console.log(`📋 找到 ${rows.length} 行，开始提取...`);
        
        const results = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cells = await row.$$('td');
            if (cells.length < 2) continue;

            const linkElem = await cells[1].$('a');
            if (!linkElem) continue;

            const name = (await linkElem.innerText()).trim();
            let href = await linkElem.getAttribute('href');
            if (!name || !href) continue;

            const detailUrl = href.startsWith('http') ? href : `https://www.lyngsat.com${href}`;
            
            process.stdout.write(`\r⏳ 处理: [${i + 1}/${rows.length}] ${name}`);

            let streamUrl = null;
            try {
                const detailPage = await context.newPage();
                await detailPage.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await detailPage.waitForTimeout(1000);

                const linearLink = await detailPage.$(`a:text("${CONFIG.linearText}")`);
                if (linearLink) {
                    let sHref = await linearLink.getAttribute('href');
                    if (sHref) {
                        streamUrl = sHref.startsWith('http') ? sHref : `https://www.lyngsat.com${sHref}`;
                    }
                }
                await detailPage.close();
            } catch (e) {
                // 忽略单个失败
            }

            if (streamUrl) {
                results.push({ name, url: streamUrl });
            }
            
            await page.waitForTimeout(200 + Math.random() * 300);
        }

        fs.writeFileSync(CONFIG.outputFile, JSON.stringify(results, null, 2), 'utf-8');
        console.log(`\n✅ 完成！共提取 ${results.length} 条数据。`);
        console.log(`📄 文件已保存: ${CONFIG.outputFile}`);

    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        if (browser) {
            try {
                const pages = await browser.pages();
                if(pages.length > 0) await pages[0].screenshot({ path: 'crash_snapshot.png', fullPage: true });
                console.log('💾 已保存崩溃截图: crash_snapshot.png');
            } catch(e) {}
        }
        process.exit(1);
    } finally {
        if (browser) await browser.close();
    }
}

runScraper();