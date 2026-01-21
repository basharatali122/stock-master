import { StrictMode } from 'react';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Performance: Use concurrent rendering
const root = createRoot(document.getElementById("root")!);

// Render app
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register performance observer for debugging (development only)
if (import.meta.env.DEV) {
  // Log long tasks that might cause jank
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.debug('[Performance] Long task:', entry.duration.toFixed(2) + 'ms');
        }
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  }
}