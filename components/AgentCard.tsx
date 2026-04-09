import { AgentRunStatus } from "@/lib/types";

interface AgentCardProps {
  icon: string;
  label: string;
  subtitle: string;
  status: AgentRunStatus;
  output: unknown;
}

export function AgentCard({
  icon,
  label,
  subtitle,
  status,
  output,
}: AgentCardProps) {
  const statusClass =
    status === "done"
      ? "bg-green"
      : status === "running"
        ? "bg-accent"
        : status === "error"
          ? "bg-red-400"
          : "bg-[#404040]";

  return (
    <section className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/40">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-xl" aria-hidden>
            {icon}
          </span>
          <div>
            <h3 className="text-base font-semibold text-text">{label}</h3>
            <p className="text-xs text-text/60">{subtitle}</p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-xs text-text/70">
          <span className={`h-2.5 w-2.5 rounded-full ${statusClass}`} />
          {status}
        </span>
      </header>

      <div className="max-h-72 overflow-auto rounded-lg border border-border bg-[#0b0b0b] p-3 font-mono text-xs text-text/80">
        {output ? (
          <pre>{JSON.stringify(output, null, 2)}</pre>
        ) : (
          <p className="text-text/45">Waiting for output...</p>
        )}
      </div>
    </section>
  );
}
