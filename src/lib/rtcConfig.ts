export interface RtcServerConfig {
  iceServers: RTCIceServer[];
  turnConfigured: boolean;
  hlsUrl: string | null;
  build: string;
}

const DEFAULT_RTC_CONFIG: RtcServerConfig = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
  turnConfigured: false,
  hlsUrl: null,
  build: 'official-stlive-2026',
};

let cachedConfig: RtcServerConfig | null = null;

export async function fetchRtcConfig(): Promise<RtcServerConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch('/api/config/rtc');
    if (res.ok) {
      const data = (await res.json()) as Partial<RtcServerConfig>;
      cachedConfig = {
        iceServers: Array.isArray(data.iceServers) && data.iceServers.length > 0
          ? data.iceServers
          : DEFAULT_RTC_CONFIG.iceServers,
        turnConfigured: Boolean(data.turnConfigured),
        hlsUrl: typeof data.hlsUrl === 'string' && data.hlsUrl ? data.hlsUrl : null,
        build: typeof data.build === 'string' ? data.build : DEFAULT_RTC_CONFIG.build,
      };
      return cachedConfig;
    }
  } catch {
    // offline fallback to public STUN
  }
  return DEFAULT_RTC_CONFIG;
}
