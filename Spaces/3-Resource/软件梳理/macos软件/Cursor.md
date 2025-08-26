---
date created: 2023-12-02
date modified: 2024-11-21
title: Cursor
当前使用频率: 5
brew安装命令: brew install --cask cursor
评价: 7
订阅费用（年）: 750 元
icon: "[[cursor-icon-cc-image.jpg]]"
当前是否还在使用: true
设置同步: 插件通过vscode 中转，其他手动同步。
publish: true
跨平台技术栈: "[[Electron]]"
icon-3d: "[[cursor-3d-icon-cc-image.png]]"
分类:
  - "[[AI产品 - fileclass]]"
  - "[[windows软件 - fileclass]]"
  - "[[AI产品-编程 - fileclass]]"
  - "[[raycast插件 - fileclass]]"
  - "[[macOS软件 - fileclass]]"
---

[[cursor cli]]

[[cursor 使用技巧总结]]
[[cursor和idea比如goland之间互相跳转]]

[[cursor开发ios 项目]]

[[cursor账号清单]]

[[cursor-auto 试用]]
## 默认快捷键配置

向前向后改成 cmd + `[`

cmd + p ，输入 shortcut，打开 JSON 格式的用户自定义快捷键设置，改成如下：

```
// Place your key bindings in this file to override the defaultsauto[]
[
    {
        "key": "cmd+[",
        "command": "-editor.action.outdentLines",
        "when": "editorTextFocus && !editorReadonly"
    },
    {
        "key": "cmd+]",
        "command": "-editor.action.indentLines",
        "when": "editorTextFocus && !editorReadonly"
    },
    {
        "key": "cmd+[",
        "command": "workbench.action.navigateBack",
        "when": "canNavigateBack"
    },
    {
        "key": "cmd+]",
        "command": "workbench.action.navigateForward",
        "when": "canNavigateForward"
    }
]
```

## 使用技巧

用它生成 Git commit 信息

chat 框中，@Git ，找到 Git commit ，然后粘贴下面的提示词既可。

```
You are an expert software engineer.
Review the provided context and diffs which are about to be committed to a git repo.
Review the diffs carefully.
Generate a commit message for those changes.
The commit message MUST use the imperative tense.
The commit message should be structured as follows: <type>: <description>
Use these for <type>: fix, feat, build, chore, ci, docs, style, refactor, perf, test
Reply with JUST the commit message, without quotes, comments, questions, etc!
```

[[ai 生成界面和样式代码]]