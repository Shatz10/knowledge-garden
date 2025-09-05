/*
- Author: Sonic AI based on existing script patterns
- Create Time: 2025-01-06
- Description: 统计 Obsidian 仓库中 frontmatter `分类` 属性的值分布，
-            并生成一份详细的 Markdown 报告。报告包含：
-            - 使用该属性的文件列表（可配置截断）
-            - `分类` 各个取值的出现次数分布（可配置截断）
-            - 汇总：使用文件总数、不同值数量
-            【注意】脚本最前面不要放 frontmatter 文本。
- Version: 1.0
*/

// Obsidian 类型声明（仅用于 TypeScript 编译，运行时由 Obsidian 提供）
declare const app: any;
declare const Notice: any;

// --- 配置项 ---
const TARGET_PROPERTY_KEY = "分类";                        // 目标属性键名
const OUTPUT_FILENAME_BASE = "📊 分类值分布报告";           // 输出文件基础名
const OUTPUT_PATH = "/";                                   // 输出目录（根目录）

// 默认截断/显示配置（可通过 URL 参数覆盖）
const DEFAULT_MAX_VALUES = 50;                               // 值分布最多显示的不同值数量
const DEFAULT_MAX_FILES = 5;                                 // 使用文件最多显示的数量

interface Config {
    maxValues: number;        // 值分布显示上限
    maxFiles: number;         // 文件列表显示上限
    showAllValues: boolean;   // 是否显示所有值
    showAllFiles: boolean;    // 是否显示所有文件
}
// --- END ---

interface CategoryStats {
    files: string[];                              // 拥有 `分类` 属性的文件路径列表
    valueDistribution: { [value: string]: number }; // `分类` 的值分布（规范化后）
    uniqueValues: number;                          // 不同值数量
}

function generateTimestampedFilename(): string {
    const now = new Date();
    const timestamp = now.getFullYear() +
        '-' + String(now.getMonth() + 1).padStart(2, '0') +
        '-' + String(now.getDate()).padStart(2, '0') +
        '-' + String(now.getHours()).padStart(2, '0') +
        '-' + String(now.getMinutes()).padStart(2, '0') +
        '-' + String(now.getSeconds()).padStart(2, '0');
    return `${OUTPUT_FILENAME_BASE}-${timestamp}.md`;
}

function parseConfig(): Config {
    // 解析 URL 参数（如通过 "obsidian://" 命令行触发或浏览器环境中调用）
    let urlParams: { [key: string]: string } = {};
    try {
        // 检查是否在浏览器环境中
        if (typeof window !== 'undefined' && (window as any).location) {
            const url = new URL((window as any).location.href);
            url.searchParams.forEach((value, key) => {
                urlParams[key] = value;
            });
        }
        // 也可以通过环境变量或命令行参数传递配置（未来扩展）
    } catch (_e) {
        // 忽略 URL 解析错误，采用默认配置
    }

    return {
        maxValues: urlParams.maxValues ? parseInt(urlParams.maxValues) : DEFAULT_MAX_VALUES,
        maxFiles: urlParams.maxFiles ? parseInt(urlParams.maxFiles) : DEFAULT_MAX_FILES,
        showAllValues: urlParams.showAllValues === 'true',
        showAllFiles: urlParams.showAllFiles === 'true',
    };
}

function normalizeValue(value: any): string {
    // 将 frontmatter 中可能的多种类型值统一为字符串用于分布统计
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (Array.isArray(value)) {
        return '[' + value.map(v => normalizeValue(v)).join(', ') + ']';
    }
    if (typeof value === 'object') {
        return '{' + Object.keys(value).join(', ') + '}';
    }
    return String(value);
}

function asArray<T>(value: T | T[]): T[] {
    if (Array.isArray(value)) return value;
    return [value];
}

function collectCategoryStatistics(): CategoryStats {
    const stats: CategoryStats = {
        files: [],
        valueDistribution: {},
        uniqueValues: 0,
    };

    const markdownFiles = app.vault.getMarkdownFiles();

    for (const file of markdownFiles) {
        try {
            const cache = app.metadataCache.getFileCache(file);
            const fm = cache?.frontmatter;
            if (!fm || !(TARGET_PROPERTY_KEY in fm)) continue;

            // 有 `分类` 的文件计入
            stats.files.push(file.path);

            const raw = fm[TARGET_PROPERTY_KEY];
            const values = asArray(raw);
            for (const v of values) {
                const normalized = normalizeValue(v);
                if (!stats.valueDistribution[normalized]) {
                    stats.valueDistribution[normalized] = 0;
                }
                stats.valueDistribution[normalized]++;
            }
        } catch (error) {
            console.warn(`处理文件 ${file.path} 时出错:`, error);
        }
    }

    stats.uniqueValues = Object.keys(stats.valueDistribution).length;
    return stats;
}

function generateMarkdownReport(categoryStats: CategoryStats, config: Config): string {
    const totalMarkdownFiles = app.vault.getMarkdownFiles().length;
    const totalFilesWithCategory = categoryStats.files.length; // 作为“使用次数”

    // 文件列表截断
    const displayFiles = config.showAllFiles
        ? categoryStats.files
        : categoryStats.files.slice(0, config.maxFiles);
    const hasMoreFiles = !config.showAllFiles && categoryStats.files.length > config.maxFiles;

    // 值分布排序并截断（按出现次数降序）
    const sortedValues = Object.entries(categoryStats.valueDistribution)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, config.showAllValues ? undefined : config.maxValues);
    const hasMoreValues = !config.showAllValues && Object.keys(categoryStats.valueDistribution).length > config.maxValues;

    let markdown = `### \`${TARGET_PROPERTY_KEY}\` (${totalFilesWithCategory}次使用, ${categoryStats.uniqueValues}个不同值)\n\n`;

    markdown += `**使用文件:**\n`;
    markdown += displayFiles.map(p => `- [[${p}]]`).join('\n');
    if (hasMoreFiles) {
        markdown += `\n- ... 还有 ${categoryStats.files.length - config.maxFiles} 个文件`;
    }
    markdown += `\n\n`;

    markdown += `**值分布:**\n\n`;

    // 为每个分类找到示例文档的辅助函数
    function findExampleFileForCategory(categoryValue: string): string | null {
        for (const filePath of categoryStats.files) {
            try {
                const file = app.vault.getAbstractFileByPath(filePath);
                if (!file) continue;

                const cache = app.metadataCache.getFileCache(file);
                const fm = cache?.frontmatter;
                if (!fm || !(TARGET_PROPERTY_KEY in fm)) continue;

                const raw = fm[TARGET_PROPERTY_KEY];
                const values = asArray(raw);
                const normalizedValues = values.map(v => normalizeValue(v));

                if (normalizedValues.includes(categoryValue)) {
                    return filePath;
                }
            } catch (error) {
                console.warn(`查找示例文件时出错 ${filePath}:`, error);
            }
        }
        return null;
    }

    // 生成表格头部
    markdown += `| 分类值 | 出现次数 | 示例文档 |\n`;
    markdown += `|--------|----------|----------|\n`;

    // 生成表格内容
    markdown += sortedValues.map(([value, count]) => {
        const exampleFile = findExampleFileForCategory(value);
        const exampleLink = exampleFile ? `[[${exampleFile}]]` : '-';
        return `| ${value} | ${count} | ${exampleLink} |`;
    }).join('\n');

    if (hasMoreValues) {
        markdown += `\n| ... | 还有 ${Object.keys(categoryStats.valueDistribution).length - config.maxValues} 个其他值 | - |`;
    }
    markdown += `\n\n`;

    return markdown;
}

// 主函数：生成 `分类` 值分布报告
async function main() {
    try {
        new Notice(`正在统计 \`${TARGET_PROPERTY_KEY}\` 值分布...`, 2000);

        const config = parseConfig();
        console.log('使用配置:', config);

        const categoryStats = collectCategoryStatistics();
        if (categoryStats.files.length === 0) {
            new Notice(`未找到任何包含 \`${TARGET_PROPERTY_KEY}\` 的文件`, 3000);
            return;
        }

        const content = [
            `# 📊 分类值分布报告`,
            '',
            `> 生成时间: ${new Date().toLocaleString('zh-CN')}`,
            `> 总文件数: ${app.vault.getMarkdownFiles().length}`,
            `> 含有 \`${TARGET_PROPERTY_KEY}\` 的文件数: ${categoryStats.files.length}`,
            '',
            generateMarkdownReport(categoryStats, config),
        ].join('\n');

        const outputFilename = generateTimestampedFilename();
        const outputFile = OUTPUT_PATH + outputFilename;
        await app.vault.create(outputFile, content);

        new Notice(`✅ 分类值分布报告已生成: ${outputFilename}`, 4000);
    } catch (error) {
        const message = `生成分类值分布报告时出错: ${(error as Error).message}`;
        new Notice(message, 5000);
        console.error(message, error);
    }
}

// 导出给 fix-require-modules 调用
export async function invoke() {
    await main();
}


