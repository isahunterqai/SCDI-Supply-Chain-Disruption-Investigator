/**
 * Azure Application Insights Telemetry Integration for SCDI
 * Connects the Next.js 15 Command Center & Agent to Azure Monitor
 */
import { ApplicationInsights } from "@microsoft/applicationinsights-web";

export const APP_INSIGHTS_CONNECTION_STRING =
  process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING ||
  process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ||
  "InstrumentationKey=f30b4c6a-de1c-4d93-9947-9bd9acc8e2e3;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=f7e07a9d-2908-4d76-b6d3-6dbb1b51c9e3";

/**
 * Azure Monitor Standards-Compliant OpenTelemetry (OTLP) Ingestion Configuration
 */
export const AZURE_MONITOR_OTLP = {
  dcrName: "managed-hackathonvm01-appins-dcr",
  dcrId: "dcr-6cbb891352f24534aba0f59439a3ae3a",
  dceHost: "managed-hackathonvm01-appins-dce-6av7.eastus-1.ingest.monitor.azure.com",
  tracesEndpoint:
    "https://managed-hackathonvm01-appins-dce-6av7.eastus-1.ingest.monitor.azure.com/dataCollectionRules/dcr-6cbb891352f24534aba0f59439a3ae3a/streams/Microsoft-OTLP-Traces/otlp/v1/traces",
  metricsEndpoint:
    "https://managed-hackathonvm01-appins-dce-6av7.eastus-1.metrics.ingest.monitor.azure.com/dataCollectionRules/dcr-6cbb891352f24534aba0f59439a3ae3a/streams/Microsoft-OtelMetrics/otlp/v1/metrics",
  logsEndpoint:
    "https://managed-hackathonvm01-appins-dce-6av7.eastus-1.ingest.monitor.azure.com/dataCollectionRules/dcr-6cbb891352f24534aba0f59439a3ae3a/streams/Microsoft-OTLP-Logs/otlp/v1/logs",
};

let appInsightsInstance: ApplicationInsights | null = null;

export function getAppInsights(): ApplicationInsights | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!appInsightsInstance) {
    try {
      appInsightsInstance = new ApplicationInsights({
        config: {
          connectionString: APP_INSIGHTS_CONNECTION_STRING,
          enableAutoRouteTracking: true,
          disableFetchTracking: false,
          disableAjaxTracking: false,
          enableCorsCorrelation: true,
          enableUnhandledPromiseRejectionTracking: true,
          maxBatchInterval: 2000,
        },
      });
      appInsightsInstance.loadAppInsights();
      appInsightsInstance.trackPageView({ name: "SCDI Command Center" });
    } catch (err) {
      console.warn("Application Insights initialization notice:", err);
    }
  }

  return appInsightsInstance;
}

export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>,
  measurements?: Record<string, number>
) {
  if (typeof window !== "undefined") {
    const ai = getAppInsights();
    ai?.trackEvent({ name, properties, measurements });
  }
}

export function trackMetric(
  name: string,
  average: number,
  properties?: Record<string, string | number | boolean>
) {
  if (typeof window !== "undefined") {
    const ai = getAppInsights();
    ai?.trackMetric({ name, average }, properties);
  }
}

export function trackException(error: Error, properties?: Record<string, string | number | boolean>) {
  if (typeof window !== "undefined") {
    const ai = getAppInsights();
    ai?.trackException({ exception: error, properties });
  }
}

/**
 * Server-side telemetry dispatcher using the Azure Ingestion REST endpoint
 */
export async function trackServerEvent(
  name: string,
  properties?: Record<string, any>,
  measurements?: Record<string, number>
): Promise<void> {
  const match = APP_INSIGHTS_CONNECTION_STRING.match(/InstrumentationKey=([^;]+)/);
  const iKey = match ? match[1] : "f30b4c6a-de1c-4d93-9947-9bd9acc8e2e3";

  const endpointMatch = APP_INSIGHTS_CONNECTION_STRING.match(/IngestionEndpoint=([^;]+)/);
  const baseEndpoint = endpointMatch
    ? endpointMatch[1].replace(/\/+$/, "")
    : "https://eastus-8.in.applicationinsights.azure.com";

  const payload = {
    name: "Microsoft.ApplicationInsights.Event",
    time: new Date().toISOString(),
    iKey,
    data: {
      baseType: "EventData",
      baseData: {
        ver: 2,
        name,
        properties: {
          ...properties,
          service: "scdi-dashboard-server",
        },
        measurements: measurements || {},
      },
    },
  };

  try {
    await fetch(`${baseEndpoint}/v2/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Non-blocking telemetry
  }
}
