"use client";

import { useState } from "react";

export function ShareButton({ id, title }: { id: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="link-button"
      onClick={async () => {
        const url = `${window.location.origin}/e/${id}`;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        } catch {}
      }}
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
