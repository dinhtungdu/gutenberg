/**
 * Maps HTML elements to Gutenberg block types with attributes.
 */

import type { HTMLElement, Node } from 'node-html-parser';
import { NodeType } from 'node-html-parser';
import { mapStylesToBlockAttrs, parseInlineStyle } from './style-mapper.js';

export interface BlockNode {
	name: string;
	attributes: Record< string, unknown >;
	innerHtml?: string;
	innerBlocks?: BlockNode[];
}

/**
 * Inline elements that should be preserved as HTML content inside their parent block.
 */
const INLINE_ELEMENTS = new Set( [
	'a',
	'abbr',
	'b',
	'bdi',
	'bdo',
	'br',
	'cite',
	'code',
	'data',
	'dfn',
	'em',
	'i',
	'kbd',
	'mark',
	'q',
	'rp',
	'rt',
	'ruby',
	's',
	'samp',
	'small',
	'span',
	'strong',
	'sub',
	'sup',
	'time',
	'u',
	'var',
	'wbr',
] );

/**
 * Container elements that map to core/group.
 */
const CONTAINER_ELEMENTS = new Set( [
	'div',
	'section',
	'main',
	'article',
	'aside',
	'header',
	'footer',
	'nav',
] );

function isTextNode( node: Node ): boolean {
	return node.nodeType === NodeType.TEXT_NODE;
}

function isElement( node: Node ): node is HTMLElement {
	return node.nodeType === NodeType.ELEMENT_NODE;
}

function tag( el: HTMLElement ): string {
	return ( el.tagName || '' ).toLowerCase();
}

function getStyles( el: HTMLElement ): Record< string, string > {
	return parseInlineStyle( el.getAttribute( 'style' ) || '' );
}

function isButtonLike( el: HTMLElement ): boolean {
	const styles = getStyles( el );
	const hasBg = !! styles[ 'background-color' ] || !! styles.background;
	const hasPadding = !! styles.padding || !! styles[ 'padding-top' ];
	const hasDisplay =
		styles.display === 'inline-block' || styles.display === 'inline-flex';
	const hasBorderRadius = !! styles[ 'border-radius' ];
	return (
		( hasBg && hasPadding ) || ( hasBg && hasBorderRadius ) || hasDisplay
	);
}

function getInnerContent( el: HTMLElement ): string {
	return el.innerHTML.trim();
}

/**
 * Recursively convert child nodes of a container element into blocks.
 *
 * @param {HTMLElement} parent The parent element whose children to convert.
 */
export function convertChildren( parent: HTMLElement ): BlockNode[] {
	const blocks: BlockNode[] = [];
	let textAccum = '';

	function flushText() {
		const trimmed = textAccum.trim();
		if ( trimmed ) {
			blocks.push( {
				name: 'core/paragraph',
				attributes: { content: trimmed },
			} );
		}
		textAccum = '';
	}

	for ( const child of parent.childNodes ) {
		if ( isTextNode( child ) ) {
			const text = child.text || '';
			if ( text.trim() ) {
				textAccum += text;
			}
			continue;
		}

		if ( ! isElement( child ) ) {
			continue;
		}

		const t = tag( child );

		// Button-like links and <button> elements should be blocks, not inline
		if ( ( t === 'a' && isButtonLike( child ) ) || t === 'button' ) {
			flushText();
			const block = mapElementToBlock( child );
			if ( block ) {
				blocks.push( block );
			}
			continue;
		}

		// Inline elements accumulate into a paragraph
		if ( INLINE_ELEMENTS.has( t ) ) {
			textAccum += child.outerHTML;
			continue;
		}

		// Flush any accumulated text before a block-level element
		flushText();

		const block = mapElementToBlock( child );
		if ( block ) {
			blocks.push( block );
		}
	}

	flushText();
	return blocks;
}

/**
 * Map a single HTML element to a BlockNode.
 *
 * @param {HTMLElement} el The HTML element to map.
 */
export function mapElementToBlock( el: HTMLElement ): BlockNode | null {
	const t = tag( el );
	const styles = getStyles( el );
	const mapped = mapStylesToBlockAttrs( styles );

	switch ( t ) {
		case 'h1':
		case 'h2':
		case 'h3':
		case 'h4':
		case 'h5':
		case 'h6': {
			const level = parseInt( t[ 1 ], 10 );
			return {
				name: 'core/heading',
				attributes: {
					level,
					content: getInnerContent( el ),
					...( mapped.style ? { style: mapped.style } : {} ),
				},
			};
		}

		case 'p':
			return {
				name: 'core/paragraph',
				attributes: {
					content: getInnerContent( el ),
					...( mapped.style ? { style: mapped.style } : {} ),
				},
			};

		case 'img':
			return {
				name: 'core/image',
				attributes: {
					url: el.getAttribute( 'src' ) || '',
					alt: el.getAttribute( 'alt' ) || '',
					...( el.getAttribute( 'width' )
						? { width: parseInt( el.getAttribute( 'width' )!, 10 ) }
						: {} ),
					...( el.getAttribute( 'height' )
						? {
								height: parseInt(
									el.getAttribute( 'height' )!,
									10
								),
						  }
						: {} ),
					...( mapped.style ? { style: mapped.style } : {} ),
				},
			};

		case 'figure': {
			// Check if it contains an img
			const img = el.querySelector( 'img' );
			if ( img ) {
				const figcaption = el.querySelector( 'figcaption' );
				return {
					name: 'core/image',
					attributes: {
						url: img.getAttribute( 'src' ) || '',
						alt: img.getAttribute( 'alt' ) || '',
						...( figcaption
							? { caption: figcaption.innerHTML.trim() }
							: {} ),
						...( mapped.style ? { style: mapped.style } : {} ),
					},
				};
			}
			// Fallback: treat as group
			return mapContainer( el, styles, mapped );
		}

		case 'ul':
		case 'ol': {
			const listItems = el.querySelectorAll( 'li' );
			const innerBlocks: BlockNode[] = [];
			for ( const li of listItems ) {
				innerBlocks.push( {
					name: 'core/list-item',
					attributes: {
						content: ( li as HTMLElement ).innerHTML.trim(),
					},
				} );
			}
			return {
				name: 'core/list',
				attributes: {
					ordered: t === 'ol',
					...( mapped.style ? { style: mapped.style } : {} ),
				},
				innerBlocks,
			};
		}

		case 'a': {
			if ( isButtonLike( el ) ) {
				const buttonMapped = mapStylesToBlockAttrs( styles );
				return {
					name: 'core/buttons',
					attributes: {},
					innerBlocks: [
						{
							name: 'core/button',
							attributes: {
								text: el.textContent?.trim() || '',
								url: el.getAttribute( 'href' ) || '',
								...( buttonMapped.style
									? { style: buttonMapped.style }
									: {} ),
							},
						},
					],
				};
			}
			// Non-button links: wrap in paragraph
			return {
				name: 'core/paragraph',
				attributes: { content: el.outerHTML },
			};
		}

		case 'button': {
			return {
				name: 'core/buttons',
				attributes: {},
				innerBlocks: [
					{
						name: 'core/button',
						attributes: {
							text: el.textContent?.trim() || '',
							...( mapped.style ? { style: mapped.style } : {} ),
						},
					},
				],
			};
		}

		case 'hr':
			return {
				name: 'core/separator',
				attributes: {
					...( mapped.style ? { style: mapped.style } : {} ),
				},
			};

		case 'blockquote':
			return {
				name: 'core/quote',
				attributes: {
					...( mapped.style ? { style: mapped.style } : {} ),
				},
				innerBlocks: convertChildren( el ),
			};

		default:
			if ( CONTAINER_ELEMENTS.has( t ) ) {
				return mapContainer( el, styles, mapped );
			}
			// Unknown element: wrap as HTML block
			return {
				name: 'core/html',
				attributes: { content: el.outerHTML },
			};
	}
}

function mapContainer(
	el: HTMLElement,
	styles: Record< string, string >,
	mapped: ReturnType< typeof mapStylesToBlockAttrs >
): BlockNode {
	const t = tag( el );
	const attrs: Record< string, unknown > = {};

	// Set tagName for non-div elements
	if ( t !== 'div' ) {
		attrs.tagName = t;
	}

	// Apply layout
	if ( mapped.layout && Object.keys( mapped.layout ).length > 0 ) {
		attrs.layout = mapped.layout;
	} else {
		// Default to constrained layout
		attrs.layout = { type: 'constrained' };
	}

	// Apply styles
	if ( mapped.style ) {
		attrs.style = mapped.style;
	}

	// Check for columns pattern: flex container with multiple children that
	// have explicit widths
	if (
		styles.display === 'flex' &&
		styles[ 'flex-direction' ] !== 'column'
	) {
		const children = el.childNodes.filter( ( n ) =>
			isElement( n )
		) as HTMLElement[];
		if ( children.length >= 2 && children.length <= 6 ) {
			const allHaveWidth = children.every( ( child ) => {
				const childStyles = getStyles( child );
				return (
					!! childStyles.width ||
					!! childStyles.flex ||
					!! childStyles[ 'flex-basis' ]
				);
			} );

			if ( allHaveWidth ) {
				return mapToColumns( el, children, mapped );
			}
		}
	}

	return {
		name: 'core/group',
		attributes: attrs,
		innerBlocks: convertChildren( el ),
	};
}

function mapToColumns(
	_parent: HTMLElement,
	children: HTMLElement[],
	mapped: ReturnType< typeof mapStylesToBlockAttrs >
): BlockNode {
	const columns: BlockNode[] = children.map( ( child ) => {
		const childStyles = getStyles( child );
		const width =
			childStyles.width || childStyles[ 'flex-basis' ] || undefined;
		const childMapped = mapStylesToBlockAttrs( childStyles );

		// Strip dimensions.width from column style — the column `width`
		// attribute handles this via flex-basis. Keeping both causes issues.
		if ( childMapped.style?.dimensions ) {
			const dims = childMapped.style.dimensions as Record<
				string,
				unknown
			>;
			delete dims.width;
			if ( Object.keys( dims ).length === 0 ) {
				delete childMapped.style.dimensions;
			}
			if ( Object.keys( childMapped.style ).length === 0 ) {
				delete childMapped.style;
			}
		}

		return {
			name: 'core/column',
			attributes: {
				...( width ? { width } : {} ),
				...( childMapped.style ? { style: childMapped.style } : {} ),
			},
			innerBlocks: convertChildren( child ),
		};
	} );

	return {
		name: 'core/columns',
		attributes: {
			...( mapped.style ? { style: mapped.style } : {} ),
		},
		innerBlocks: columns,
	};
}
