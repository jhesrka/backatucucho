
export class DateUtils {
    /**
     * Parses a date string (YYYY-MM-DD) and returns a Date object 
     * representing the START of that day in Ecuador (America/Guayaquil, UTC-5),
     * expressed in UTC time.
     * Example: "2026-03-19" -> 2026-03-19 05:00:00 UTC
     */
    static parseLocalDate(dateInput: string | Date): Date {
        if (dateInput instanceof Date) return new Date(dateInput);
        
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            const [year, month, day] = dateInput.split('-').map(Number);
            // 00:00 in Ecuador is 05:00 in UTC
            return new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
        }
        return new Date(dateInput);
    }

    /**
     * Returns start and end of day in UTC that corresponds to the 
     * full 24 hours of that day in Ecuador.
     * Example: "2026-03-19" 
     * -> start: 2026-03-19 05:00:00 UTC
     * -> end:   2026-03-20 04:59:59.999 UTC
     */
    static getDayRange(dateInput: string | Date) {
        const start = this.parseLocalDate(dateInput);
        
        const end = new Date(start.getTime());
        end.setUTCHours(end.getUTCHours() + 23);
        end.setUTCMinutes(59);
        end.setUTCSeconds(59);
        end.setUTCMilliseconds(999);
        
        return { start, end };
    }

    /**
     * Returns a YYYY-MM-DD string according to America/Guayaquil time.
     */
    static toLocalDateString(date: Date): string {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Guayaquil",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(date);
    }
}
