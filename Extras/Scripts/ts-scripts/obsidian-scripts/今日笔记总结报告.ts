/*
- Author: AI Assistant - 今日笔记总结
- Description: 自动生成今日新建或修改笔记的总结报告
- Features:
-   - 自动计算今日时间范围
-   - 获取今日新建或修改的笔记
-   - 读取笔记内容并生成摘要
-   - 生成简洁的每日总结报告（表格格式）
-   - 批量操作检测和警告
-   - 支持覆盖现有报告文件
- Version: 2.0
*/

// Obsidian 类型声明
declare const app: any;
declare const Notice: any;
declare const require: any;

// 全局变量初始化
(function () {
    if (typeof window === 'undefined') {
        (globalThis as any).window = {};
    }
    if (typeof globalThis === 'undefined') {
        (globalThis as any).globalThis = {};
    }
})();

// 创建安全的 Notice 函数
function safeNotice(message: string, duration?: number) {
    if (typeof Notice !== 'undefined') {
        new Notice(message, duration);
    } else {
        console.log('Notice:', message);
    }
}

interface DailyNote {
    path: string;
    name: string;
    createdTime: Date;
    modifiedTime: Date;
    wordCount: number;
    summary: string;
    tags: string[];
    frontmatter?: any;
}

interface DailyReport {
    date: Date;
    totalNotes: number;
    totalWords: number;
    notes: DailyNote[];
    tags: { [tag: string]: number };
}

function getTodayRange(): { start: Date; end: Date } {
    const now = new Date();
    const startOfDay = new Date(now);
    const endOfDay = new Date(now);

    // 设置为今天的开始时间
    startOfDay.setHours(0, 0, 0, 0);

    // 设置为今天的结束时间
    endOfDay.setHours(23, 59, 59, 999);

    return { start: startOfDay, end: endOfDay };
}

function extractFrontmatter(content: string): { frontmatter: any; body: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
        try {
            const frontmatter = parseYamlFrontmatter(match[1]);
            return { frontmatter, body: match[2] };
        } catch (e) {
            console.warn('解析 frontmatter 失败:', e);
        }
    }

    return { frontmatter: null, body: content };
}

function parseYamlFrontmatter(yamlText: string): any {
    const result: any = {};
    const lines = yamlText.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
            const key = trimmed.substring(0, colonIndex).trim();
            let value = trimmed.substring(colonIndex + 1).trim();

            // 处理数组值
            if (value.startsWith('[') && value.endsWith(']')) {
                try {
                    const parsedArray = JSON.parse(value);
                    value = Array.isArray(parsedArray) ? parsedArray.join(', ') : value;
                } catch (e) {
                    value = value.slice(1, -1).split(',').map(s => s.trim()).join(', ');
                }
            }
            // 处理引号包围的值
            else if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            result[key] = value;
        }
    }

    return result;
}

function extractTags(content: string): string[] {
    const tagRegex = /#[\w\u4e00-\u9fff]+/g;
    const matches = content.match(tagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
}

function generateNoteSummary(content: string, maxLength: number = 100): string {
    const { body } = extractFrontmatter(content);
    const cleanContent = body.replace(/^\s*#+\s*.+$/gm, '') // 移除标题
        .replace(/\*\*.*?\*\*/g, '') // 移除加粗
        .replace(/\*.*?\*/g, '') // 移除斜体
        .replace(/`.*?`/g, '') // 移除行内代码
        .replace(/^\s*[-*+]\s+/gm, '') // 移除列表标记
        .replace(/^\s*\d+\.\s+/gm, '') // 移除编号列表
        .replace(/\n\s*\n/g, '\n') // 多个换行合并为单个
        .trim();

    if (cleanContent.length <= maxLength) {
        return cleanContent;
    }

    // 智能截断：尝试在句子边界处截断
    const truncated = cleanContent.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('。'),
        truncated.lastIndexOf('！'),
        truncated.lastIndexOf('？'),
        truncated.lastIndexOf('. '),
        truncated.lastIndexOf('! '),
        truncated.lastIndexOf('? ')
    );

    if (lastSentenceEnd > maxLength * 0.7) {
        return truncated.substring(0, lastSentenceEnd + 1);
    }

    return truncated;
}

async function getTodayNotes(): Promise<DailyNote[]> {
    const { start, end } = getTodayRange();
    const startTimestamp = start.getTime();
    const endTimestamp = end.getTime();

    console.log(`获取 ${start.toLocaleDateString('zh-CN')} 的笔记`);

    const allFiles = app.vault.getMarkdownFiles();
    const todayNotes: DailyNote[] = [];

    for (const file of allFiles) {
        try {
            const stat = file.stat;
            if (!stat || !stat.ctime || !stat.mtime) continue;

            // 检查是否在今日创建或修改
            const isCreatedToday = stat.ctime >= startTimestamp && stat.ctime <= endTimestamp;
            const isModifiedToday = stat.mtime >= startTimestamp && stat.mtime <= endTimestamp;

            if (isCreatedToday || isModifiedToday) {
                // 读取文件内容
                const content = await app.vault.read(file);
                const { frontmatter, body } = extractFrontmatter(content);
                const tags = extractTags(content);
                const summary = generateNoteSummary(content, 80); // 每日摘要更短
                const wordCount = body.split(/\s+/).filter(word => word.length > 0).length;

                todayNotes.push({
                    path: file.path,
                    name: file.name || file.basename,
                    createdTime: new Date(stat.ctime),
                    modifiedTime: new Date(stat.mtime),
                    wordCount,
                    summary,
                    tags,
                    frontmatter
                });
            }
        } catch (error) {
            console.warn(`处理文件 ${file.path} 时出错:`, error);
        }
    }

    // 按创建时间排序（最新的在前）
    todayNotes.sort((a, b) => b.createdTime.getTime() - a.createdTime.getTime());

    return todayNotes;
}

function generateDailyReport(notes: DailyNote[]): DailyReport {
    const date = new Date();

    const tags: { [tag: string]: number } = {};
    let totalWords = 0;

    for (const note of notes) {
        totalWords += note.wordCount;

        // 统计标签
        for (const tag of note.tags) {
            tags[tag] = (tags[tag] || 0) + 1;
        }
    }

    return {
        date,
        totalNotes: notes.length,
        totalWords,
        notes,
        tags
    };
}

function generateMarkdownReport(report: DailyReport): string {
    const formatDate = (date: Date) => date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });

    let markdown = `# 📅 今日笔记总结

> ${formatDate(report.date)}
> 总计: **${report.totalNotes}** 篇笔记（包含新建和修改）

`;

    // 如果笔记数量超过100个，在报告中添加警告
    if (report.totalNotes > 100) {
        markdown += `> ⚠️ **批量操作警告**: 发现 ${report.totalNotes} 篇笔记，这可能表明今日有批量操作（如仓库迁移、脚本处理等）。请谨慎查看报告内容。\n\n`;
    }

    if (report.notes.length === 0) {
        markdown += '> 今日没有新建或修改的笔记\n\n';
    } else {
        markdown += `## 📝 今日笔记（新建或修改）

| 笔记名 | 相对路径 | 创建时间 | 修改时间 |
|--------|----------|----------|----------|
`;

        // 限制显示的笔记数量，避免报告过大
        const displayLimit = 100;
        const notesToDisplay = report.notes.slice(0, displayLimit);

        notesToDisplay.forEach((note) => {
            const createdTimeStr = note.createdTime.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const modifiedTimeStr = note.modifiedTime.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            markdown += `| [[${note.name}]] | \`${note.path}\` | ${createdTimeStr} | ${modifiedTimeStr} |\n`;
        });

        // 如果笔记数量超过限制，添加说明
        if (report.totalNotes > displayLimit) {
            markdown += `\n> 📝 **显示限制**: 仅显示前 ${displayLimit} 篇笔记，共 ${report.totalNotes} 篇。\n\n`;
        }

        markdown += '\n';
    }

    markdown += `---
*生成于 ${new Date().toLocaleString('zh-CN')}*
`;

    return markdown;
}

// 导出给外部调用的数据
let lastDailyReport: DailyReport | null = null;
// 防止重复执行的标志
let isDailyReportRunning = false;

async function generateDailySummaryReport(): Promise<DailyReport> {
    // 防止重复执行
    if (isDailyReportRunning) {
        console.log('今日笔记总结报告正在生成中，跳过重复执行');
        return lastDailyReport || {} as DailyReport;
    }

    isDailyReportRunning = true;

    try {
        console.log('开始生成今日笔记总结报告...');
        safeNotice('正在生成今日笔记总结报告...', 2000);

        // 获取今日笔记
        const todayNotes = await getTodayNotes();
        console.log(`找到 ${todayNotes.length} 篇今日新建或修改的笔记`);

        // 检查笔记数量，如果超过100个给出警告
        if (todayNotes.length > 100) {
            const warningMessage = `⚠️ 发现 ${todayNotes.length} 篇笔记，这可能表明今日有批量操作（如仓库迁移、脚本处理等）。\n\n这可能不是您想要的结果，请谨慎查看报告内容。`;
            safeNotice(warningMessage, 8000);
            console.warn(`发现 ${todayNotes.length} 篇笔记，建议谨慎查看报告内容`);
        }

        // 生成报告
        const report = generateDailyReport(todayNotes);
        lastDailyReport = report;

        // 生成 Markdown 内容
        const markdownContent = generateMarkdownReport(report);

        // 生成带时间戳的文件名
        const timestamp = new Date().toISOString().slice(0, 10); // 只保留日期部分
        const filename = `今日笔记总结-${timestamp}.md`;

        // 保存报告（如果文件已存在则覆盖）
        const existingFile = app.vault.getAbstractFileByPath(filename);
        if (existingFile) {
            await app.vault.modify(existingFile, markdownContent);
            console.log(`报告已覆盖保存到: ${filename}`);
        } else {
            await app.vault.create(filename, markdownContent);
            console.log(`报告已保存到: ${filename}`);
        }

        safeNotice(`✅ 今日笔记总结报告已生成: ${filename}`, 4000);

        return report;

    } catch (error) {
        const errorMessage = `生成今日笔记总结报告时出错: ${(error as Error).message}`;
        safeNotice(errorMessage, 5000);
        console.error(errorMessage, error);
        throw error;
    } finally {
        // 无论成功还是失败，都重置运行标志
        isDailyReportRunning = false;
    }
}

// 导出函数
export async function invoke() {
    return await generateDailySummaryReport();
}

// 获取最近生成的报告数据（用于其他脚本调用）
export function getLastDailyReport(): DailyReport | null {
    return lastDailyReport;
}

// 如果直接运行
if (typeof window !== 'undefined') {
    generateDailySummaryReport();
}
