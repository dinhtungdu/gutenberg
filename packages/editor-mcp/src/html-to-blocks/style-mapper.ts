/**
 * Maps CSS properties to Gutenberg block style and layout attributes.
 */

type StyleObj = Record< string, unknown >;

function setNested( obj: StyleObj, path: string, value: unknown ): void {
	const parts = path.split( '.' );
	let current = obj;
	for ( let i = 0; i < parts.length - 1; i++ ) {
		if (
			! current[ parts[ i ] ] ||
			typeof current[ parts[ i ] ] !== 'object'
		) {
			current[ parts[ i ] ] = {};
		}
		current = current[ parts[ i ] ] as StyleObj;
	}
	current[ parts[ parts.length - 1 ] ] = value;
}

function parseBoxShorthand( value: string ): {
	top: string;
	right: string;
	bottom: string;
	left: string;
} {
	const parts = value.trim().split( /\s+/ );
	switch ( parts.length ) {
		case 1:
			return {
				top: parts[ 0 ],
				right: parts[ 0 ],
				bottom: parts[ 0 ],
				left: parts[ 0 ],
			};
		case 2:
			return {
				top: parts[ 0 ],
				right: parts[ 1 ],
				bottom: parts[ 0 ],
				left: parts[ 1 ],
			};
		case 3:
			return {
				top: parts[ 0 ],
				right: parts[ 1 ],
				bottom: parts[ 2 ],
				left: parts[ 1 ],
			};
		default:
			return {
				top: parts[ 0 ],
				right: parts[ 1 ],
				bottom: parts[ 2 ],
				left: parts[ 3 ],
			};
	}
}

function parseBorderShorthand( value: string ): {
	width?: string;
	style?: string;
	color?: string;
} {
	const result: { width?: string; style?: string; color?: string } = {};
	const borderStyles = [
		'none',
		'hidden',
		'dotted',
		'dashed',
		'solid',
		'double',
		'groove',
		'ridge',
		'inset',
		'outset',
	];
	const parts = value.trim().split( /\s+/ );
	for ( const part of parts ) {
		if ( /^\d/.test( part ) || part === '0' ) {
			result.width = part;
		} else if ( borderStyles.includes( part ) ) {
			result.style = part;
		} else {
			result.color = part;
		}
	}
	return result;
}

function parseBorderRadius( value: string ):
	| string
	| {
			topLeft: string;
			topRight: string;
			bottomRight: string;
			bottomLeft: string;
	  } {
	const parts = value.trim().split( /\s+/ );
	if ( parts.length === 1 ) {
		return parts[ 0 ];
	}
	switch ( parts.length ) {
		case 2:
			return {
				topLeft: parts[ 0 ],
				topRight: parts[ 1 ],
				bottomRight: parts[ 0 ],
				bottomLeft: parts[ 1 ],
			};
		case 3:
			return {
				topLeft: parts[ 0 ],
				topRight: parts[ 1 ],
				bottomRight: parts[ 2 ],
				bottomLeft: parts[ 1 ],
			};
		default:
			return {
				topLeft: parts[ 0 ],
				topRight: parts[ 1 ],
				bottomRight: parts[ 2 ],
				bottomLeft: parts[ 3 ],
			};
	}
}

const ALIGN_ITEMS_MAP: Record< string, string > = {
	'flex-start': 'top',
	start: 'top',
	center: 'center',
	'flex-end': 'bottom',
	end: 'bottom',
	stretch: 'stretch',
};

/**
 * CSS properties that map to layout attributes (consumed separately).
 */
const LAYOUT_PROPERTIES = new Set( [
	'display',
	'flex-direction',
	'justify-content',
	'align-items',
	'flex-wrap',
	'grid-template-columns',
	'gap',
	'row-gap',
	'column-gap',
] );

export interface MappedAttributes {
	style?: StyleObj;
	layout?: StyleObj;
}

/**
 * Map a flat CSS property map to block style + layout attributes.
 *
 * @param {Record<string,string>} styles The CSS property map to convert.
 */
export function mapStylesToBlockAttrs(
	styles: Record< string, string >
): MappedAttributes {
	const result: MappedAttributes = {};
	const style: StyleObj = {};
	const layout: StyleObj = {};

	for ( const [ prop, value ] of Object.entries( styles ) ) {
		const v = value.replace( /!important/g, '' ).trim();
		if ( ! v ) {
			continue;
		}

		switch ( prop ) {
			// Color
			case 'color':
				setNested( style, 'color.text', v );
				break;
			case 'background-color':
				setNested( style, 'color.background', v );
				break;
			case 'background':
			case 'background-image':
				if ( v.includes( 'gradient' ) ) {
					setNested( style, 'color.gradient', v );
				} else if ( v.includes( 'url(' ) ) {
					// Background image URL — map to style.background.backgroundImage
					// Note: external URLs may not render; images should be in WP media library
					const urlMatch = v.match(
						/url\(\s*["']?([^"')]+)["']?\s*\)/
					);
					if ( urlMatch ) {
						setNested( style, 'background.backgroundImage', {
							url: urlMatch[ 1 ],
							source: 'file',
						} );
					}
				} else if ( prop === 'background' ) {
					// Simple background color
					setNested( style, 'color.background', v );
				}
				break;
			case 'background-size':
				setNested( style, 'background.backgroundSize', v );
				break;
			case 'background-position':
				setNested( style, 'background.backgroundPosition', v );
				break;
			case 'background-repeat':
				setNested( style, 'background.backgroundRepeat', v );
				break;

			// Typography
			case 'font-size':
				setNested( style, 'typography.fontSize', v );
				break;
			case 'font-family':
				setNested( style, 'typography.fontFamily', v );
				break;
			case 'font-weight':
				setNested( style, 'typography.fontWeight', v );
				break;
			case 'font-style':
				setNested( style, 'typography.fontStyle', v );
				break;
			case 'line-height':
				setNested( style, 'typography.lineHeight', v );
				break;
			case 'letter-spacing':
				setNested( style, 'typography.letterSpacing', v );
				break;
			case 'text-decoration':
				setNested( style, 'typography.textDecoration', v );
				break;
			case 'text-transform':
				setNested( style, 'typography.textTransform', v );
				break;
			case 'text-indent':
				setNested( style, 'typography.textIndent', v );
				break;
			case 'writing-mode':
				setNested( style, 'typography.writingMode', v );
				break;
			case 'column-count':
				setNested( style, 'typography.textColumns', v );
				break;

			// Spacing
			case 'padding':
				setNested( style, 'spacing.padding', parseBoxShorthand( v ) );
				break;
			case 'padding-top':
				setNested( style, 'spacing.padding.top', v );
				break;
			case 'padding-right':
				setNested( style, 'spacing.padding.right', v );
				break;
			case 'padding-bottom':
				setNested( style, 'spacing.padding.bottom', v );
				break;
			case 'padding-left':
				setNested( style, 'spacing.padding.left', v );
				break;
			case 'margin':
				setNested( style, 'spacing.margin', parseBoxShorthand( v ) );
				break;
			case 'margin-top':
				setNested( style, 'spacing.margin.top', v );
				break;
			case 'margin-right':
				setNested( style, 'spacing.margin.right', v );
				break;
			case 'margin-bottom':
				setNested( style, 'spacing.margin.bottom', v );
				break;
			case 'margin-left':
				setNested( style, 'spacing.margin.left', v );
				break;
			case 'gap':
				setNested( style, 'spacing.blockGap', v );
				break;

			// Border
			case 'border':
				Object.assign( style, {
					border: {
						...( ( style.border as StyleObj ) || {} ),
						...parseBorderShorthand( v ),
					},
				} );
				break;
			case 'border-width':
				setNested( style, 'border.width', v );
				break;
			case 'border-style':
				setNested( style, 'border.style', v );
				break;
			case 'border-color':
				setNested( style, 'border.color', v );
				break;
			case 'border-radius':
				setNested( style, 'border.radius', parseBorderRadius( v ) );
				break;
			case 'border-top':
				setNested( style, 'border.top', parseBorderShorthand( v ) );
				break;
			case 'border-right':
				setNested( style, 'border.right', parseBorderShorthand( v ) );
				break;
			case 'border-bottom':
				setNested( style, 'border.bottom', parseBorderShorthand( v ) );
				break;
			case 'border-left':
				setNested( style, 'border.left', parseBorderShorthand( v ) );
				break;
			case 'border-top-left-radius':
				setNested( style, 'border.radius.topLeft', v );
				break;
			case 'border-top-right-radius':
				setNested( style, 'border.radius.topRight', v );
				break;
			case 'border-bottom-left-radius':
				setNested( style, 'border.radius.bottomLeft', v );
				break;
			case 'border-bottom-right-radius':
				setNested( style, 'border.radius.bottomRight', v );
				break;

			// Dimensions
			case 'width':
				setNested( style, 'dimensions.width', v );
				break;
			case 'height':
				setNested( style, 'dimensions.height', v );
				break;
			case 'min-height':
				setNested( style, 'dimensions.minHeight', v );
				break;
			case 'aspect-ratio':
				setNested( style, 'dimensions.aspectRatio', v );
				break;

			// Shadow
			case 'box-shadow':
				style.shadow = v;
				break;

			// Outline
			case 'outline-color':
				setNested( style, 'outline.color', v );
				break;
			case 'outline-style':
				setNested( style, 'outline.style', v );
				break;
			case 'outline-width':
				setNested( style, 'outline.width', v );
				break;
			case 'outline-offset':
				setNested( style, 'outline.offset', v );
				break;

			// Layout properties — go to layout, not style
			case 'display':
				if ( v === 'flex' ) {
					layout.type = 'flex';
				} else if ( v === 'grid' ) {
					layout.type = 'grid';
				}
				break;
			case 'flex-direction':
				if ( v === 'column' || v === 'column-reverse' ) {
					layout.orientation = 'vertical';
				}
				// horizontal is default, no need to set
				break;
			case 'justify-content':
				if ( v === 'flex-start' || v === 'start' ) {
					layout.justifyContent = 'left';
				} else if ( v === 'flex-end' || v === 'end' ) {
					layout.justifyContent = 'right';
				} else if ( v === 'center' ) {
					layout.justifyContent = 'center';
				} else if ( v === 'space-between' ) {
					layout.justifyContent = 'space-between';
				}
				break;
			case 'align-items':
				if ( ALIGN_ITEMS_MAP[ v ] ) {
					layout.verticalAlignment = ALIGN_ITEMS_MAP[ v ];
				}
				break;
			case 'flex-wrap':
				layout.flexWrap = v === 'nowrap' ? 'nowrap' : 'wrap';
				break;
			case 'grid-template-columns': {
				// Try to extract column count from repeat() or count space-separated values
				const repeatMatch = v.match( /repeat\(\s*(\d+)/ );
				if ( repeatMatch ) {
					layout.columnCount = parseInt( repeatMatch[ 1 ], 10 );
				} else {
					const cols = v
						.split( /\s+/ )
						.filter( ( s: string ) => s.trim() );
					if ( cols.length > 0 ) {
						layout.columnCount = cols.length;
					}
				}
				break;
			}
			// Skip unknown properties
			default:
				break;
		}
	}

	if ( Object.keys( style ).length > 0 ) {
		result.style = style;
	}
	if ( Object.keys( layout ).length > 0 ) {
		result.layout = layout;
	}

	return result;
}

/**
 * Check if a CSS property is a layout property (consumed by layout, not style).
 *
 * @param {string} prop The CSS property name to check.
 */
export function isLayoutProperty( prop: string ): boolean {
	return LAYOUT_PROPERTIES.has( prop );
}

/**
 * Parse an inline style string into a property map.
 *
 * @param {string} styleStr The inline style string to parse.
 */
export function parseInlineStyle( styleStr: string ): Record< string, string > {
	const result: Record< string, string > = {};
	if ( ! styleStr ) {
		return result;
	}
	// Split on semicolons, handling values that might contain semicolons in url() or quotes
	const declarations = styleStr.split( ';' );
	for ( const decl of declarations ) {
		const colonIdx = decl.indexOf( ':' );
		if ( colonIdx === -1 ) {
			continue;
		}
		const prop = decl.slice( 0, colonIdx ).trim().toLowerCase();
		const value = decl.slice( colonIdx + 1 ).trim();
		if ( prop && value ) {
			result[ prop ] = value;
		}
	}
	return result;
}
