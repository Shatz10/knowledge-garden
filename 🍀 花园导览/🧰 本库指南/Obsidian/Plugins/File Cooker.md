---
title: File Cooker
date created: 2024-05-11
date modified: 2025-08-19
status: null
rating: 7
publish: true
一句话理由: 批量编辑、移动神器，和cursor联动有奇效
aliases:
- obsidian-file-cooker
分类: "[[obsidian插件 - fileclass]]"
---

2025-8-19发现，将文件拖动到canvas，然后选中，右键批量移动，非常方便，都不需要用到file cooker了。

必备，神器。文件批量移动，批量重命名，批量加properties，且都不会让反向链接失效。

使用文档：[obsidian-files-cooker/README\_zh.md at main · ivaneye/obsidian-files-cooker · GitHub](https://github.com/ivaneye/obsidian-files-cooker/blob/main/README_zh.md)

## File Cooker

点击右上角代码框，自动选中 dataview 代码后，可以使用 Copy Dataview result link 命令，批量复制链接，由于后续的批量移动文件。

**如果目标文件夹有重名，会导致失败**且没有提示，所以此时可以考虑新再建一个文件夹 2，先统一 move 过去，然后再用 Obsidian 自带的拖动功能，merge 2 个文件夹。

设置为-符号，就是删除。

### 批量操作的目标有

- 文件夹
- 文件
- canvas
- properties

### 批量的方式有

- 批量删除
- 批量添加
- 批量移动
- 批量合并

### dataview 语法

[[Dataview|Dataview]] 举例：

```dataview
LIST
FROM ""
WHERE contains(file.name, "映兔") AND !contains(file.path, "Atlas/Spaces/ingtube")

```

### 批量添加

cmd + p 中搜： file add to

### 批量移动

cmd + p 中搜： file move to
