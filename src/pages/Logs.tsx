import { useState } from "react";
import WebhookLogs from "./WebhookLogs";
import Debug from "./Debug";

const tabs = [
  { key: "logs", label: "Logs" },
  { key: "debug", label: "Debug" },
] as const;

export default function Logs() {
  const [tab, setTab] = useState<"logs" | "debug">("logs");

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl bg-secondary/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tap rounded-lg px-5 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "logs" ? <WebhookLogs /> : <Debug />}
    </div>
  );
}
