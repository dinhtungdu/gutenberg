/**
 * HTML-to-Blocks converter.
 *
 * Takes raw HTML/CSS (as an agent would write) and converts it to
 * Gutenberg block markup, mapping CSS properties to block style attributes.
 */

import { parseHtml, resolveStyles } from './css-resolver.js';
import { convertChildren } from './element-mapper.js';
import { serializeBlocks } from './serializer.js';

export type { BlockNode } from './element-mapper.js';
export { serializeBlocks } from './serializer.js';

function parseAndConvert( html: string ) {
	const root = parseHtml( html, {
		comment: false,
		blockTextElements: {
			script: false,
			noscript: false,
			style: true,
			pre: true,
		},
	} );

	resolveStyles( root );
	return convertChildren( root );
}

/**
 * Convert raw HTML/CSS into serialized Gutenberg block markup.
 *
 * @param {string} html The raw HTML/CSS string to convert.
 */
export function convertHtmlToBlocks( html: string ): string {
	return serializeBlocks( parseAndConvert( html ) );
}

/**
 * Convert raw HTML/CSS into block definitions (JSON).
 * These can be passed directly to `wp.blocks.createBlock()` in the browser
 * for perfectly valid block insertion without serialization issues.
 *
 * @param {string} html The raw HTML/CSS string to convert.
 */
export function convertHtmlToBlockDefs( html: string ) {
	return parseAndConvert( html );
}
