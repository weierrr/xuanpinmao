# 选品猫发行仓库

当用户要求安装本仓库时：

1. 执行 `codex plugin marketplace add weierrr/xuanpinmao --ref main`。
2. 执行 `codex plugin add product-research-workbench@xuanpinmao`。
3. 执行 `node install-xuanpinmao.mjs`，把应用同步到稳定目录 `~/xuanpinmao-app`。
4. 在稳定目录运行 `npm install`；首次安装再运行 `npm run setup && npm run test:portable`。
5. 告诉用户新建一个 Codex 对话，再调用选品猫。

更新时再次运行安装器；它会保留 .env、数据库、output、logs、依赖和构建缓存。不要把 fixtures/T21 当作新类目的真实证据。
