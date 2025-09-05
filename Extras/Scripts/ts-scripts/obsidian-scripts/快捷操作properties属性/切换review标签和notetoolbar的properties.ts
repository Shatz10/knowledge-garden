
/*
- Author: Gemini based on Moy's script
- Create Time: 2024-07-31
- Description: 这个脚本用于为当前笔记切换 review 状态。
-            如果笔记没有 review 标签和 SpacedRepetition 工具栏，则添加它们；
-            如果两者都存在，则移除它们及相关的 sr- 属性。
-            如果重复连续快速点击执行这个脚本，会不生效，可能是缓存没更新的问题。
- warning: 这个脚本的最前面，不能放任何文本，frontmatter也不行，不然会被当做模版的一部分插入到笔记中。
- Version: 3.0
*/

// Obsidian 类型声明（仅用于 TypeScript 编译，运行时由 Obsidian 提供）
declare const app: any;
declare const Notice: any;

// --- 配置项 ---
const tagToAdd = "review";
const toolbarProperty = "notetoolbar";
const toolbarValue = "SpacedRepetition";
const srPropertyNames = ["sr-due", "sr-interval", "sr-ease"];
// --- END ---

function toggleReviewProperties(fm: any) {
    // Helper to parse tags,兼容数组和字符串形式
    const getTags = (frontmatter: any) => {
        if (!frontmatter.tags) return [];
        if (Array.isArray(frontmatter.tags)) return [...frontmatter.tags];
        if (typeof frontmatter.tags === 'string' && frontmatter.tags.length > 0) {
            return frontmatter.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
        return [];
    };

    const currentTags = getTags(fm);
    const hasReviewTag = currentTags.includes(tagToAdd);
    const hasToolbar = fm[toolbarProperty] === toolbarValue;

    if (hasReviewTag && hasToolbar) {
        // --- 移除操作 ---
        // 1. 移除 review 标签
        fm.tags = currentTags.filter((t: string) => t !== tagToAdd);
        if (fm.tags.length === 0) {
            delete fm.tags; // 如果没有其他标签，则删除 tags 属性
        }

        // 2. 移除 notetoolbar
        delete fm[toolbarProperty];

        // 3. 移除所有 sr- 属性
        srPropertyNames.forEach(prop => {
            if (Object.prototype.hasOwnProperty.call(fm, prop)) {
                delete fm[prop];
            }
        });
        return "removed";

    } else {
        // --- 添加/更新操作 ---
        // 1. 查找并暂存现有的 SR 属性
        const foundSrProps: [string, any][] = [];
        for (const key in fm) {
            if (Object.prototype.hasOwnProperty.call(fm, key) && srPropertyNames.includes(key)) {
                foundSrProps.push([key, fm[key]]);
            }
        }

        // 2. 从原始位置删除它们，以便后续移动到末尾
        foundSrProps.forEach(([key, _]) => {
            delete fm[key];
        });

        // 3. 添加 review 标签 (如果不存在)
        if (!hasReviewTag) {
            currentTags.push(tagToAdd);
        }
        fm.tags = currentTags;

        // 4. 添加 notetoolbar
        fm[toolbarProperty] = toolbarValue;

        // 5. 将 SR 属性重新添加到末尾，保持其原始相对顺序
        if (foundSrProps.length > 0) {
            foundSrProps.forEach(([key, value]) => {
                fm[key] = value;
            });
        }
        return "added";
    }
}


// 主函数：切换 review 属性
function main() {
    // 使用 Obsidian 官方 API 获取当前活动文件
    const activeFile = app.workspace.getActiveFile();
    if (activeFile) {
        const notePath = activeFile.path;
        const noteName = activeFile.basename;

        app.fileManager.processFrontMatter(activeFile, (fm) => {
            try {
                const result = toggleReviewProperties(fm);
                if (result === "added") {
                    new Notice(`已为笔记 "${noteName}" 添加 review 状态。`, 1200);
                } else if (result === "removed") {
                    new Notice(`已从笔记 "${noteName}" 移除 review 状态。`, 1200);
                }
            } catch (e) {
                const errorMessage = `为笔记 "${noteName}" 更新属性时出错: ${(e as Error).message}`;
                new Notice(errorMessage, 5000);
                console.error(errorMessage);
            }
        });
    } else {
        new Notice("错误：无法找到当前文件。", 5000);
    }
}

// 导出 invoke 函数，供 fix-require-modules 插件调用
export async function invoke() {
    main();
}
