# LT700P 调研白板测试复盘

日期：2026-08-10

## 已复现问题

### P0：`--current` 进入了别的 Research Run

- 现象：LT700P 证据包已经生成后，`workbench --current` 仍读取 `.runtime/codex-native/current-run.json` 中较早的其他商品任务。
- 根因：当前任务选择器只要发现指针指向一个仍存在的 manifest 就立即返回，没有与更新的 evidence package 比较时间。
- 风险：第一性原理、VOC、买样 Brief 等下游产物可能写到另一类目，造成跨任务污染。
- 修复：每次解析 `--current` 时同时扫描可用 evidence packages，按 manifest `createdAt` 选择最新任务并回写指针；需要操作旧任务时必须显式使用 `--run`。
- 回归测试：旧指针有效但存在更新 package 时，必须选中新 package。

### P1：纯关键词确认后创建 Run 报错

- 现象：页面已经允许只填写关键词并完成确认，但 `research:live -- --discovery ...` 又要求至少提供一个竞品 URL。
- 根因：页面输入契约与 CLI 启动条件不一致。
- 风险：用户按正常 UI 流程确认后，后台立即失败；Agent 只能临时改代码或伪造 URL。
- 修复：由保存的 discovery plan 统一构造 live input；关键词是有效主输入，图片和商品链接继续作为可选证据线索。
- 回归测试：`冰箱滤芯 LT700P 型号`、0 图片、0 链接仍能构造 live Research Run input。

### P1：部分历史分析字段缺失导致整份报告报错

- 现象：回归报告生成时抛出 `Cannot read properties of undefined (reading 'includes')`。
- 根因：文案本地化函数假设所有历史分析字段都完整；旧产物缺少 `skuSummary` 时没有展示兜底。
- 风险：单个非关键字段缺失会让白板/HTML 报告整体不可用。
- 修复：缺失文案统一显示“待研究确认”，继续保留其余可追溯内容。
- 回归测试：`undefined` 和 `null` 文案必须可渲染，历史 First-Principles 报告必须正常生成。

## 验证但未复现的问题

### 白板导航返回其他页面

- 白板 URL、页面标题、关键词和 discoveryId 保持一致时，刷新和页面内锚点不会切换到其他 Research Run。
- 首页的“选品工作台”会按产品既有设计恢复本浏览器最后打开的白板；这属于“继续上次任务”，但标签表达可能让新用户误以为会进入全新的 `/discover`。
- 首次浏览器断言出现过一次假失败：点击后用固定延时立即读取，拿到了路由切换前的旧 DOM；增加页面落点等待后，首页 → 选品工作台正确返回 LT700P 白板。
- 本轮不改变该导航逻辑。若后续仍收到误解反馈，建议把入口拆成“继续上次调研”和“开始新调研”两个明确动作。

## 测试反馈

- CLI 的页面契约此前没有端到端覆盖，单测只证明 discovery plan 和 ResearchRunner 各自可工作，没有覆盖二者的衔接。
- “current”是全局可变状态，测试必须包含“指针仍有效但已过期”的场景，不能只测文件不存在。
- 跨类目污染检查应保留为交付门禁；命中其他型号或品类词时应停止生成下游报告。
- 浏览器验收至少检查 discoveryId、页面 H2、关键词和 Research Run ID 四项，不能只以 HTTP 200 判定成功。
- UI 自动化应等待 URL 或目标页面标识发生变化，不能只依赖固定毫秒延时，否则会把路由尚未完成误报为跳错页面。
- 便携安装包没有包含部分历史类目 fixture；依赖这些 fixture 的 `report.test.tsx` 会出现 ENOENT，应从便携门禁中隔离，或后续把 fixture 显式打包。

## 本轮回归命令

```bash
npm test -- --run src/research/research.test.ts src/first-principles/first-principles.test.tsx src/app/workbench-shell.test.tsx
npm run test:portable
npm run lint
npm run workbench -- urls --current --json
```
