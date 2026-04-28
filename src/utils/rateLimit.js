const STORAGE_KEY = "ocr_usage";

const LIMITS = {
  minute: { max: 2, windowMs: 60 * 1000 },
  week:   { max: 100, windowMs: 7 * 24 * 60 * 60 * 1000 },
};

const getUsage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveUsage = (usage) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
};

export const checkRateLimit = () => {
  const now = Date.now();
  const usage = getUsage();

  for (const [period, { max, windowMs }] of Object.entries(LIMITS)) {
    const { count = 0, resetAt = 0 } = usage[period] || {};
    const active = now < resetAt;
    const current = active ? count : 0;

    if (current >= max) {
      const remaining = resetAt - now;
      const timeLeft =
        period === "minute"
          ? `${Math.ceil(remaining / 1000)} segundos`
          : `${Math.ceil(remaining / (24 * 60 * 60 * 1000))} días`;
      const label = period === "minute" ? "minuto" : "semana";
      return {
        allowed: false,
        reason: `Límite de ${max} consultas por ${label} alcanzado. Reintentar en ${timeLeft}.`,
      };
    }
  }

  return { allowed: true, reason: "" };
};

export const incrementUsage = () => {
  const now = Date.now();
  const usage = getUsage();

  for (const [period, { windowMs }] of Object.entries(LIMITS)) {
    const { count = 0, resetAt = 0 } = usage[period] || {};
    const active = now < resetAt;
    usage[period] = {
      count: (active ? count : 0) + 1,
      resetAt: active ? resetAt : now + windowMs,
    };
  }

  saveUsage(usage);
};

export const getUsageStats = () => {
  const now = Date.now();
  const usage = getUsage();
  const stats = {};

  for (const [period, { max, windowMs }] of Object.entries(LIMITS)) {
    const { count = 0, resetAt = 0 } = usage[period] || {};
    const active = now < resetAt;
    stats[period] = {
      used: active ? count : 0,
      max,
      resetAt: active ? resetAt : now + windowMs,
    };
  }

  return stats;
};
