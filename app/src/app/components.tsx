import { AlertTriangle, Ban, CheckCircle2 } from "lucide-react";
import { statusZh } from "@/presentation/zh";

export function PageHeader({
  title,
  subtitle,
  status,
  dataOrigin = "fixture",
}: Readonly<{
  title: string;
  subtitle: string;
  status?: string;
  dataOrigin?: "fixture" | "live" | "none";
}>) {
  return (
    <div className="topbar">
      <div>
        <h1 className="title">{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      <div className="grid">
        {dataOrigin === "fixture" ? (
          <span className="fixture-badge">
            <AlertTriangle size={14} />
            测试数据
          </span>
        ) : null}
        {dataOrigin === "live" ? (
          <span className="status-badge">
            <CheckCircle2 size={14} />
            真实研究
          </span>
        ) : null}
        {status ? (
          <span className={`status-badge ${status === "HOLD_SUPPLY" ? "hold-supply" : ""}`}>
            <CheckCircle2 size={14} />
            {statusZh(status)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Metric({
  label,
  value,
}: Readonly<{
  label: string;
  value: string | number;
}>) {
  return (
    <div className="card metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ActionCard({
  title,
  allowed,
  reason,
}: Readonly<{
  title: string;
  allowed: boolean;
  reason: string;
}>) {
  return (
    <div className={`action-card ${allowed ? "allowed" : "disabled"}`}>
      <div className="action-card-title">
        <span>{title}</span>
        <span className={allowed ? "plain-badge" : "blocked-badge"}>
          {allowed ? (
            <CheckCircle2 size={14} />
          ) : (
            <Ban size={14} />
          )}
          {allowed ? "允许" : "禁用"}
        </span>
      </div>
      <p>{reason}</p>
    </div>
  );
}
