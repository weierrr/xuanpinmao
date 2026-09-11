# 选品猫测试版

这不是单独的提示词插件，而是可运行的完整测试环境，包含选品猫应用、实时调研白板、最新版 Codex 插件和本地 Marketplace。

插件版本：`0.3.0+codex.20260911`

## 安装应用

```bash
cd app
npm install
npm run setup
npm run doctor
npm run test:portable
npm run dev
```

打开 <http://localhost:3000>。

## 安装插件

在测试包根目录执行：

```bash
codex plugin marketplace add "当前测试包根目录的绝对路径"
codex plugin add product-research-workbench@xuanpinmao
```

如果通过 GitHub 安装，直接执行：

```bash
codex plugin marketplace add weierrr/xuanpinmao --ref main
codex plugin add product-research-workbench@xuanpinmao
node install-xuanpinmao.mjs
```

安装后必须新建 Codex 对话，再输入“使用选品猫调研一个新类目”。

插件同时包含 `xuanpinmao-content` skill，用于把第一性原理用户研究转为选品猫长期内容栏目。安装后可以输入：

```text
使用 $xuanpinmao-content，围绕美国宠物清洁用品，制作一期“选品先看人”内容。
```

它支持连载选题规划、单期研究、已有报告改写和旧稿更新，并可从一份证据底稿生成小红书、公众号和网站博客草稿。

## 更新

```bash
codex plugin marketplace upgrade xuanpinmao
codex plugin add product-research-workbench@xuanpinmao
node install-xuanpinmao.mjs
```

安装器把程序同步到 `~/xuanpinmao-app`，更新时保留本地环境、数据库、历史报告和日志。

## 正确流程

```text
组合填写关键词、图片和竞品链接
→ 页面内确认研究对象
→ 自动打开实时白板
→ 创建与白板绑定的独立 Research Run
→ 可视化来源、查询、采集、去重和有效记录
→ 生成市场与机会、用户画像、竞品分析、产品方案、营销打法、验证方案
→ 默认交付白板页面与 reports/whiteboard-report.html
→ 新证据以批次回流并生成新版本
```

如果流程跳过页面确认、没有打开白板，或把旧版纵向报告当成主报告，请停止该轮并检查是否在安装插件后创建了新对话。

历史 Run、密钥、浏览器状态和开发者本机数据库均未包含在分享包中。`fixtures/T21` 只用于回归测试，不能作为新类目的证据。
