import React, { useEffect, useId } from "react";
import { Languages } from "lucide-react";
import "./GoogleTranslateWidget.css";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement: new (
          options: Record<string, unknown>,
          elementId: string,
        ) => void;
        InlineLayout: { SIMPLE: number; HORIZONTAL: number; VERTICAL: number };
      };
    };
  }
}

const SCRIPT_ID = "google-translate-script";

type GtLang = "en" | "hi" | "mr" | "kn";

const tryInitTranslate = (elementId: string) => {
  const el = document.getElementById(elementId);
  if (!el || !window.google?.translate?.TranslateElement) return;
  if (el.querySelector(".goog-te-gadget,.goog-te-combo")) return;

  new window.google.translate.TranslateElement(
    {
      pageLanguage: "en",
      includedLanguages: "en,hi,mr,kn",
      // Google types are incomplete; cast safely.
      layout:
        (window.google as any)?.translate?.TranslateElement?.InlineLayout
          ?.SIMPLE ?? 0,
      autoDisplay: false,
    },
    elementId,
  );
};

/**
 * Protect numeric values against being rewritten/duplicated by Google Translate.
 * We only touch small leaf nodes with numeric-like content.
 */
const protectNumericTextNodes = () => {
  const candidates = document.querySelectorAll(
    "span, b, strong, small, div, p, h1, h2, h3, h4, h5, h6, td, th, label",
  );

  candidates.forEach((node) => {
    const el = node as HTMLElement;
    if (el.classList.contains("notranslate")) return;
    if (el.getAttribute("translate") === "no") return;
    if (el.children.length > 0) return; // only leaf nodes

    const text = (el.textContent || "").trim();
    if (!text) return;
    if (text.length > 32) return;

    // Numeric-ish: digits, punctuation, units, parentheses, ranges (e.g. 97.54, (97.54), 15–40)
    const numericLike = /^[\d\s.,()%°℃°C–\-+/:]+$/.test(text);
    if (!numericLike) return;

    el.classList.add("notranslate");
    el.setAttribute("translate", "no");
  });
};

/** Hide Google Website Translator banner/top overlays to keep only our controls. */
const hideGoogleTranslateTopBar = () => {
  document.querySelectorAll("iframe.goog-te-banner-frame").forEach((node) => {
    const el = node as HTMLIFrameElement;
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("height", "0", "important");
    el.style.setProperty("width", "0", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("position", "absolute", "important");
    el.style.setProperty("left", "-9999px", "important");
    el.style.setProperty("border", "none", "important");
  });

  document.body.style.setProperty("top", "0", "important");
  document.body.style.setProperty("margin-top", "0", "important");
  document.body.style.setProperty("position", "relative", "important");
  document.documentElement.style.setProperty("margin-top", "0", "important");
  document.documentElement.style.setProperty("padding-top", "0", "important");

  document.querySelectorAll(
    "#goog-gt-tt, .goog-te-balloon-frame, .goog-te-banner-frame, .goog-tooltip",
  ).forEach((node) => {
    const el = node as HTMLElement;
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("height", "0", "important");
    el.style.setProperty("pointer-events", "none", "important");
    el.style.setProperty("opacity", "0", "important");
  });

  // Hide other translate-like iframes that Google may inject.
  document.querySelectorAll("iframe").forEach((node) => {
    const el = node as HTMLIFrameElement;
    const src = (el.getAttribute("src") || "").toLowerCase();
    const cls = (el.getAttribute("class") || "").toLowerCase();
    const name = (el.getAttribute("name") || "").toLowerCase();
    const id = (el.getAttribute("id") || "").toLowerCase();
    const looksLikeTranslate =
      cls.includes("skiptranslate") ||
      name.includes("goog-te") ||
      id.includes("goog-te") ||
      id.endsWith(".container") ||
      src.includes("translate.google.") ||
      src.includes("translate_a/");
    if (!looksLikeTranslate) return;
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("height", "0", "important");
    el.style.setProperty("width", "0", "important");
    el.style.setProperty("opacity", "0", "important");
    el.style.setProperty("pointer-events", "none", "important");
    el.style.setProperty("position", "absolute", "important");
    el.style.setProperty("left", "-9999px", "important");
  });

  protectNumericTextNodes();
};

const setGoogTransAndReload = (from: string, to: string) => {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `googtrans=/${from}/${to};path=/;max-age=${maxAge}`;
  window.location.reload();
};

const getCurrentGoogTransTo = (): string | null => {
  const m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/);
  return m?.[1] ?? null;
};

export const GoogleTranslateWidget: React.FC = () => {
  const reactId = useId().replace(/:/g, "");
  const elementId = `google_translate_element_${reactId}`;

  const currentTo = typeof window !== "undefined" ? getCurrentGoogTransTo() : null;
  const value: GtLang =
    currentTo === "hi" || currentTo === "mr" || currentTo === "kn" ? currentTo : "en";

  useEffect(() => {
    window.googleTranslateElementInit = () => {
      tryInitTranslate(elementId);
      hideGoogleTranslateTopBar();
    };

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src =
        "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    } else if (window.google?.translate?.TranslateElement) {
      tryInitTranslate(elementId);
      hideGoogleTranslateTopBar();
    }
  }, [elementId]);

  // Google re-injects overlays after translate runs; keep them suppressed.
  useEffect(() => {
    hideGoogleTranslateTopBar();

    let raf = 0;
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => hideGoogleTranslateTopBar());
    };

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, { childList: true, subtree: true });

    const burst = window.setInterval(() => hideGoogleTranslateTopBar(), 600);
    const stopBurst = window.setTimeout(() => clearInterval(burst), 25000);

    return () => {
      obs.disconnect();
      clearInterval(burst);
      clearTimeout(stopBurst);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="google-translate-widget notranslate"
      translate="no"
      aria-label="Translate page"
    >
      <div className="google-translate-widget__label">
        <Languages className="google-translate-widget__icon" size={16} aria-hidden />
        <span
          className="google-translate-widget__text notranslate"
          translate="no"
        >
          Translate…
        </span>
      </div>

      <div
        id={elementId}
        className="google-translate-widget__mount notranslate"
        translate="no"
      />

      <select
        className="google-translate-widget__select notranslate"
        translate="no"
        value={value}
        onChange={(e) => setGoogTransAndReload("en", e.target.value as GtLang)}
        aria-label="Select language"
        title="Translate page"
      >
        <option value="en" className="notranslate" translate="no">
          English
        </option>
        <option value="hi" className="notranslate" translate="no">
          हिन्दी
        </option>
        <option value="mr" className="notranslate" translate="no">
          मराठी
        </option>
        <option value="kn" className="notranslate" translate="no">
          ಕನ್ನಡ
        </option>
      </select>
    </div>
  );
};

export default GoogleTranslateWidget;

