"use client";

import { useEffect, useRef, useState } from "react";

export function PagePreview({ src, title }: { src: string; title: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function onMessage(event: MessageEvent) {
      if (event.data?.type === "page-preview-resize" && event.data.height) {
        setHeight(Math.min(event.data.height, 1200));
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="rounded-lg border border-[#222] bg-[#111] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#222] px-3 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-2 text-xs text-[#666] font-mono">{title}</span>
      </div>
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        className="w-full border-0 bg-white"
        style={{ height: `${height}px` }}
      />
    </div>
  );
}
