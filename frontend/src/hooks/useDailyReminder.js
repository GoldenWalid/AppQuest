import { useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "hp_daily_reminder";

export function readReminder() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, time: "09:00" };
    return { enabled: false, time: "09:00", ...JSON.parse(raw) };
  } catch (_) {
    return { enabled: false, time: "09:00" };
  }
}

export function writeReminder(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function msUntilNext(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h || 0, m || 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

async function showSystemNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg && reg.showNotification) {
      reg.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "daily-quest",
        vibrate: [80, 40, 80],
      });
      return;
    }
  } catch (_) { /* fallback below */ }
  // fallback: regular notification
  new Notification(title, { body, icon: "/favicon.ico" });
}

export function useDailyReminder() {
  const timerRef = useRef(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    cancel();
    const cfg = readReminder();
    if (!cfg.enabled) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const delay = msUntilNext(cfg.time);
    timerRef.current = setTimeout(async () => {
      await showSystemNotification(
        "[ SYSTEM // QUÊTE DU JOUR ]",
        `Hunter, ta quête du jour t'attend. Ouvre le SYSTEM.`
      );
      // reschedule for next day
      schedule();
    }, delay);
  }, [cancel]);

  useEffect(() => {
    schedule();
    // re-schedule when tab becomes visible (in case timer drifted while sleeping)
    const onVis = () => {
      if (document.visibilityState === "visible") schedule();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancel();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [schedule, cancel]);

  return { schedule, cancel, showSystemNotification };
}
