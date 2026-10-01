import type { Lang, Reminder } from "./types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Build an iCalendar file with an all-day event + 7-day-before alarm per dated reminder. */
export function remindersToIcs(reminders: Reminder[], lang: Lang): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const events = reminders
    .filter((r) => r.date)
    .map((r) => {
      const d = r.date!.replace(/-/g, "");
      const next = new Date(r.date + "T00:00:00Z");
      next.setUTCDate(next.getUTCDate() + 1);
      const end = next.toISOString().slice(0, 10).replace(/-/g, "");
      return [
        "BEGIN:VEVENT",
        `UID:${r.schemeId}-${d}@nagrikai`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${d}`,
        `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:${esc((lang === "hi" ? "अंतिम तिथि: " : "Deadline: ") + r.title[lang])}`,
        `DESCRIPTION:${esc(r.note[lang])}`,
        "BEGIN:VALARM",
        "TRIGGER:-P7D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${esc(r.title[lang])}`,
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NagrikAI//Reminders//EN", ...events, "END:VCALENDAR"].join("\r\n");
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
