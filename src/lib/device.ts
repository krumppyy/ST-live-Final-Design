import type { CutoutProfile, DeviceInfo } from '../types';

export function detectDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      os: 'Unknown',
      formFactor: 'desktop',
      isTouch: false,
      suggestedCutout: 'flat',
      screenWidth: 1440,
      screenHeight: 900,
    };
  }

  const ua = navigator.userAgent || '';
  const platform = (navigator.platform || '').toLowerCase();
  const maxTouch = navigator.maxTouchPoints || 0;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isTouch = maxTouch > 0 || window.matchMedia('(pointer: coarse)').matches;

  let os: DeviceInfo['os'] = 'Unknown';
  if (/iphone|ipod/i.test(ua)) {
    os = 'iOS';
  } else if (/ipad/i.test(ua) || (platform.includes('mac') && maxTouch > 1)) {
    os = 'iPadOS';
  } else if (/android/i.test(ua)) {
    os = 'Android';
  } else if (/cros/i.test(ua)) {
    os = 'ChromeOS';
  } else if (/mac os x|macintosh/i.test(ua)) {
    os = 'macOS';
  } else if (/windows/i.test(ua)) {
    os = 'Windows';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  let formFactor: DeviceInfo['formFactor'] = 'desktop';
  if (os === 'iOS' || (os === 'Android' && Math.min(w, h) < 640) || w < 640) {
    formFactor = 'mobile';
  } else if (os === 'iPadOS' || (isTouch && w >= 640 && w <= 1180)) {
    formFactor = 'tablet';
  }

  // Heuristic for modern punch-hole / Dynamic Island / curved-edge hardware
  let suggestedCutout: Exclude<CutoutProfile, 'auto'> = 'flat';
  const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
  if (os === 'iOS' && aspect >= 2.0) {
    suggestedCutout = 'dynamic_island';
  } else if (os === 'Android' && formFactor === 'mobile') {
    suggestedCutout = aspect >= 2.05 ? 'punch_center' : 'punch_left';
  } else if (formFactor === 'tablet') {
    suggestedCutout = 'curved_tablet';
  }

  return {
    os,
    formFactor,
    isTouch,
    suggestedCutout,
    screenWidth: w,
    screenHeight: h,
  };
}
