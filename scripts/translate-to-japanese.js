#!/usr/bin/env node
/**
 * LRC 文件日文翻译脚本
 * 将 LRC 文件中的中文翻译添加日文版本
 *
 * 使用方法:
 *   1. 设置环境变量 GEMINI_API_KEY
 *   2. node scripts/translate-to-japanese.js NCE1
 *
 * 格式转换:
 *   [00:02.71]Excuse me! | 打扰一下！
 *   变为:
 *   [00:02.71]Excuse me! | 打扰一下！| すみません！
 */

const fs = require('fs');
const path = require('path');

// Gemini API 配置
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// 解析命令行参数
const args = process.argv.slice(2);
const bookDir = args[0] || 'NCE1';
const dryRun = args.includes('--dry-run');

const baseDir = path.join(__dirname, '..');
const targetDir = path.join(baseDir, bookDir);

/**
 * 调用 Gemini API 翻译文本
 */
async function translateWithGemini(chineseTexts) {
    if (!GEMINI_API_KEY) {
        console.error('错误: 请设置 GEMINI_API_KEY 环境变量');
        console.error('export GEMINI_API_KEY="your-api-key"');
        process.exit(1);
    }

    const prompt = `请将以下中文句子翻译成日文。每行一个句子，保持原有顺序，只输出日文翻译，不要添加任何解释或编号。

${chineseTexts.join('\n')}`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 8192,
                }
            })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const translatedText = data.candidates[0].content.parts[0].text;
        return translatedText.trim().split('\n').map(s => s.trim()).filter(Boolean);
    } catch (error) {
        console.error('翻译API错误:', error.message);
        throw error;
    }
}

/**
 * 解析 LRC 文件
 */
function parseLrcFile(content) {
    const lines = content.split(/\r?\n/);
    const result = [];

    for (const line of lines) {
        const match = line.match(/^(\[[^\]]+\])(.*)$/);
        if (match) {
            const timestamp = match[1];
            const text = match[2];
            const parts = text.split('|').map(s => s.trim());

            result.push({
                timestamp,
                en: parts[0] || '',
                cn: parts[1] || '',
                ja: parts[2] || '',  // 可能已存在
                raw: line
            });
        } else {
            // 元数据行 [al:...], [ar:...] 等
            result.push({
                timestamp: null,
                raw: line
            });
        }
    }

    return result;
}

/**
 * 生成新的 LRC 内容
 */
function generateLrcContent(parsed, translations) {
    let transIdx = 0;
    const lines = [];

    for (const item of parsed) {
        if (!item.timestamp) {
            // 元数据行保持不变
            lines.push(item.raw);
        } else if (item.cn && !item.ja) {
            // 有中文但没有日文，添加翻译
            const ja = translations[transIdx++] || '';
            lines.push(`${item.timestamp}${item.en} | ${item.cn} | ${ja}`);
        } else if (item.ja) {
            // 已有日文，保持不变
            lines.push(item.raw);
        } else {
            // 没有中文的行
            lines.push(item.raw);
        }
    }

    return lines.join('\n');
}

/**
 * 处理单个 LRC 文件
 */
async function processLrcFile(filePath) {
    console.log(`\n处理文件: ${path.basename(filePath)}`);

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseLrcFile(content);

    // 提取需要翻译的中文文本
    const chineseTexts = parsed
        .filter(item => item.timestamp && item.cn && !item.ja)
        .map(item => item.cn);

    if (chineseTexts.length === 0) {
        console.log('  ✓ 已有日文翻译或无需翻译');
        return;
    }

    console.log(`  需要翻译 ${chineseTexts.length} 句`);

    if (dryRun) {
        console.log('  [Dry Run] 跳过实际翻译');
        return;
    }

    // 调用翻译 API
    const translations = await translateWithGemini(chineseTexts);

    if (translations.length !== chineseTexts.length) {
        console.warn(`  警告: 翻译数量不匹配 (期望 ${chineseTexts.length}, 得到 ${translations.length})`);
    }

    // 生成新内容
    const newContent = generateLrcContent(parsed, translations);

    // 写回文件
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`  ✓ 已更新文件`);
}

/**
 * 主函数
 */
async function main() {
    console.log('====================================');
    console.log('LRC 日文翻译工具');
    console.log('====================================');
    console.log(`目标目录: ${targetDir}`);
    console.log(`Dry Run: ${dryRun}`);

    if (!fs.existsSync(targetDir)) {
        console.error(`错误: 目录不存在 - ${targetDir}`);
        process.exit(1);
    }

    // 获取所有 LRC 文件
    const files = fs.readdirSync(targetDir)
        .filter(f => f.endsWith('.lrc'))
        .map(f => path.join(targetDir, f));

    console.log(`\n找到 ${files.length} 个 LRC 文件`);

    // 逐个处理（避免 API 限流）
    for (const file of files) {
        try {
            await processLrcFile(file);
            // 延迟避免 API 限流
            if (!dryRun) {
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (error) {
            console.error(`  ✗ 处理失败: ${error.message}`);
        }
    }

    console.log('\n====================================');
    console.log('完成!');
    console.log('====================================');
}

main().catch(console.error);
