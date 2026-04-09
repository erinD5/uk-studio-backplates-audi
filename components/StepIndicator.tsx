import { AgentRunStatus } from "@/lib/types";

type PipelineStepStatus = "idle" | "active" | "done";

interface StepIndicatorProps {
  agentStatus: {
    artDirector: AgentRunStatus;
    locationScout: AgentRunStatus;
    photographer: AgentRunStatus;
  };
  hasInstruction: boolean;
  isGenerating: boolean;
  hasGeneratedOutput: boolean;
}

const steps = [
  { key: "agents", label: "Agents" },
  { key: "instruction", label: "Edit instruction" },
  { key: "generate", label: "Nano Banana" },
] as const;

export function StepIndicator({
  agentStatus,
  hasInstruction,
  isGenerating,
  hasGeneratedOutput,
}: StepIndicatorProps) {
  const hasStartedAgents = [
    agentStatus.artDirector,
    agentStatus.locationScout,
    agentStatus.photographer,
  ].some((status) => status !== "idle");

  const allAgentsFinished =
    (agentStatus.artDirector === "done" || agentStatus.artDirector === "error") &&
    (agentStatus.locationScout === "done" ||
      agentStatus.locationScout === "error") &&
    (agentStatus.photographer === "done" || agentStatus.photographer === "error");

  const state: Record<(typeof steps)[number]["key"], PipelineStepStatus> = {
    agents: allAgentsFinished ? "done" : hasStartedAgents ? "active" : "idle",
    instruction: hasInstruction ? (isGenerating || hasGeneratedOutput ? "done" : "active") : "idle",
    generate: hasGeneratedOutput ? "done" : isGenerating ? "active" : "idle",
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => {
        const status = state[step.key];
        return (
          <div
            key={step.key}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors"
          >
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                status === "done"
                  ? "bg-green text-black"
                  : status === "active"
                    ? "bg-accent text-black"
                    : "bg-[#242424] text-text/70"
              }`}
            >
              {index + 1}
            </span>
            <span className="text-sm text-text/90">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
