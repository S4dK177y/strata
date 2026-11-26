import { userAgentFromString } from "next/server";
import type { SessionDeviceType } from "@strata/api-contract";

export interface ParsedSessionUserAgent {
  device_type: SessionDeviceType;
  device_label: string;
  browser: string | null;
  os: string | null;
}

export function parseSessionUserAgent(rawUa: string | null | undefined): ParsedSessionUserAgent {
  const ua = rawUa?.trim();
  if (!ua) {
    return {
      device_type: "unknown",
      device_label: "Unknown device",
      browser: null,
      os: null,
    };
  }

  // Native Android client convention: e.g. "StrataAndroid/1.0 (Android 14; Pixel 8)" or OkHttp
  if (/strataandroid/i.test(ua)) {
    const versionMatch = /StrataAndroid\/([^\s;()]+)/i.exec(ua);
    const androidMatch = /Android\s+([0-9.]+)/i.exec(ua);
    const browser = versionMatch?.[1] ? `Strata Android ${versionMatch[1]}` : "Strata Android";
    const os = androidMatch?.[1] ? `Android ${androidMatch[1]}` : "Android";
    return {
      device_type: "mobile",
      device_label: `${browser} · ${os}`,
      browser,
      os,
    };
  }

  if (/okhttp/i.test(ua)) {
    return {
      device_type: "mobile",
      device_label: "Android App",
      browser: "OkHttp",
      os: "Android",
    };
  }

  const parsed = userAgentFromString(ua);
  const rawDeviceType = parsed.device.type;

  let deviceType: SessionDeviceType = "desktop";
  if (parsed.isBot) {
    deviceType = "bot";
  } else if (rawDeviceType === "mobile" || rawDeviceType === "wearable") {
    deviceType = "mobile";
  } else if (rawDeviceType === "tablet") {
    deviceType = "tablet";
  } else if (!parsed.browser.name && !parsed.os.name) {
    deviceType = "unknown";
  }

  const browserName = parsed.browser.name?.trim() || null;
  const browserMajor = parsed.browser.major?.trim() || null;
  const browser = browserName ? (browserMajor ? `${browserName} ${browserMajor}` : browserName) : null;

  const osName = parsed.os.name?.trim() || null;
  const osVersion = parsed.os.version?.trim() || null;
  const os = osName ? (osVersion && (osName === "iOS" || osName === "Android") ? `${osName} ${osVersion}` : osName) : null;

  const deviceModel =
    parsed.device.vendor && parsed.device.model
      ? `${parsed.device.vendor} ${parsed.device.model}`.trim()
      : parsed.device.model?.trim() || null;

  let deviceLabel = "Unknown device";
  if (browser && os) {
    deviceLabel = `${browser} · ${os}`;
  } else if (browser) {
    deviceLabel = browser;
  } else if (os) {
    deviceLabel = deviceModel ? `${deviceModel} · ${os}` : os;
  } else if (deviceModel) {
    deviceLabel = deviceModel;
  }

  return {
    device_type: deviceType,
    device_label: deviceLabel,
    browser,
    os,
  };
}
