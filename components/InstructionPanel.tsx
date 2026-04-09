"use client";

interface InstructionPanelProps {
  instruction: string;
}

export function InstructionPanel({ instruction }: InstructionPanelProps) {
  async function copyInstruction() {
    await navigator.clipboard.writeText(instruction);
  }

  if (!instruction) return null;

  return (
    <section className="border border-border bg-surface">
      <div className="h-px w-full bg-border" />
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-text">
            Assembled edit instruction
          </h3>
          <button
            type="button"
            onClick={copyInstruction}
            className="border border-border bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-text transition hover:bg-black hover:text-white"
          >
            Copy
          </button>
        </div>
        <pre className="max-h-80 overflow-auto border border-border bg-white p-3 font-mono text-xs text-text">
          {instruction}
        </pre>
      </div>
    </section>
  );
}
