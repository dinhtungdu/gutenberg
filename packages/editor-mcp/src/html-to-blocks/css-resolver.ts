/**
 * Resolves <style> tags: parses CSS rules and merges them onto matching elements
 * as inline styles, so the rest of the pipeline only needs to handle inline styles.
 */

import { parse as parseHtml, type HTMLElement } from 'node-html-parser';
import csstree from 'css-tree';

export { parseHtml };

/**
 * Extract all <style> blocks from the document, parse them, and merge
 * class/element-based rules onto matching elements as inline styles.
 * Inline styles on elements take precedence (applied last).
 *
 * @param {HTMLElement} root The root HTML element to resolve styles in.
 */
export function resolveStyles( root: HTMLElement ): void {
	const styleElements = root.querySelectorAll( 'style' );
	if ( styleElements.length === 0 ) {
		return;
	}

	// Collect all rules from all <style> blocks
	const rules: Array< {
		selector: string;
		declarations: Map< string, string >;
	} > = [];

	for ( const styleEl of styleElements ) {
		const cssText = styleEl.textContent || '';
		let ast: csstree.CssNode;
		try {
			ast = csstree.parse( cssText );
		} catch {
			continue;
		}

		csstree.walk( ast, {
			visit: 'Rule',
			enter( node ) {
				if (
					node.type !== 'Rule' ||
					node.prelude.type !== 'SelectorList'
				) {
					return;
				}

				const declarations = new Map< string, string >();
				if ( node.block.type === 'Block' ) {
					node.block.children.forEach( ( child ) => {
						if ( child.type === 'Declaration' ) {
							declarations.set(
								child.property.toLowerCase(),
								csstree.generate( child.value )
							);
						}
					} );
				}

				if ( declarations.size === 0 ) {
					return;
				}

				// Extract each selector from the selector list
				node.prelude.children.forEach( ( selectorNode ) => {
					const selector = csstree.generate( selectorNode );
					// Skip pseudo-element selectors and media queries
					if (
						selector.includes( '::' ) ||
						selector.includes( '@' )
					) {
						return;
					}
					rules.push( { selector, declarations } );
				} );
			},
		} );

		// Remove the <style> element from the DOM
		styleEl.remove();
	}

	// Apply rules to matching elements
	for ( const { selector, declarations } of rules ) {
		let matched: HTMLElement[];
		try {
			matched = root.querySelectorAll( selector );
		} catch {
			// Invalid selector for node-html-parser — skip
			continue;
		}

		for ( const el of matched ) {
			// Get existing inline styles (these take precedence)
			const existingStyle = el.getAttribute( 'style' ) || '';
			const existingProps = parseStyleString( existingStyle );

			// Merge: rule declarations first, then existing inline overrides
			const merged = new Map( declarations );
			for ( const [ prop, val ] of existingProps ) {
				merged.set( prop, val );
			}

			// Serialize back to inline style
			const parts: string[] = [];
			for ( const [ prop, val ] of merged ) {
				parts.push( `${ prop }: ${ val }` );
			}
			el.setAttribute( 'style', parts.join( '; ' ) );
		}
	}
}

function parseStyleString( styleStr: string ): Map< string, string > {
	const result = new Map< string, string >();
	if ( ! styleStr ) {
		return result;
	}
	const declarations = styleStr.split( ';' );
	for ( const decl of declarations ) {
		const colonIdx = decl.indexOf( ':' );
		if ( colonIdx === -1 ) {
			continue;
		}
		const prop = decl.slice( 0, colonIdx ).trim().toLowerCase();
		const value = decl.slice( colonIdx + 1 ).trim();
		if ( prop && value ) {
			result.set( prop, value );
		}
	}
	return result;
}
