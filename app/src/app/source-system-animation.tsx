import { Blocks, Bot, Database, Globe2, Network } from "lucide-react";
import type { CSSProperties } from "react";
import styles from "./source-system-animation.module.css";

const sources = [
  { code: "web", label: "公开网络", Icon: Globe2, className: styles.web },
  { code: "mcp", label: "第三方 MCP", Icon: Network, className: styles.mcp },
  { code: "api", label: "业务 API", Icon: Blocks, className: styles.api },
  { code: "data", label: "自有数据库", Icon: Database, className: styles.data },
];

export function SourceSystemAnimation() {
  return (
    <div className={styles.map} aria-label="可扩展数据源接入动画">
      <svg className={styles.routes} viewBox="0 0 520 430" aria-hidden="true">
        <path d="M260 70 L260 215" />
        <path d="M447 215 L260 215" />
        <path d="M260 360 L260 215" />
        <path d="M73 215 L260 215" />
      </svg>

      <div className={styles.core}>
        <Bot className={styles.logo} size={46} strokeWidth={2.5} />
        <strong>选品猫研究 Agent</strong>
        <span>统一证据结构</span>
        <i aria-hidden="true" />
      </div>

      {sources.map(({ code, label, Icon, className }, index) => (
        <div className={`${styles.source} ${className}`} key={code} style={{ "--source-index": index } as CSSProperties}>
          <Icon size={17} />
          <b>{label}</b>
        </div>
      ))}

      <span className={`${styles.packet} ${styles.packetWeb}`} aria-hidden="true" />
      <span className={`${styles.packet} ${styles.packetMcp}`} aria-hidden="true" />
      <span className={`${styles.packet} ${styles.packetApi}`} aria-hidden="true" />
      <span className={`${styles.packet} ${styles.packetData}`} aria-hidden="true" />

      <div className={styles.status} aria-hidden="true">
        <span>接入信源</span>
        <span>清洗去重</span>
        <span>标注来源</span>
        <span>写入证据池</span>
      </div>
    </div>
  );
}
