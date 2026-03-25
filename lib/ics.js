/**
 * ICS / iCalendar generator for senderwolf
 * Generates RFC 5545-compliant iCalendar strings with zero dependencies.
 */

/**
 * Format a JS Date to iCalendar UTC date-time string: YYYYMMDDTHHmmssZ
 * @param {Date} date
 * @returns {string}
 */
export function formatICSDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Format a JS Date to iCalendar date-only string (all-day events): YYYYMMDD
 * @param {Date} date
 * @returns {string}
 */
function formatICSDateOnly(date) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * Fold long iCalendar lines to 75-octet limit per RFC 5545 §3.1
 * @param {string} line
 * @returns {string}
 */
function foldLine(line) {
    if (Buffer.byteLength(line, 'utf8') <= 75) {
        return line;
    }
    const parts = [];
    let current = '';
    for (const char of line) {
        if (Buffer.byteLength(current + char, 'utf8') > 75) {
            parts.push(current);
            current = ' ' + char;
        } else {
            current += char;
        }
    }
    if (current) parts.push(current);
    return parts.join('\r\n');
}

/**
 * Escape special characters in iCalendar text values per RFC 5545 §3.3.11
 * @param {string} value
 * @returns {string}
 */
function escapeText(value) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
}

/**
 * Generate a random UID for calendar events
 * @returns {string}
 */
function generateUID() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `${timestamp}-${random}@senderwolf`;
}

/**
 * Validate a calendar event object.
 * Throws a descriptive Error if required fields are missing or invalid.
 * @param {Object} event
 * @returns {true}
 */
export function validateCalendarEvent(event) {
    if (!event || typeof event !== 'object') {
        throw new Error('Calendar event must be a non-null object');
    }
    if (!event.summary || typeof event.summary !== 'string' || event.summary.trim() === '') {
        throw new Error('Calendar event requires a non-empty "summary" field');
    }
    if (!(event.start instanceof Date) || isNaN(event.start.getTime())) {
        throw new Error('Calendar event requires a valid "start" Date');
    }
    if (!(event.end instanceof Date) || isNaN(event.end.getTime())) {
        throw new Error('Calendar event requires a valid "end" Date');
    }
    if (event.end <= event.start && !event.allDay) {
        throw new Error('Calendar event "end" must be after "start"');
    }
    if (event.method && !['REQUEST', 'CANCEL', 'REPLY'].includes(event.method)) {
        throw new Error('Calendar event "method" must be REQUEST, CANCEL, or REPLY');
    }
    if (event.status && !['CONFIRMED', 'TENTATIVE', 'CANCELLED'].includes(event.status)) {
        throw new Error('Calendar event "status" must be CONFIRMED, TENTATIVE, or CANCELLED');
    }
    if (event.organizer) {
        if (!event.organizer.email) {
            throw new Error('Calendar event "organizer" must have an "email" field');
        }
    }
    if (event.attendees && !Array.isArray(event.attendees)) {
        throw new Error('Calendar event "attendees" must be an array');
    }
    if (event.attendees) {
        for (const attendee of event.attendees) {
            if (!attendee.email) {
                throw new Error('Each attendee must have an "email" field');
            }
        }
    }
    return true;
}

/**
 * Generate a complete RFC 5545 iCalendar string from an event object.
 *
 * @param {Object} event - Calendar event configuration
 * @param {string}  [event.uid]         - Unique event ID (auto-generated if omitted)
 * @param {string}   event.summary      - Event title (required)
 * @param {Date}     event.start        - Event start time (required)
 * @param {Date}     event.end          - Event end time (required)
 * @param {string}  [event.description] - Event description
 * @param {string}  [event.location]    - Event location
 * @param {string}  [event.url]         - Event URL
 * @param {{name?: string, email: string}} [event.organizer] - Organizer
 * @param {Array<{name?: string, email: string, rsvp?: boolean}>} [event.attendees]
 * @param {'REQUEST'|'CANCEL'|'REPLY'} [event.method='REQUEST'] - iTIP method
 * @param {'CONFIRMED'|'TENTATIVE'|'CANCELLED'} [event.status='CONFIRMED']
 * @param {boolean}  [event.allDay=false] - All-day event (date only, no time)
 * @param {string}  [event.recurrence]  - RRULE string (e.g. 'FREQ=WEEKLY;COUNT=4')
 * @param {{trigger: string, description?: string}} [event.alarm] - Reminder alarm
 * @param {number}  [event.sequence=0]  - Sequence number for updates
 * @returns {string} The iCalendar (.ics) string
 */
export function generateICS(event) {
    validateCalendarEvent(event);

    const uid = event.uid || generateUID();
    const method = event.method || 'REQUEST';
    const status = event.status || 'CONFIRMED';
    const sequence = typeof event.sequence === 'number' ? event.sequence : 0;
    const allDay = event.allDay === true;
    const now = formatICSDate(new Date());

    const lines = [];

    // Calendar wrapper
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//Senderwolf//EN');
    lines.push('CALSCALE:GREGORIAN');
    lines.push(`METHOD:${method}`);

    // Event
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);

    if (allDay) {
        lines.push(`DTSTART;VALUE=DATE:${formatICSDateOnly(event.start)}`);
        lines.push(`DTEND;VALUE=DATE:${formatICSDateOnly(event.end)}`);
    } else {
        lines.push(`DTSTART:${formatICSDate(event.start)}`);
        lines.push(`DTEND:${formatICSDate(event.end)}`);
    }

    lines.push(foldLine(`SUMMARY:${escapeText(event.summary)}`));
    lines.push(`STATUS:${status}`);
    lines.push(`SEQUENCE:${sequence}`);

    if (event.description) {
        lines.push(foldLine(`DESCRIPTION:${escapeText(event.description)}`));
    }

    if (event.location) {
        lines.push(foldLine(`LOCATION:${escapeText(event.location)}`));
    }

    if (event.url) {
        lines.push(foldLine(`URL:${event.url}`));
    }

    if (event.organizer) {
        const name = event.organizer.name ? `;CN=${escapeText(event.organizer.name)}` : '';
        lines.push(foldLine(`ORGANIZER${name}:mailto:${event.organizer.email}`));
    }

    if (event.attendees && event.attendees.length > 0) {
        for (const attendee of event.attendees) {
            const name = attendee.name ? `;CN=${escapeText(attendee.name)}` : '';
            const rsvp = attendee.rsvp !== false ? ';RSVP=TRUE' : ';RSVP=FALSE';
            const role = ';ROLE=REQ-PARTICIPANT';
            const partstat = ';PARTSTAT=NEEDS-ACTION';
            lines.push(foldLine(`ATTENDEE${name}${rsvp}${role}${partstat}:mailto:${attendee.email}`));
        }
    }

    if (event.recurrence) {
        lines.push(foldLine(`RRULE:${event.recurrence}`));
    }

    // VALARM sub-component
    if (event.alarm) {
        lines.push('BEGIN:VALARM');
        lines.push('ACTION:DISPLAY');
        lines.push(`TRIGGER:${event.alarm.trigger}`);
        lines.push(`DESCRIPTION:${escapeText(event.alarm.description || event.summary)}`);
        lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
    lines.push('END:VCALENDAR');

    return lines.join('\r\n') + '\r\n';
}
