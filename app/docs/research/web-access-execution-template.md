# Web Access Research Execution Template

本模板用于 Phase 2B-2W 的 Agent 侧 Research Executor。它不是 Next.js 后端接口，也不是用户点击按钮后自动启动浏览器的产品功能。

## 1. 输入

先读取证据包目录中的：

```text
manifest.json
research_input.json
research_plan.json
```

确认：

- `packageVersion`
- `researchRunId`
- `productName`
- `targetMarket`
- `description`
- `imagePaths`
- `competitorQueries`
- `supplierQueries`
- `regulationQueries`

`imagePaths` 是用户提供的商品图片输入引用，只用于理解研究对象，不得被写成 `verified` Source，也不得被当作已验证商品事实。

## 2. 执行边界

必须加载并遵守 `web-access` skill。

只允许：

- 公开网页读取；
- Agent 自己创建的后台标签页；
- 只读文本提取；
- 只读 HTML / JSON-LD / DOM 读取；
- 只读截图；
- 只读结构化字段提取。

禁止：

- 登录账户；
- 上传文件；
- 提交表单；
- 提交询盘；
- 购买；
- 发布内容；
- 操作用户已有 tab；
- 绕过验证码；
- 绕过平台访问限制；
- 保存 Cookie、Token、调试密钥或个人凭据。

## 3. 来源优先级

### Competitor Research

优先：

- 品牌官网；
- 独立站商品页；
- 主流电商平台公开商品页；
- 公开用户评价；
- 公开社区讨论。

竞品事实只用于市场、定价、定位和 Claim 参考，不得迁移为目标商品事实。

### Supplier Candidate Research

优先：

- Alibaba；
- 公开工厂官网；
- 可公开访问的 B2B 商品页；
- 其他公开供应商目录。

公开价格、MOQ、重量、包装信息必须标记为候选证据。无法确认 SKU 对应关系时，`evidenceStatus` 必须为 `needs_review`。

### Regulatory Research

优先：

- 政府官网；
- 官方监管机构；
- 官方法规数据库；
- 官方平台政策；
- 官方产品安全指南。

第三方文章只能帮助发现关键词或定位官方来源，不得作为最终法规结论的唯一证据。

### Customer / VOC Research

每条或每批用户证据必须记录：

- 观察单位：评论、回复、讨论线程或混合记录；
- 平台、来源家族、来源 ID、采集时间和适用市场；
- 具体型号、商品或用户场景（仅在来源明确时填写）；
- 主题标签和触发场景，可多标签；
- 情绪是否经过逐条编码，未编码时使用 `unknown`；
- 样本边界、去重方式和无法证明的事项。

不得把讨论线程数写成评论数或独立买家数；不得把主题覆盖数写成市场发生率；不同平台的数据在展示时保持分列。

## 4. 访问方式

按成本从低到高选择：

1. `web-search`：发现候选来源。
2. `web-fetch` / `web.open`：读取目标页面正文。
3. `curl`：读取原始 HTML、meta、JSON-LD。
4. `jina`：文章、博客、法规正文转 Markdown。
5. `cdp`：静态方式失败且页面公开可读时，用自己创建的后台 tab 读取动态 DOM 或截图。

静态抓取失败时才升级 CDP。完成后关闭自己创建的 tab。

## 5. 输出文件

必须写入当前证据包：

```text
research_package/
├── manifest.json
├── research_input.json
├── research_plan.json
├── sources.json
├── source_snapshots/
├── research_log.md
└── unresolved_items.json
```

### sources.json

每个来源必须包含：

- URL；
- 标题；
- 访问时间；
- 来源类型；
- 访问方式；
- 访问状态；
- 证据状态；
- 目标市场；
- 目标实体；
- 内容哈希（可用时）；
- 快照路径（可用时）；
- 原始文本摘要或正文快照。

禁止只有 AI 总结、没有原始 URL 或原文依据。

### source_snapshots/

保存可追溯快照：

- Markdown 正文；
- 原始 HTML 摘要；
- JSON-LD；
- 页面截图；
- PDF；
- 其他只读证据。

文件名使用来源 ID，避免路径冲突。

### research_log.md

至少记录：

- 执行时间；
- 使用的查询；
- 访问过的 URL；
- 访问方式；
- 成功来源；
- 失败来源；
- 降级过程；
- 被排除来源；
- 排除原因；
- 是否遇到登录墙、验证码、反爬或动态加载问题。

跨平台或跨来源采集还必须记录：

- 数据时间窗或抓取时点；
- 平台、渠道和来源家族；
- 原始数量、去重数量、有效数量和实际保留数量；
- 指标名称、分母、单位与聚合方式；
- 同类指标是否具备可比口径；
- 空结果、访问受阻和被排除样本，不得只记录成功结果。

用户之声必须按 marketplace、community、brand/support、specialist 等独立来源家族保留覆盖量。只有在来源、时间窗、去重规则和分母一致时，才允许生成跨渠道占比或排名。

### unresolved_items.json

记录无法公开确认的问题，例如：

- SKU 重量无法映射；
- MOQ 不是正式报价；
- DDP 包含项无法公开确认；
- 法规适用条件缺少官方说明。

## 6. 完成条件

完成后运行：

```bash
npm run research:validate -- --package <research_package_path>
```

如果后续要导入现有 Source 体系，再运行：

```bash
npm run research:import -- --package <research_package_path>
```

导入前必须确认：

- `manifest.json` 和 `research_input.json` 通过 Zod 校验；
- `sources.json` 通过 Zod 校验；
- `research_input.json` 与 `research_plan.json` 的商品和市场一致；
- 所有声明的 snapshotPath 位于当前证据包内；
- verified Source 有正文或可读快照；
- 每个 Source 有 URL；
- 竞品证据没有被标记为目标商品事实；
- 未知字段没有被写成 0；
- 登录墙或验证码问题已进入 `unresolved_items.json`。
- 报告中的数字可以回溯到带时间窗、单位和分母的当前 Run 记录；
- 每个建议动作都有明确的通过标准与停止或不升级条件；
- 跨平台 VOC 和竞品指标没有在口径不一致时被强行合并。
