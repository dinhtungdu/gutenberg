/**
 * Serializes a block tree into WordPress block markup with comment delimiters.
 */

import type { BlockNode } from './element-mapper.js';

/**
 * Blocks that are self-closing (no inner content).
 */
const SELF_CLOSING_BLOCKS = new Set( [
	'core/separator',
	'core/spacer',
	'core/nextpage',
	'core/more',
] );

function serializeAttrs( attributes: Record< string, unknown > ): string {
	// Filter out content/innerHtml — these go in the HTML, not the comment
	const commentAttrs: Record< string, unknown > = {};
	for ( const [ key, value ] of Object.entries( attributes ) ) {
		// Skip attributes that are serialized as HTML content
		if ( key === 'content' && typeof value === 'string' ) {
			continue;
		}
		// Skip empty objects
		if (
			typeof value === 'object' &&
			value !== null &&
			Object.keys( value ).length === 0
		) {
			continue;
		}
		commentAttrs[ key ] = value;
	}

	if ( Object.keys( commentAttrs ).length === 0 ) {
		return '';
	}

	return ' ' + JSON.stringify( commentAttrs );
}

function renderBlockHtml( block: BlockNode, innerContent: string ): string {
	const { name, attributes } = block;

	switch ( name ) {
		case 'core/paragraph':
			return `<p>${ attributes.content || '' }</p>`;

		case 'core/heading': {
			const level = ( attributes.level as number ) || 2;
			return `<h${ level }>${ attributes.content || '' }</h${ level }>`;
		}

		case 'core/image': {
			const url = ( attributes.url as string ) || '';
			const alt = ( attributes.alt as string ) || '';
			const caption = attributes.caption as string | undefined;
			let imgTag = `<img src="${ url }" alt="${ alt }"`;
			if ( attributes.width ) {
				imgTag += ` width="${ attributes.width }"`;
			}
			if ( attributes.height ) {
				imgTag += ` height="${ attributes.height }"`;
			}
			imgTag += ' />';
			let figureContent = imgTag;
			if ( caption ) {
				figureContent += `<figcaption class="wp-element-caption">${ caption }</figcaption>`;
			}
			return `<figure class="wp-block-image">${ figureContent }</figure>`;
		}

		case 'core/list': {
			const tag = attributes.ordered ? 'ol' : 'ul';
			return `<${ tag }>${ innerContent }</${ tag }>`;
		}

		case 'core/list-item':
			return `<li>${ attributes.content || '' }</li>`;

		case 'core/buttons':
			return `<div class="wp-block-buttons">${ innerContent }</div>`;

		case 'core/button': {
			const text = ( attributes.text as string ) || '';
			const url = attributes.url as string | undefined;
			const linkTag = url
				? `<a class="wp-block-button__link wp-element-button" href="${ url }">${ text }</a>`
				: `<span class="wp-block-button__link wp-element-button">${ text }</span>`;
			return `<div class="wp-block-button">${ linkTag }</div>`;
		}

		case 'core/group': {
			const tagName = ( attributes.tagName as string ) || 'div';
			return `<${ tagName } class="wp-block-group">${ innerContent }</${ tagName }>`;
		}

		case 'core/columns':
			return `<div class="wp-block-columns">${ innerContent }</div>`;

		case 'core/column':
			return `<div class="wp-block-column">${ innerContent }</div>`;

		case 'core/quote':
			return `<blockquote class="wp-block-quote">${ innerContent }</blockquote>`;

		case 'core/separator':
			return '';

		case 'core/html':
			return ( attributes.content as string ) || '';

		default:
			return innerContent || '';
	}
}

function serializeBlock( block: BlockNode, indent: string = '' ): string {
	const { name, innerBlocks } = block;

	// Self-closing blocks
	if ( SELF_CLOSING_BLOCKS.has( name ) ) {
		const attrs = serializeAttrs( block.attributes );
		return `${ indent }<!-- wp:${ name.replace(
			'core/',
			''
		) }${ attrs } /-->`;
	}

	// Serialize inner blocks first
	let innerContent = '';
	if ( innerBlocks && innerBlocks.length > 0 ) {
		innerContent =
			'\n' +
			innerBlocks
				.map( ( child ) => serializeBlock( child, indent ) )
				.join( '\n\n' ) +
			'\n';
	}

	const attrs = serializeAttrs( block.attributes );
	const blockName = name.replace( 'core/', '' );
	const html = renderBlockHtml( block, innerContent );

	return `${ indent }<!-- wp:${ blockName }${ attrs } -->\n${ html }\n<!-- /wp:${ blockName } -->`;
}

/**
 * Serialize an array of blocks to WordPress block markup.
 *
 * @param {BlockNode[]} blocks The blocks to serialize.
 */
export function serializeBlocks( blocks: BlockNode[] ): string {
	return blocks.map( ( block ) => serializeBlock( block ) ).join( '\n\n' );
}
