export interface ReportScheduleRule {
  days: number[];
  start: string;
  end: string;
  enabled?: boolean;
}

export interface ReportScheduleConfig {
  enabled?: boolean;
  rules?: ReportScheduleRule[];
}

export const DEFAULT_DAILY_REPORT_SCHEDULE_RULES: ReportScheduleRule[] = [
  { days: [1], start: "17:55", end: "19:00", enabled: true },
  { days: [2], start: "17:55", end: "19:00", enabled: true },
  { days: [3], start: "17:55", end: "19:00", enabled: true },
  { days: [4], start: "17:55", end: "19:00", enabled: true },
  { days: [5], start: "17:55", end: "19:00", enabled: true },
  { days: [6], start: "12:55", end: "14:00", enabled: true },
  { days: [0], start: "12:55", end: "14:00", enabled: false },
];

export const DAY_LABELS: Record<number, string> = {
  0: "domingo",
  1: "lunes",
  2: "martes",
  3: "miercoles",
  4: "jueves",
  5: "viernes",
  6: "sabado",
};

const toMinutes = (value: string) => {
  const [hours, minutes] = `${value || ""}`.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

export const normalizeReportScheduleRules = (
  raw: unknown,
  fallback: ReportScheduleRule[] = DEFAULT_DAILY_REPORT_SCHEDULE_RULES
): ReportScheduleRule[] => {
  if (!Array.isArray(raw)) return fallback;
  const rules = raw
    .map((item: any) => ({
      days: Array.isArray(item?.days)
        ? item.days.map((day: unknown) => Number(day)).filter((day: number) => Number.isInteger(day) && day >= 0 && day <= 6)
        : [],
      start: typeof item?.start === "string" && item.start ? item.start : "00:00",
      end: typeof item?.end === "string" && item.end ? item.end : "23:59",
      enabled: item?.enabled !== false,
    }))
    .filter((item) => item.days.length && toMinutes(item.start) !== null && toMinutes(item.end) !== null);

  return rules.length ? rules : fallback;
};

export const expandReportScheduleRulesByDay = (raw: unknown) => {
  const rules = normalizeReportScheduleRules(raw);
  return DEFAULT_DAILY_REPORT_SCHEDULE_RULES.map((defaultRule) => {
    const day = defaultRule.days[0];
    const matchingRule = rules.find((rule) => rule.days.includes(day));
    return matchingRule
      ? { days: [day], start: matchingRule.start, end: matchingRule.end, enabled: matchingRule.enabled !== false }
      : defaultRule;
  });
};

export const getReportConfig = (reportesConfig: unknown, tipo: string) => {
  const reportes = (reportesConfig as any)?.reportes;
  return Array.isArray(reportes) ? reportes.find((item) => item?.tipo === tipo) : undefined;
};

export const getReportSchedule = (reportesConfig: unknown, tipo: string): ReportScheduleConfig => {
  const reportConfig = getReportConfig(reportesConfig, tipo);
  const schedule = reportConfig?.schedule;
  if (!schedule || typeof schedule !== "object") return { enabled: false, rules: DEFAULT_DAILY_REPORT_SCHEDULE_RULES };

  return {
    enabled: Boolean(schedule.enabled),
    rules: normalizeReportScheduleRules(schedule.rules),
  };
};

export const isReportScheduleOpen = (schedule: ReportScheduleConfig, date = new Date()) => {
  if (!schedule.enabled) return true;
  const day = date.getDay();
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  return normalizeReportScheduleRules(schedule.rules).some((rule) => {
    const start = toMinutes(rule.start);
    const end = toMinutes(rule.end);
    if (rule.enabled === false || start === null || end === null || !rule.days.includes(day)) return false;
    if (start <= end) return currentMinutes >= start && currentMinutes <= end;
    return currentMinutes >= start || currentMinutes <= end;
  });
};

const formatDayRange = (days: number[]) => {
  const normalized = Array.from(new Set(days)).sort((a, b) => a - b);
  const weekdays = [1, 2, 3, 4, 5];
  if (weekdays.every((day) => normalized.includes(day)) && normalized.length === weekdays.length) {
    return "lunes a viernes";
  }
  return normalized.map((day) => DAY_LABELS[day] || `dia ${day}`).join(", ");
};

export const formatReportSchedule = (schedule: ReportScheduleConfig) => {
  const enabledRules = normalizeReportScheduleRules(schedule.rules).filter((rule) => rule.enabled !== false);
  return enabledRules.length
    ? enabledRules.map((rule) => `${formatDayRange(rule.days)} de ${rule.start} a ${rule.end}`).join("; ")
    : "sin horarios habilitados";
};

export const formatReportScheduleForDay = (schedule: ReportScheduleConfig, date = new Date()) => {
  const day = date.getDay();
  const rulesForDay = normalizeReportScheduleRules(schedule.rules).filter(
    (rule) => rule.enabled !== false && rule.days.includes(day)
  );

  return rulesForDay.length
    ? rulesForDay.map((rule) => `${DAY_LABELS[day] || `dia ${day}`} de ${rule.start} a ${rule.end}`).join("; ")
    : `${DAY_LABELS[day] || `dia ${day}`} sin horario habilitado`;
};
