"use client";

import { useEffect } from "react";
import { getAppInsights, trackEvent } from "@/lib/app-insights";

export function AppInsightsProvider() {
  useEffect(() => {
    const ai = getAppInsights();
    if (ai) {
      trackEvent("SCDI_Dashboard_Mounted", {
        clientTimestamp: new Date().toISOString(),
        url: window.location.href,
        referrer: document.referrer || "direct",
      });
    }
  }, []);

  return null;
}
