"use client";

import Image from "next/image";

interface GenerationPanelProps {
  isGenerating: boolean;
  inputPreview: string | null;
  outputPreview: string | null;
  variants: Array<{ id: string; previewUrl: string }>;
  selectedVariantId: string | null;
  onSelectVariant: (id: string) => void;
  onDownload: () => void;
  onDownloadAll: () => void;
  onRegenerate: () => void;
  onRefine: () => void;
  refinePrompt: string;
  onRefinePromptChange: (value: string) => void;
  canRefine: boolean;
  canRegenerate: boolean;
  error: string | null;
  onOpenImage: (url: string, label: string) => void;
  feedbackByVariant: Record<string, "accepted" | "rejected">;
  onMarkVariantAccepted: (id: string) => void;
  onMarkVariantRejected: (id: string) => void;
}

export function GenerationPanel({
  isGenerating,
  inputPreview,
  outputPreview,
  variants,
  selectedVariantId,
  onSelectVariant,
  onDownload,
  onDownloadAll,
  onRegenerate,
  onRefine,
  refinePrompt,
  onRefinePromptChange,
  canRefine,
  canRegenerate,
  error,
  onOpenImage,
  feedbackByVariant,
  onMarkVariantAccepted,
  onMarkVariantRejected,
}: GenerationPanelProps) {
  return (
    <section className="border border-border bg-surface p-4">
      <header className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-text">
          Generation
        </h3>
      </header>

      {isGenerating ? (
        <div className="mb-4">
          <div className="h-1.5 w-full overflow-hidden border border-border bg-white">
            <div className="h-full w-1/3 animate-progress bg-black" />
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.08em] text-text/70">Running Nano Banana...</p>
        </div>
      ) : null}

      {error ? (
          <p className="mb-4 border border-red-700/40 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {inputPreview && outputPreview ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <figure className="relative overflow-hidden border border-border bg-white">
              <figcaption className="border-b border-border px-3 py-2 text-xs uppercase tracking-[0.08em] text-text/65">
                Input - AVP Asset
              </figcaption>
              <button
                type="button"
                onClick={() => onOpenImage(inputPreview, "Input AVP Asset")}
                className="absolute right-2 top-2 z-10 border border-border bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-text hover:bg-black hover:text-white"
              >
                Fullscreen
              </button>
              <Image
                src={inputPreview}
                alt="Input AVP asset"
                width={1600}
                height={900}
                unoptimized
                className="w-full object-cover"
              />
            </figure>
            <figure className="relative overflow-hidden border border-border bg-white">
              <figcaption className="border-b border-border px-3 py-2 text-xs uppercase tracking-[0.08em] text-text/65">
                Output - Backplate Generated
              </figcaption>
              <button
                type="button"
                onClick={() => onOpenImage(outputPreview, "Generated Backplate")}
                className="absolute right-2 top-2 z-10 border border-border bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-text hover:bg-black hover:text-white"
              >
                Fullscreen
              </button>
              <Image
                src={outputPreview}
                alt="Generated backplate output"
                width={1600}
                height={900}
                unoptimized
                className="w-full object-cover"
              />
            </figure>
          </div>
          {variants.length > 1 ? (
            <div className="mt-3 border border-border bg-white p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.08em] text-text/70">
                Batch variants (4 options)
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {variants.map((variant, index) => {
                  const selected = selectedVariantId === variant.id;
                  const feedback = feedbackByVariant[variant.id];
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => onSelectVariant(variant.id)}
                    className={`relative shrink-0 overflow-hidden border transition ${
                        selected
                        ? "border-2 border-black bg-black/5"
                        : "border-border hover:border-black"
                      }`}
                    >
                      <span className="absolute left-1 top-1 z-10 border border-border bg-white px-1.5 py-0.5 text-[10px] text-text/85">
                        V{index + 1}
                      </span>
                      {selected ? (
                        <span className="absolute right-1 top-1 z-10 border border-border bg-black px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          Selected
                        </span>
                      ) : null}
                      <div className="absolute bottom-1 left-1 z-10 flex gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onMarkVariantAccepted(variant.id);
                          }}
                          className={`border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            feedback === "accepted"
                              ? "border-emerald-700 bg-emerald-700 text-white"
                              : "border-border bg-white text-text hover:bg-black hover:text-white"
                          }`}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onMarkVariantRejected(variant.id);
                          }}
                          className={`border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            feedback === "rejected"
                              ? "border-red-700 bg-red-700 text-white"
                              : "border-border bg-white text-text hover:bg-black hover:text-white"
                          }`}
                        >
                          ✕
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenImage(variant.previewUrl, `Variant ${index + 1}`);
                        }}
                        className="absolute bottom-1 right-1 z-10 border border-border bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-text hover:bg-black hover:text-white"
                      >
                        Full
                      </button>
                      <Image
                        src={variant.previewUrl}
                        alt="Generated variant"
                        width={640}
                        height={360}
                        unoptimized
                        className="h-28 w-52 object-cover md:h-32 md:w-64"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 border border-green/40 bg-green/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-green">✓ Generation complete</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRefine}
                disabled={!canRefine || isGenerating}
                className="border border-border bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-text transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Refine
              </button>
              <button
                type="button"
                onClick={onDownloadAll}
                disabled={variants.length === 0 || isGenerating}
                className="border border-border bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-text transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Download all ZIP
              </button>
              <button
                type="button"
                onClick={onRegenerate}
                disabled={!canRegenerate || isGenerating}
                className="border border-border bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-text transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Re-generate
              </button>
              <button
                type="button"
                onClick={onDownload}
                className="border border-green/60 bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-green transition hover:bg-green hover:text-white"
              >
                Download PNG
              </button>
            </div>
          </div>
          <div className="mt-3 border border-border bg-white p-3">
            <label className="mb-2 block text-xs uppercase tracking-[0.08em] text-text/70">
              Refine mode (surgical edit)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={refinePrompt}
                onChange={(event) => onRefinePromptChange(event.target.value)}
                placeholder="e.g. remove the house on the right, keep the road/sky/mood unchanged"
                className="w-full border border-border bg-white px-3 py-2 text-sm text-text outline-none transition focus:border-black"
              />
              <button
                type="button"
                onClick={onRefine}
                disabled={!canRefine || isGenerating}
                className="shrink-0 border border-border bg-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apply
              </button>
            </div>
            <p className="mt-2 text-[11px] text-text/55">
              Refine edits the current output image and preserves everything not explicitly
              requested.
            </p>
          </div>
        </>
      ) : (
        <p className="text-sm text-text/60">
          Generated output will appear here after Nano Banana returns an image.
        </p>
      )}
    </section>
  );
}
