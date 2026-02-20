/**
 * exportCSV — Generate and download focus history as CSV file.
 *
 * Columns: Date, Minutes, Hours, Sessions (if available)
 * Sorted by date descending (newest first).
 */

export function exportFocusCSV(
    focusHistory: Record<string, number>,
    hourlyHistory: Record<string, number>,
    filename = 'amo-focus-history.csv'
): void {
    // Build rows from focusHistory
    const rows = Object.entries(focusHistory)
        .sort(([a], [b]) => b.localeCompare(a)) // newest first
        .map(([date, minutes]) => ({
            date,
            minutes,
            hours: (minutes / 60).toFixed(1),
        }));

    if (rows.length === 0) {
        alert('No focus data to export.');
        return;
    }

    // CSV header
    const header = 'Date,Focus Minutes,Focus Hours';
    const csvRows = rows.map(r => `${r.date},${r.minutes},${r.hours}`);
    const csvContent = [header, ...csvRows].join('\n');

    // Peak hours appendix
    const hourEntries = Object.entries(hourlyHistory)
        .sort(([, a], [, b]) => (b as number) - (a as number));

    let appendix = '';
    if (hourEntries.length > 0) {
        appendix = '\n\nPeak Hours Summary\nHour,Session Count';
        for (const [hour, count] of hourEntries) {
            appendix += `\n${hour}:00,${count}`;
        }
    }

    // Summary row
    const totalMinutes = rows.reduce((s, r) => s + r.minutes, 0);
    const totalDays = rows.length;
    const avgMinutes = Math.round(totalMinutes / totalDays);
    const summary = `\n\nSummary\nTotal Days,${totalDays}\nTotal Minutes,${totalMinutes}\nTotal Hours,${(totalMinutes / 60).toFixed(1)}\nAverage Per Day,${avgMinutes} min`;

    const fullCSV = csvContent + summary + appendix;

    // Trigger download
    const blob = new Blob([fullCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
