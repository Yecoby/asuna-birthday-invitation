import { event } from "@/lib/event";

const TIMER_SETTINGS_KEY = "iria-asuna-timer-settings";

export type TimerSettings = {
  enabled: boolean;
  customDateISO: string | null;
};

export function loadTimerSettings(): TimerSettings {
  if (typeof window === "undefined") {
    return { enabled: true, customDateISO: null };
  }
  try {
    const raw = window.localStorage.getItem(TIMER_SETTINGS_KEY);
    if (!raw) return { enabled: true, customDateISO: null };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled !== false,
      customDateISO: typeof parsed.customDateISO === "string" ? parsed.customDateISO : null,
    };
  } catch {
    return { enabled: true, customDateISO: null };
  }
}

export function saveTimerSettings(settings: Partial<TimerSettings>): TimerSettings {
  if (typeof window === "undefined") {
    return { enabled: true, customDateISO: null };
  }
  const current = loadTimerSettings();
  const next: TimerSettings = {
    ...current,
    ...settings,
  };
  window.localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function resetTimerSettings(): TimerSettings {
  if (typeof window === "undefined") {
    return { enabled: true, customDateISO: null };
  }
  window.localStorage.removeItem(TIMER_SETTINGS_KEY);
  return { enabled: true, customDateISO: null };
}

export function getEffectiveTargetDate(): string {
  const settings = loadTimerSettings();
  return settings.customDateISO || event.dateISO;
}

