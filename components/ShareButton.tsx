"use client";

import { useEffect, useState } from "react";
import { MMIcon } from "@/lib/icons";

type Props = {
  /** Path + query of the page to share, e.g. `/map/haifa?n=hfa-ahuza`. */
  path: string;
  title: string;
  text?: string;
};

/**
 * Share a neighborhood: the phone's native share sheet when there is one
 * (WhatsApp etc.), otherwise copy the link and confirm inline.
 */
export function ShareButton({ path, title, text }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        // The user closed the share sheet — nothing to do. Anything else
        // falls through to copying the link.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("העתיקו את הקישור:", url);
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="mm-btn mm-btn-secondary mm-btn-sm"
      aria-label={`שתפו את ${title}`}
      style={{ flex: "none", gap: 6 }}
    >
      <MMIcon name={copied ? "check" : "share"} size={14} color={copied ? "var(--hn-positive)" : "currentColor"} />
      <span aria-live="polite">{copied ? "הקישור הועתק" : "שיתוף"}</span>
    </button>
  );
}
