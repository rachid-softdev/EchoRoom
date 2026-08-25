import { notFound } from "next/navigation";
import Link from "next/link";
import { DevBadge } from "@/components/dev/DevBadge";

export default function DevPagesHub() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold">Dev Pages</h1>
        <DevBadge />
      </div>

      <p className="text-[#999] mb-10 text-sm">
        Internal development pages for previewing UI states, error boundaries, and brand assets.
      </p>

      <section className="mb-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#555] mb-4">
          Quick Links
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/dev/pages/404-preview"
            className="rounded-lg border border-[#222] bg-[#111] p-4 hover:border-[#06b6d4]/40 transition-colors"
          >
            <p className="font-medium text-sm mb-1">404 Preview</p>
            <p className="text-xs text-[#666]">Preview the not-found page</p>
          </Link>
          <Link
            href="/dev/pages/error"
            className="rounded-lg border border-[#222] bg-[#111] p-4 hover:border-[#06b6d4]/40 transition-colors"
          >
            <p className="font-medium text-sm mb-1">Error Preview</p>
            <p className="text-xs text-[#666]">Preview the error boundary</p>
          </Link>
          <Link
            href="/dev/brand"
            className="rounded-lg border border-[#222] bg-[#111] p-4 hover:border-[#06b6d4]/40 transition-colors"
          >
            <p className="font-medium text-sm mb-1">Brand Page</p>
            <p className="text-xs text-[#666]">Colors, typography & patterns</p>
          </Link>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#555] mb-4">
          State Previews
        </h2>
        <div className="rounded-lg border border-[#222] bg-[#111] p-6">
          <p className="text-sm text-[#999]">
            Use the quick links above to preview individual page states in the browser.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#555] mb-4">
          Technical Details
        </h2>
        <div className="rounded-lg border border-[#222] bg-[#111] p-6 space-y-3 text-sm text-[#999]">
          <p>
            <span className="text-[#666] font-mono text-xs">NODE_ENV</span>{" "}
            {process.env.NODE_ENV}
          </p>
          <p>
            <span className="text-[#666] font-mono text-xs">middleware</span>{" "}
            /dev/* is blocked in production via rewrite to /404
          </p>
          <p>
            <span className="text-[#666] font-mono text-xs">layout</span>{" "}
            Server-side notFound() guard in (dev) layout and each page
          </p>
        </div>
      </section>
    </div>
  );
}
