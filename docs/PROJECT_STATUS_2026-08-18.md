# 选品猫项目交接状态 — 2026-08-18

本文件用于在另一台电脑继续开发。它只记录源码状态、公开证据摘要和恢复命令；不包含 `.env`、数据库、Cookie、用户会话或本地 Research Run 原始输出。

## 当前代码进度

- `/discover/plan` 确认后可自动创建、绑定并启动对应 Research Run，不需要用户回到聊天再次发送“继续”。
- 实时白板支持自动启动、进度刷新、六模块报告、结构化 VOC、证据强度、来源展开、行动门禁和报告评分卡。
- 报告排版已从大段结论改为核心判断、编号论据、指标卡、渠道/主题/场景/情绪分区及证据边界。
- 新增报告分享 API、分享页、博客页面与公开冰箱滤芯示例。
- 证据更新引擎支持不可变批次、去重、影响章节、版本差异和自动重算。
- 自动重算已移除跨类目污染的“真实样裤”兜底文案，并为清洁用品加入任务、气味、瓶器、泄漏、补充和宣称边界的验证映射；相同产品动作和证明要求会合并去重。

## 最新真实研究进度

- Discovery: `discovery-category-8ac6badba8e1-us`
- Research Run: `research-run-product-18e31c098b7f-us`
- 类目/市场: 清洁用品 / US
- 状态: 研究与本轮跨渠道 VOC 补证已完成；商业决策仍为 `HOLD_SUPPLY`。
- Evidence Package: 41 个来源、23 条声明、0 个来源映射错误。
- 搜索日志: 33 条真实查询，结构化校验通过。
- VOC 页面视图: 20 个 Reddit 讨论线程、11 条 Marketplace 可见评论正文、5 项品牌 FAQ/支持观察。
- Marketplace 来源强度: 3 条已验证购买；8 条品牌转发、促销或激励来源。
- 新增核心要求: 日常维护/深清洁分层、厨房气味适配、喷头寿命与密封运输、备件/替换成本、材质/稀释说明、清洁与消毒声明矩阵。

研究运行文件保存在原电脑的 `~/xuanpinmao-app/output/` 和本地数据库中，按安全边界未提交 Git。另一台电脑可继续开发源码；如需完整复制同一个本地 Run，应通过加密点对点方式单独迁移 `output` 与数据库，不要提交公开仓库。

## 当前判断与缺口

- 已完成: 市场、用户、竞品、供应、合规五条证据线；去重；六模块报告；跨渠道 VOC 增强；报告重算与白板同步。
- 仍阻塞: Amazon 直接访问返回 503；缺少 20–50 个 ASIN 基线和至少 500 条去重正文。
- 仍阻塞: 三个供应候选尚无正式 MOQ、阶梯价、样品、SDS、交期和质量文件。
- 仍阻塞: 目标样品的性能、气味、瓶器/运输和标签/宣称测试未执行。
- 仍阻塞: 采购、履约、退款、补发、客服、退货和 CAC 纳入后的期望贡献利润未知。

## 已验证检查

- `npm run research:validate -- --package output/research/research-run-product-18e31c098b7f-us`：通过，0 errors / 0 warnings。
- `npm run research:verify-search-log -- research-run-product-18e31c098b7f-us`：通过，33 条结构化查询。
- `npx vitest run src/evidence-updates/recompute.test.ts src/research-whiteboard/research-whiteboard.test.ts src/app/discover/plan/whiteboard/research-whiteboard-report.test.tsx`：16/16 通过。
- `npm run test:portable`：5 个测试文件、28/28 通过，可用于新电脑安装验收。
- `npm run build`：生产构建通过；仅有一条既有 CSS `end`/`flex-end` 兼容性警告。
- `npx eslint src/evidence-updates/recompute.ts`：通过。
- 全量 `npm test` 在不迁移本地 `output/` 的干净 checkout 中为 42/56 个测试文件通过、238/320 个测试通过；82 个失败均指向被安全排除的历史 Research Run fixture 文件不存在。运行 `npm run setup` 或迁移测试 fixture 后再执行全量测试。
- 全仓库 `npm run lint` 当前仍有 118 个既有脚本类型/未使用变量错误；不是本轮引入，后续应单独清理。

## 另一台电脑恢复

```bash
git clone https://github.com/weierrr/xuanpinmao.git
cd xuanpinmao
git fetch origin
git switch codex/xuanpinmao-handoff-20260818
node install-xuanpinmao.mjs
cd ~/xuanpinmao-app
npm install
npm run setup
npm run test:portable
npm run dev -- --port 3001
```

打开：

```text
http://localhost:3001/discover
```

## 建议的下一段 coding

1. 为跨类目自动重算增加领域词典注册机制，避免继续在核心函数中堆类目正则。
2. 把 Marketplace 的“已验证购买 / 转发 / 激励”作为一级过滤器和报告图例。
3. 为 80 条以上、2 个以上 Marketplace 的 VOC 批次补比例稳定性与渠道差异门禁。
4. 单独建立 lint 修复分支，先处理 `scripts/` 的 `any`、未使用变量和非空断言。
