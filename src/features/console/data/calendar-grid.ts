/** Australian field-ops calendar: weeks start Monday. */

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function mondayLeadingBlanks(year: number, monthIndex: number): number {
  return (new Date(year, monthIndex, 1).getDay() + 6) % 7;
}

export function monthCells(
  year: number,
  monthIndex: number,
): Array<number | null> {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leading = mondayLeadingBlanks(year, monthIndex);
  const cellCount = Math.ceil((leading + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - leading + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });
}

export function padMonthDay(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
