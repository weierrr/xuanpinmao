# Scripts

建议由 Codex 创建：

## validate_report.py
检查：
- 15模块数量和计数
- 必填字段
- 枚举值
- Claim与source_id引用
- HTML/Markdown主结论一致性
- Unicode替换字符
- 正式状态唯一性

## unit_economics.py
输入：
- 收入
- 采购
- 包装
- 国内运输
- 国际物流/DDP
- 税费
- 支付
- 退款
- 拒付
- 瑕疵/补发

输出：
- 落地成本
- 毛利
- CM1
- CM1利润率
- 盈亏平衡CPA
- 盈亏平衡ROAS
- 恒等式校验

不要在缺少关键数据时用默认行业值自动补齐。
