/*
- Author: AI Assistant based on CodeScript Toolkit patterns
- Create Time: 2025-01-06
- Description: 根据时间范围筛选 Obsidian 笔记的工具脚本
-            支持传入起始时间戳和截止时间戳（或任一），过滤符合条件的新建或新修改的笔记
-            同时支持指定上级目录名进行进一步筛选
-            通过 URL 调用方式：obsidian://CodeScriptToolkit?module=/Extras/Scripts/ts-scripts/obsidian-scripts/时间筛选笔记.ts&args=startTimestamp,endTimestamp,'directoryPath'
-            【注意】脚本最前面不要放 frontmatter 文本。
- Version: 1.0
*/

// Obsidian 类型声明（仅用于 TypeScript 编译，运行时由 Obsidian 提供）
declare const app: any;
declare const Notice: any;

// Node.js 类型声明（用于 require 函数）
declare const require: any;

// 全局变量初始化，确保在所有执行环境中都能访问
(function () {
    // 确保全局对象存在
    if (typeof window === 'undefined') {
        (globalThis as any).window = {};
    }
    if (typeof globalThis === 'undefined') {
        (globalThis as any).globalThis = {};
    }
})();

// --- 配置项 ---
const OUTPUT_FILENAME_BASE = "📅 时间筛选笔记报告";
const OUTPUT_PATH = "/";

// 默认配置
const DEFAULT_MAX_FILES = 100;  // 默认最多显示的文件数量

interface Config {
    maxFiles: number;           // 最多显示的文件数
    showAllFiles: boolean;      // 是否显示所有文件
}

// 时间筛选参数接口
interface TimeFilterParams {
    startTimestamp?: number;    // 起始时间戳（毫秒）
    endTimestamp?: number;      // 截止时间戳（毫秒）
    directoryPath?: string;     // 要筛选的上级目录路径
    filterType: 'created' | 'modified' | 'both';  // 筛选类型：创建时间、修改时间、两者都满足
}

interface FilteredFile {
    path: string;
    name: string;
    createdTime: Date;
    modifiedTime: Date;
    size: number;
    isNewlyCreated: boolean;    // 在指定时间范围内创建
    isRecentlyModified: boolean; // 在指定时间范围内修改
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

function parseTimeFilterParams(): TimeFilterParams {
    // 解析传入的参数
    let urlParams: { [key: string]: string } = {};
    let args: any[] = [];
    let startTimestamp: number | undefined;
    let endTimestamp: number | undefined;
    let directoryPath: string | undefined;
    let filterType: 'created' | 'modified' | 'both' = 'both';

    try {
        // 尝试获取当前URL参数（如果是通过URL调用的）
        if (typeof window !== 'undefined' && window.location && window.location.href) {
            const url = new URL(window.location.href);
            url.searchParams.forEach((value, key) => {
                urlParams[key] = value;
            });
        }
    } catch (e) {
        console.log('无法获取URL参数，使用默认配置:', e);
        // 即使出错也要继续执行，使用空的参数对象
    }

    // 解析 args 参数（CodeScript Toolkit 方式）
    if (urlParams.args) {
        try {
            // args 参数格式：'arg1','arg2',obj,arg4
            // 我们需要解析这个字符串格式
            const argsString = urlParams.args;
            console.log('解析 args 参数:', argsString);

            // 简单的参数解析（处理引号和逗号分隔）
            const parsedArgs = parseArgsString(argsString);
            console.log('解析后的参数:', parsedArgs);

            // 分配参数：startTimestamp, endTimestamp, directoryPath, filterType
            if (parsedArgs.length >= 1 && parsedArgs[0] !== undefined && parsedArgs[0] !== '' && parsedArgs[0] !== null) {
                const timestamp = parseInt(String(parsedArgs[0]));
                if (!isNaN(timestamp)) {
                    startTimestamp = timestamp;
                    console.log('设置 startTimestamp:', startTimestamp);
                }
            }
            if (parsedArgs.length >= 2 && parsedArgs[1] !== undefined && parsedArgs[1] !== '' && parsedArgs[1] !== null) {
                const timestamp = parseInt(String(parsedArgs[1]));
                if (!isNaN(timestamp)) {
                    endTimestamp = timestamp;
                    console.log('设置 endTimestamp:', endTimestamp);
                }
            }
            if (parsedArgs.length >= 3 && parsedArgs[2] !== undefined && parsedArgs[2] !== '' && parsedArgs[2] !== null) {
                directoryPath = String(parsedArgs[2]);
                console.log('设置 directoryPath:', directoryPath);
            }
            if (parsedArgs.length >= 4 && parsedArgs[3] !== undefined && parsedArgs[3] !== '' && parsedArgs[3] !== null) {
                const typeStr = String(parsedArgs[3]).toLowerCase();
                if (['created', 'modified', 'both'].includes(typeStr)) {
                    filterType = typeStr as 'created' | 'modified' | 'both';
                    console.log('设置 filterType:', filterType);
                }
            }
        } catch (e) {
            console.warn('解析 args 参数时出错:', e);
            // 即使解析出错也要继续使用默认值
        }
    }

    // 从URL参数中解析（兼容旧方式）
    if (!startTimestamp && urlParams.startTimestamp) {
        startTimestamp = parseInt(urlParams.startTimestamp);
    }
    if (!endTimestamp && urlParams.endTimestamp) {
        endTimestamp = parseInt(urlParams.endTimestamp);
    }
    if (!directoryPath && urlParams.directoryPath) {
        directoryPath = urlParams.directoryPath;
    }
    if (urlParams.filterType && ['created', 'modified', 'both'].includes(urlParams.filterType)) {
        filterType = urlParams.filterType as 'created' | 'modified' | 'both';
    }

    // 如果没有提供时间戳，使用当前时间往前推7天作为默认范围
    if (!startTimestamp && !endTimestamp) {
        const now = Date.now();
        startTimestamp = now - (7 * 24 * 60 * 60 * 1000); // 7天前
        endTimestamp = now;
    }

    console.log('最终解析的参数:', {
        startTimestamp,
        endTimestamp,
        directoryPath,
        filterType
    });

    return {
        startTimestamp,
        endTimestamp,
        directoryPath,
        filterType
    };
}

// 解析 args 字符串参数
function parseArgsString(argsString: string): any[] {
    const args: any[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < argsString.length; i++) {
        const char = argsString[i];

        if (!inQuotes && (char === '"' || char === "'")) {
            // 开始引号
            inQuotes = true;
            quoteChar = char;
        } else if (inQuotes && char === quoteChar) {
            // 结束引号
            inQuotes = false;
            quoteChar = '';
        } else if (!inQuotes && char === ',') {
            // 参数分隔符
            args.push(parseArgValue(current.trim()));
            current = '';
        } else {
            current += char;
        }
    }

    // 添加最后一个参数
    if (current.trim()) {
        args.push(parseArgValue(current.trim()));
    }

    return args;
}

// 解析单个参数值
function parseArgValue(value: string): any {
    // 移除首尾空白
    value = value.trim();

    // 如果是空字符串，返回 undefined
    if (value === '') {
        return undefined;
    }

    // 如果是数字字符串，转换为数字
    if (/^\d+$/.test(value)) {
        return parseInt(value);
    }

    // 如果是带引号的字符串，移除引号
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }

    // 如果是对象表示（如 {key: 'value'}），尝试解析为对象
    if (value.startsWith('{') && value.endsWith('}')) {
        try {
            // 简单对象解析（这里可以扩展更复杂的逻辑）
            return value;
        } catch (e) {
            return value;
        }
    }

    // 其他情况直接返回字符串
    return value;
}

function parseConfig(): Config {
    let urlParams: { [key: string]: string } = {};
    try {
        if (typeof window !== 'undefined' && window.location && window.location.href) {
            const url = new URL(window.location.href);
            url.searchParams.forEach((value, key) => {
                urlParams[key] = value;
            });
        }
    } catch (e) {
        console.log('无法获取URL参数，使用默认配置:', e);
        // 即使出错也要继续执行，使用空的urlParams
    }

    const maxFiles = urlParams.maxFiles ? parseInt(urlParams.maxFiles) : DEFAULT_MAX_FILES;
    const showAllFiles = urlParams.showAllFiles === 'true';

    console.log('配置参数:', { maxFiles, showAllFiles });

    return {
        maxFiles: isNaN(maxFiles) ? DEFAULT_MAX_FILES : maxFiles,
        showAllFiles: showAllFiles,
    };
}

function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isPathInDirectory(filePath: string, directoryPath: string): boolean {
    if (!directoryPath) return true; // 如果没有指定目录，则匹配所有
    // 标准化路径，确保以 / 开头和结尾
    const normalizedDir = directoryPath.startsWith('/') ? directoryPath : '/' + directoryPath;
    const normalizedFilePath = filePath.startsWith('/') ? filePath : '/' + filePath;

    return normalizedFilePath.startsWith(normalizedDir);
}

function filterFilesByTime(params: TimeFilterParams): FilteredFile[] {
    const filteredFiles: FilteredFile[] = [];
    const markdownFiles = app.vault.getMarkdownFiles();

    console.log('开始筛选文件...', {
        totalFiles: markdownFiles.length,
        params: params
    });

    for (const file of markdownFiles) {
        try {
            // 检查目录筛选条件
            if (params.directoryPath && !isPathInDirectory(file.path, params.directoryPath)) {
                continue;
            }

            // 获取文件统计信息
            const stat = file.stat;
            if (!stat) continue;

            const createdTime = new Date(stat.ctime);
            const modifiedTime = new Date(stat.mtime);

            let isNewlyCreated = false;
            let isRecentlyModified = false;

            // 检查创建时间是否在范围内
            if (params.startTimestamp || params.endTimestamp) {
                const createdTimestamp = stat.ctime;
                if (params.startTimestamp && params.endTimestamp) {
                    // 两个时间戳都提供
                    isNewlyCreated = createdTimestamp >= params.startTimestamp && createdTimestamp <= params.endTimestamp;
                } else if (params.startTimestamp) {
                    // 只提供起始时间
                    isNewlyCreated = createdTimestamp >= params.startTimestamp;
                } else if (params.endTimestamp) {
                    // 只提供截止时间
                    isNewlyCreated = createdTimestamp <= params.endTimestamp;
                }
            }

            // 检查修改时间是否在范围内
            if (params.startTimestamp || params.endTimestamp) {
                const modifiedTimestamp = stat.mtime;
                if (params.startTimestamp && params.endTimestamp) {
                    // 两个时间戳都提供
                    isRecentlyModified = modifiedTimestamp >= params.startTimestamp && modifiedTimestamp <= params.endTimestamp;
                } else if (params.startTimestamp) {
                    // 只提供起始时间
                    isRecentlyModified = modifiedTimestamp >= params.startTimestamp;
                } else if (params.endTimestamp) {
                    // 只提供截止时间
                    isRecentlyModified = modifiedTimestamp <= params.endTimestamp;
                }
            }

            // 根据筛选类型判断是否包含该文件
            let shouldInclude = false;
            switch (params.filterType) {
                case 'created':
                    shouldInclude = isNewlyCreated;
                    break;
                case 'modified':
                    shouldInclude = isRecentlyModified;
                    break;
                case 'both':
                    shouldInclude = isNewlyCreated || isRecentlyModified;
                    break;
            }

            if (shouldInclude) {
                filteredFiles.push({
                    path: file.path,
                    name: file.name || file.basename,
                    createdTime: createdTime,
                    modifiedTime: modifiedTime,
                    size: stat.size || 0,
                    isNewlyCreated: isNewlyCreated,
                    isRecentlyModified: isRecentlyModified
                });
            }

        } catch (error) {
            console.warn(`处理文件 ${file.path} 时出错:`, error);
        }
    }

    // 按修改时间降序排序
    filteredFiles.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());

    return filteredFiles;
}

function generateMarkdownReport(filteredFiles: FilteredFile[], params: TimeFilterParams, config: Config): string {
    const totalMarkdownFiles = app.vault.getMarkdownFiles().length;
    const displayFiles = config.showAllFiles ? filteredFiles : filteredFiles.slice(0, config.maxFiles);
    const hasMoreFiles = !config.showAllFiles && filteredFiles.length > config.maxFiles;

    // 计算时间范围描述
    let timeRangeDesc = '';
    if (params.startTimestamp && params.endTimestamp) {
        timeRangeDesc = `${formatTimestamp(params.startTimestamp)} - ${formatTimestamp(params.endTimestamp)}`;
    } else if (params.startTimestamp) {
        timeRangeDesc = `${formatTimestamp(params.startTimestamp)} 之后`;
    } else if (params.endTimestamp) {
        timeRangeDesc = `${formatTimestamp(params.endTimestamp)} 之前`;
    } else {
        timeRangeDesc = '未指定时间范围';
    }

    // 统计数据
    const newlyCreatedCount = filteredFiles.filter(f => f.isNewlyCreated).length;
    const recentlyModifiedCount = filteredFiles.filter(f => f.isRecentlyModified).length;
    const bothCount = filteredFiles.filter(f => f.isNewlyCreated && f.isRecentlyModified).length;

    const totalSize = filteredFiles.reduce((sum, file) => sum + file.size, 0);

    // 安全计算百分比，避免除零错误
    const getPercentage = (count: number, total: number): string => {
        if (total === 0) return '0.0';
        return ((count / total) * 100).toFixed(1);
    };

    let markdown = `# 📅 时间筛选笔记报告

> 生成时间: ${new Date().toLocaleString('zh-CN')}
> 时间范围: ${timeRangeDesc}
> 筛选类型: ${params.filterType === 'created' ? '创建时间' : params.filterType === 'modified' ? '修改时间' : '创建或修改时间'}
${params.directoryPath ? `> 目录筛选: \`${params.directoryPath}\`` : '> 目录筛选: 全部目录'}
> 总文件数: ${totalMarkdownFiles} | 符合条件的文件数: ${filteredFiles.length}

## 📊 统计概览

| 统计项 | 数量 | 占比 |
|--------|------|------|
| 新建文件 | ${newlyCreatedCount} | ${getPercentage(newlyCreatedCount, filteredFiles.length)}% |
| 修改文件 | ${recentlyModifiedCount} | ${getPercentage(recentlyModifiedCount, filteredFiles.length)}% |
| 同时新建和修改 | ${bothCount} | ${getPercentage(bothCount, filteredFiles.length)}% |
| 总大小 | ${formatBytes(totalSize)} | - |

## 📝 符合条件的文件列表

`;

    if (displayFiles.length === 0) {
        markdown += `> **未找到符合条件的文件**\n\n`;
        markdown += `可能的原因：
- 时间范围设置不正确
- 指定的目录路径不存在或没有符合条件的文件
- 文件的创建/修改时间不在指定范围内\n\n`;
    } else {
        // 文件表格
        markdown += `| 文件名 | 路径 | 创建时间 | 修改时间 | 文件大小 | 类型 |\n`;
        markdown += `|--------|------|----------|----------|----------|------|\n`;

        displayFiles.forEach(file => {
            let fileType = '';
            if (file.isNewlyCreated && file.isRecentlyModified) {
                fileType = '新建并修改';
            } else if (file.isNewlyCreated) {
                fileType = '新建';
            } else if (file.isRecentlyModified) {
                fileType = '修改';
            }

            markdown += `| [[${file.name}]] | \`${file.path}\` | ${file.createdTime.toLocaleString('zh-CN')} | ${file.modifiedTime.toLocaleString('zh-CN')} | ${formatBytes(file.size)} | ${fileType} |\n`;
        });

        if (hasMoreFiles) {
            markdown += `\n> ... 还有 ${filteredFiles.length - config.maxFiles} 个文件\n\n`;
        }

        // 文件详情列表
        markdown += `\n### 📋 文件详情\n\n`;

        displayFiles.forEach((file, index) => {
            markdown += `#### ${index + 1}. [[${file.name}]]\n\n`;
            markdown += `- **路径**: \`${file.path}\`\n`;
            markdown += `- **创建时间**: ${file.createdTime.toLocaleString('zh-CN')}\n`;
            markdown += `- **修改时间**: ${file.modifiedTime.toLocaleString('zh-CN')}\n`;
            markdown += `- **文件大小**: ${formatBytes(file.size)}\n`;
            markdown += `- **状态**: ${file.isNewlyCreated ? '✅ 在时间范围内创建' : '❌ 创建时间不在范围内'}\n`;
            markdown += `- **状态**: ${file.isRecentlyModified ? '✅ 在时间范围内修改' : '❌ 修改时间不在范围内'}\n\n`;
        });
    }

    // 使用说明
    markdown += `## 📖 使用说明

### URL 调用方式
\`\`\`
obsidian://CodeScriptToolkit?module=/Extras/Scripts/ts-scripts/obsidian-scripts/时间筛选笔记.ts&args=startTimestamp,endTimestamp,'directoryPath','filterType'
\`\`\`

### 参数说明
通过 \`args\` 参数传递，参数顺序如下：
1. \`startTimestamp\`: 起始时间戳（毫秒），可选
2. \`endTimestamp\`: 截止时间戳（毫秒），可选  
3. \`directoryPath\`: 要筛选的目录路径，可选（用引号包围）
4. \`filterType\`: 筛选类型，可选值：\`created\`（创建时间）、\`modified\`（修改时间）、\`both\`（两者之一）

### 时间戳转换
- JavaScript 时间戳：\`Date.now()\` 或 \`new Date().getTime()\`
- Unix 时间戳：乘以 1000 转换为毫秒

### 使用示例

#### 1. 筛选最近7天内修改的文件
\`\`\`javascript
// 在浏览器控制台或代码块中计算时间戳
const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

// URL调用（注意参数需要URL编码）
obsidian://CodeScriptToolkit?module=/Extras/Scripts/ts-scripts/obsidian-scripts/时间筛选笔记.ts&args= + sevenDaysAgo
\`\`\`

#### 2. 筛选特定时间范围内的文件
\`\`\`javascript
const startTime = new Date('2025-01-01').getTime();
const endTime = new Date('2025-01-31').getTime();

obsidian://CodeScriptToolkit?module=/Extras/Scripts/ts-scripts/obsidian-scripts/时间筛选笔记.ts&args= + startTime + ',' + endTime
\`\`\`

#### 3. 筛选特定目录下的文件
\`\`\`\`javascript
const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

// 筛选 Cards 目录下最近24小时内创建的文件
obsidian://CodeScriptToolkit?module=/Extras/Scripts/ts-scripts/obsidian-scripts/时间筛选笔记.ts&args= + oneDayAgo + ",,'Cards','created'"
\`\`\`

#### 4. 筛选修改时间
\`\`\`javascript
const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);

// 筛选最近3天内修改的文件
obsidian://CodeScriptToolkit?module=/Extras/Scripts/ts-scripts/obsidian-scripts/时间筛选笔记.ts&args= + threeDaysAgo + ",,'','modified'"
\`\`\`

### 快速时间计算
\`\`\`javascript
// 常用时间戳计算
const now = Date.now();
const oneHour = 60 * 60 * 1000;
const oneDay = 24 * 60 * 60 * 1000;
const oneWeek = 7 * 24 * 60 * 60 * 1000;

// 最近1小时
const lastHour = now - oneHour;

// 最近24小时
const lastDay = now - oneDay;

// 最近7天
const lastWeek = now - oneWeek;

// 最近30天
const lastMonth = now - (30 * oneDay);
\`\`\`
`;

    return markdown;
}

// 创建一个安全的 Notice 函数，如果原始的 Notice 不可用就使用 console.log
function safeNotice(message: string, duration?: number) {
    if (typeof Notice !== 'undefined') {
        new Notice(message, duration);
    } else {
        console.log('Notice:', message);
    }
}

// 主函数
async function main() {
    try {
        console.log('开始执行时间筛选脚本...');

        safeNotice('正在筛选时间范围内的笔记...', 2000);

        // 解析参数
        const params = parseTimeFilterParams();
        const config = parseConfig();

        console.log('筛选参数:', params);
        console.log('显示配置:', config);

        // 检查必要的全局变量是否存在
        if (typeof app === 'undefined') {
            throw new Error('Obsidian app 对象不可用，请确保在 Obsidian 环境中运行此脚本');
        }

        // 筛选文件
        const filteredFiles = filterFilesByTime(params);

        // 生成报告
        const reportContent = generateMarkdownReport(filteredFiles, params, config);

        // 生成带时间戳的文件名
        const outputFilename = generateTimestampedFilename();
        const outputFile = OUTPUT_PATH + outputFilename;

        // 创建新文件
        await app.vault.create(outputFile, reportContent);

        const message = `✅ 时间筛选笔记报告已生成: ${outputFilename} (${filteredFiles.length} 个符合条件的文件)`;
        safeNotice(message, 5000);

        console.log('筛选完成:', {
            totalFiles: filteredFiles.length,
            outputFile: outputFile
        });

    } catch (error) {
        const errorMessage = `时间筛选笔记时出错: ${(error as Error).message}`;
        safeNotice(errorMessage, 5000);
        console.error(errorMessage, error);
    }
}

// 导出 invoke 函数，供 CodeScript Toolkit 调用
export async function invoke(appInstance?: any) {
    // 如果传入了 app 实例，使用它；否则使用全局的 app
    if (appInstance) {
        // 在某些调用上下文中，app 可能作为参数传入
        console.log('使用传入的 app 实例');
    }
    await main();
}

// 如果直接运行此脚本（非模块方式），自动执行
if (typeof window !== 'undefined' && typeof require === 'undefined') {
    // 浏览器环境且没有 require 函数，说明是直接执行
    invoke();
}
