const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function toArgentinaTimestamp(localDateTime: string) {
  return new Date(`${localDateTime}:00-03:00`).toISOString();
}

export function toArgentinaDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function formatArgentinaDate(value: string | null | undefined, withTime = false) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ARGENTINA_TIME_ZONE,
    dateStyle: "long",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}
