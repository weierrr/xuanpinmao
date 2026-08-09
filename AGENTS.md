# 选品猫发行仓库

当用户要求安装本仓库时：

1. 执行 `codex plugin marketplace add weierrr/xuanpinmao --ref main`。
2. 执行 `codex plugin add product-research-workbench@xuanpinmao`。
3. 在 `app` 目录运行 `npm install && npm run setup && npm run test:portable`。
4. 告诉用户新建一个 Codex 对话，再调用选品猫。

不要把 fixtures/T21 当作新类目的真实证据。
