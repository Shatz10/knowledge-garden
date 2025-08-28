---
date created: 2023-01-23
date modified: 2025-07-17
status:
rating: 7
publish: true
title: Style Settings
aliases:
  - obsidian-style-settings
分类:
  - "[[obsidian插件 - fileclass]]"
---

## 给style setting中某些字段，配置快捷命令的方式。

这样有些需要高频切换开关的style设置，就不需要每次都到设置里面进行切换了。比如[[willemstad]]主题canvas隐藏node和group的标题的功能。

启用如下snippets既可，然后命令行中就出现了。重点是找到原来的配置，加上一行`addcommand:true` 既可。

```
/* @settings
name: Canvas Settings
id: canvas-settings
settings:
-
    id: canvas-settings
    title: Canvas
    type: heading
    description: 'Options to manipulate items in the Canvas.'
    level: 2
    collapsed: false
-
    id: ssopt-canvas-hide-node-labels
    title: Hide Node Labels
    type: class-toggle
    description: "When enabled, hides the labels/titles on individual nodes (files/cards) in the Canvas."
    default: false
    addCommand: true
-
    id: ssopt-canvas-hide-group-labels
    title: Hide Group Labels
    type: class-toggle
    description: "When enabled, hides the labels on groups in the Canvas."
    default: false
    addCommand: true
*/

```
