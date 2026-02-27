/**
 * Zero-dependency HTML to plain-text converter for Senderwolf
 * Converts HTML email content into readable plain text
 */

/**
 * Convert HTML string to plain text
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
export function htmlToText(html) {
    if (!html || typeof html !== 'string') return '';

    let text = html;

    // Replace <br>, <br/>, <br /> with newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Replace block-level closing tags with double newlines
    text = text.replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article|header|footer|main|aside|nav)>/gi, '\n\n');

    // Replace <li> with "- "
    text = text.replace(/<li[^>]*>/gi, '- ');

    // Replace <hr> with a separator
    text = text.replace(/<hr\s*\/?>/gi, '\n---\n');

    // Extract href from <a> tags: "link text (url)"
    text = text.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, linkText) => {
        const cleanText = linkText.replace(/<[^>]+>/g, '').trim();
        if (!cleanText || cleanText === href) return href;
        return `${cleanText} (${href})`;
    });

    // Extract alt text from <img> tags
    text = text.replace(/<img[^>]+alt="([^"]*)"[^>]*>/gi, '[$1]');
    text = text.replace(/<img[^>]*>/gi, '');

    // Strip all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode common HTML entities
    text = text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&rsquo;/gi, "'")
        .replace(/&lsquo;/gi, "'")
        .replace(/&rdquo;/gi, '"')
        .replace(/&ldquo;/gi, '"')
        .replace(/&mdash;/gi, '—')
        .replace(/&ndash;/gi, '–')
        .replace(/&bull;/gi, '•')
        .replace(/&hellip;/gi, '…')
        .replace(/&copy;/gi, '©')
        .replace(/&reg;/gi, '®')
        .replace(/&trade;/gi, '™')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

    // Collapse multiple blank lines into at most two newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    // Collapse multiple spaces (but not newlines) into one
    text = text.replace(/[^\S\n]+/g, ' ');

    // Trim each line
    text = text.split('\n').map(line => line.trim()).join('\n');

    return text.trim();
}
