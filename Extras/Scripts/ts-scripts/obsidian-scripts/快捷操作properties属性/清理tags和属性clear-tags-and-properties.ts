
/*
- Author: AI Assistant based on existing templater script
- Create Time: 2025-01-16
- Description: 清空当前笔记的所有 tags，并删除指定的 properties（默认：notetoolbar）。
- warning: 这个脚本的最前面，不能放任何文本，frontmatter也不行，不然会被当做模版的一部分插入到笔记中。
- Version: 1.0
*/

// Obsidian 类型声明（仅用于 TypeScript 编译，运行时由 Obsidian 提供）
declare const app: any;
declare const Notice: any;

// --- 配置项 ---
const clearAllTags = true; // 是否清空所有 tags
const propertiesToRemove = ["notetoolbar"]; // 要删除的 frontmatter 属性
// --- END ---

/**
 * 清空 tags 并删除指定的 frontmatter 属性
 */
function clearTagsAndProperties(frontmatter: any) {
    // 清空 tags（无论是字符串还是数组形式，直接删除属性）
    if (clearAllTags && Object.prototype.hasOwnProperty.call(frontmatter, "tags")) {
        delete frontmatter.tags;
    }

    // 删除指定的属性
    propertiesToRemove.forEach((propertyName) => {
        if (Object.prototype.hasOwnProperty.call(frontmatter, propertyName)) {
            delete frontmatter[propertyName];
        }
    });
}

// 主函数：对当前活动文件执行清理
function main() {
    const activeFile = app.workspace.getActiveFile();
    if (activeFile) {
        const noteName = activeFile.basename;

        app.fileManager.processFrontMatter(activeFile, (fm: any) => {
            try {
                clearTagsAndProperties(fm);
                new Notice(`已为笔记 "${noteName}" 清空 tags 并删除指定 properties。`, 1200);
            } catch (e) {
                const message = (e as Error)?.message ?? String(e);
                const errorMessage = `为笔记 "${noteName}" 清理属性时出错: ${message}`;
                new Notice(errorMessage, 5000);
                console.error(errorMessage);
            }
        });
    } else {
        new Notice("错误：无法找到当前文件。", 5000);
    }
}

// 导出 invoke 函数，供 fix-require-modules 等插件调用
export async function invoke() {
    main();
}


