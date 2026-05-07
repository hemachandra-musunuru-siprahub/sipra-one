export function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));
}

export function formatLeaveDates(startDate: string | null | undefined, endDate: string | null | undefined): string {
  if (!startDate || !endDate) return "";
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  
  if (start === end) {
    return start;
  }
  return `${start} - ${end}`;
}
