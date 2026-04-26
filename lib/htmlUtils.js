/**
 * HTML Utilities for Senderwolf
 * Provides CSS inlining and HTML minification
 */

import juice from 'juice';
import { logger } from './logger.js';

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
        logger.error('[Senderwolf] CSS Inlining error:', error);
        return html; // Fallback to original HTML on error
    }
}

/**
 * Minify HTML for email by removing comments and collapsing whitespace.
 * Preserves content inside <pre>, <code>, <textarea>, and <script> tags.
 * @param {string} html - The HTML content
 * @returns {string} - Minified HTML
 */
export function minifyHTML(html) {
    if (!html || typeof html !== 'string') return html;

    // Extract and preserve content inside pre-formatted tags
    const preserved = [];
    const PRESERVE_TAGS = /(<(?:pre|code|textarea|script)\b[^>]*>)([\s\S]*?)(<\/(?:pre|code|textarea|script)>)/gi;

    let minified = html.replace(PRESERVE_TAGS, (match, openTag, content, closeTag) => {
        const placeholder = `__SENDERWOLF_PRESERVE_${preserved.length}__`;
        preserved.push({ placeholder, openTag, content, closeTag });
        return placeholder;
    });

    // 1. Remove HTML comments (but preserve IE conditional comments like [if mso])
    minified = minified.replace(/<!--(?!\[if\s+mso\])[\s\S]*?-->/gi, '');

    // 2. Collapse redundant whitespace between tags
    minified = minified.replace(/>\s+</g, '><');

    // 3. Collapse multiple spaces and newlines into a single space
    minified = minified.replace(/\s{2,}/g, ' ');

    // Restore preserved content
    for (const { placeholder, openTag, content, closeTag } of preserved) {
        minified = minified.replace(placeholder, openTag + content + closeTag);
    }

    return minified.trim();
}
