import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA Service Worker guard: prevent SW interference in Lovable preview/iframe
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost = window.location.hostname.includes("id-preview--");
if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then(r => r.forEach(sw => sw.unregister()));
}

createRoot(document.getElementById("root")!).render(<App />);
