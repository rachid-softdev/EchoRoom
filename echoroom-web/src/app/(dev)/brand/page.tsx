import { notFound } from "next/navigation";
import { DevBadge } from "@/components/dev/DevBadge";

const palette = [
  { name: "Electric Cyan", hex: "#06b6d4", variable: "--brand-cyan" },
  { name: "Night", hex: "#0a0a0b", variable: "--brand-bg" },
  { name: "Surface", hex: "#111113", variable: "--brand-surface" },
  { name: "Text", hex: "#fafafa", variable: "--brand-text" },
];

export default function BrandPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold">Brand</h1>
        <DevBadge />
      </div>

      <p className="text-[#999] mb-10 text-sm">
        EchoRoom brand tokens, color palette, typography, and component patterns.
      </p>

      <section className="mb-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#555] mb-4">
          Color Palette
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {palette.map((c) => (
            <div key={c.hex} className="rounded-lg border border-[#222] bg-[#111] overflow-hidden">
              <div className="h-20" style={{ backgroundColor: c.hex }} />
              <div className="p-3">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-[#666] font-mono">{c.hex}</p>
                <p className="text-xs text-[#555] font-mono">{c.variable}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#555] mb-4">
          Typography
        </h2>
        <div className="rounded-lg border border-[#222] bg-[#111] p-6 space-y-4">
          <div>
            <p className="text-xs text-[#555] font-mono mb-1">Font Family</p>
            <p className="text-lg" style={{ fontFamily: "Inter, sans-serif" }}>
              Inter
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-[#555] font-mono mb-1">Bold</p>
              <p className="text-xl font-bold">Aa</p>
            </div>
            <div>
              <p className="text-xs text-[#555] font-mono mb-1">Medium</p>
              <p className="text-xl font-medium">Aa</p>
            </div>
            <div>
              <p className="text-xs text-[#555] font-mono mb-1">Regular</p>
              <p className="text-xl font-normal">Aa</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#555] mb-4">
          CSS Variables
        </h2>
        <div className="rounded-lg border border-[#222] bg-[#111] p-6">
          <pre className="text-xs text-[#999] font-mono overflow-x-auto">
{`:root {
  --brand-cyan: #06b6d4;
  --brand-bg: #0a0a0b;
  --brand-surface: #111113;
  --brand-text: #fafafa;
  --font-inter: "Inter", sans-serif;
}`}
          </pre>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#555] mb-4">
          Component Patterns
        </h2>
        <div className="space-y-4">
          <div className="rounded-lg border border-[#222] bg-[#111] p-6">
            <p className="text-xs text-[#555] font-mono mb-3">Card</p>
            <div className="rounded-lg border border-[#333] bg-[#0a0a0b] p-4 max-w-sm">
              <p className="text-sm font-medium mb-1">Card Title</p>
              <p className="text-xs text-[#666]">Card description text</p>
            </div>
          </div>
          <div className="rounded-lg border border-[#222] bg-[#111] p-6">
            <p className="text-xs text-[#555] font-mono mb-3">Badge</p>
            <div className="flex gap-2">
              <DevBadge />
              <span className="inline-flex items-center rounded-md bg-white/5 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/10">
                Secondary
              </span>
            </div>
          </div>
          <div className="rounded-lg border border-[#222] bg-[#111] p-6">
            <p className="text-xs text-[#555] font-mono mb-3">Button</p>
            <div className="flex gap-3">
              <button className="rounded-lg bg-[#06b6d4] px-4 py-2 text-sm font-medium text-black hover:bg-[#06b6d4]/90 transition-colors">
                Primary
              </button>
              <button className="rounded-lg border border-[#333] bg-transparent px-4 py-2 text-sm font-medium text-white hover:bg-white/5 transition-colors">
                Outline
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
