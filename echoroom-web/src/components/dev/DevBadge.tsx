import { cn } from "@/components/ui";

export function DevBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-[#06b6d4]/10 px-2.5 py-1 text-xs font-semibold text-[#06b6d4] ring-1 ring-inset ring-[#06b6d4]/20",
        className,
      )}
    >
      DEV
    </span>
  );
}
