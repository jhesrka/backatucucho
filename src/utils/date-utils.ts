
export class DateUtils {
    /**
     * Parses a date string (YYYY-MM-DD or ISO) into a local Date object in America/Guayaquil.
     * Prevents the -5h offset issue when parsing strings like "2026-03-12" which default to UTC.
     */
    static parseLocalDate(dateInput: string | Date): Date {
        if (dateInput instanceof Date) return new Date(dateInput);
        
        // If it's a simple YYYY-MM-DD string
        if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
            const [year, month, day] = dateInput.split('-').map(Number);
            // new Date(year, monthIndex, day) uses local time
            return new Date(year, month - 1, day);
        }
        
        // Fallback for other strings
        const date = new Date(dateInput);
        
        // If the date is valid and appears to be UTC midnight but we are in Ecuador (TZ -5)
        // we might want to check the parsing logic. 
        // But the split logic above covers 90% of our cases.
        
        return date;
    }

    /**
     * Returns start and end of day in local time.
     */
    static getDayRange(dateInput: string | Date) {
        const date = this.parseLocalDate(dateInput);
        
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        
        return { start, end };
    }

    /**
     * Returns a YYYY-MM-DD string according to local time.
     */
    static toLocalDateString(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
