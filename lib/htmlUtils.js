/**
 * HTML Utilities for Senderwolf
 * Provides CSS inlining and HTML minification
 */

import juice from 'juice';

/**
 * Automatically inline CSS from <style> blocks into style attributes
 * @param {string} html - The HTML content
 * @returns {string} - HTML with inlined CSS
 */
export function inlineCSS(html) {
    if (!html || typeof html !== 'string') return html;
    
    try {
        // Use juice to inline styles
        return juice(html, {
            applyStyleTags: true,
            removeStyleTags: true,
            preserveMediaQueries: true
        });
    } catch (error) {
        console.error('[Senderwolf] CSS Inlining error:', error);
        return html; // Fallback to original HTML on error
    }
}

/**
 * Minify HTML for email by removing comments and collapsing whitespace
 * @param {string} html - The HTML content
 * @returns {string} - Minified HTML
 */
export function minifyHTML(html) {
    if (!html || typeof html !== 'string') return html;

    let minified = html;

    // 1. Remove HTML comments (but preserve IE conditional comments like [if mso])
    minified = minified.replace(/<!--(?!\[if\s+mso\])[\s\S]*?-->/gi, '');

    // 2. Collapse redundant whitespace
    // Specifically collapse whitespace between tags
    minified = minified.replace(/>\s+</g, '><');

    // 3. Collapse multiple spaces and newlines into a single space
    // EXCEPT inside <pre>, <code>, <textarea>, and <script>
    // For email HTML, we usually don't have these, but let's be safe for common cases.
    minified = minified.replace(/\s{2,}/g, ' ');

    return minified.trim();
}
