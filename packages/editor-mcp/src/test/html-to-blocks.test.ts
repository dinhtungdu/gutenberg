import { describe, it } from 'node:test';
import assert from 'node:assert';
import { convertHtmlToBlocks } from '../html-to-blocks/index.js';
import {
	mapStylesToBlockAttrs,
	parseInlineStyle,
} from '../html-to-blocks/style-mapper.js';

describe( 'parseInlineStyle', () => {
	it( 'should parse simple properties', () => {
		const result = parseInlineStyle( 'color: red; font-size: 16px' );
		assert.strictEqual( result.color, 'red' );
		assert.strictEqual( result[ 'font-size' ], '16px' );
	} );

	it( 'should handle empty string', () => {
		const result = parseInlineStyle( '' );
		assert.deepStrictEqual( result, {} );
	} );
} );

describe( 'mapStylesToBlockAttrs', () => {
	it( 'should map color properties', () => {
		const result = mapStylesToBlockAttrs( {
			color: 'white',
			'background-color': '#333',
		} );
		assert.deepStrictEqual( result.style, {
			color: { text: 'white', background: '#333' },
		} );
	} );

	it( 'should map typography properties', () => {
		const result = mapStylesToBlockAttrs( {
			'font-size': '24px',
			'font-weight': 'bold',
			'line-height': '1.5',
		} );
		assert.deepStrictEqual( result.style, {
			typography: {
				fontSize: '24px',
				fontWeight: 'bold',
				lineHeight: '1.5',
			},
		} );
	} );

	it( 'should map spacing with shorthand', () => {
		const result = mapStylesToBlockAttrs( {
			padding: '10px 20px',
			margin: '5px',
		} );
		assert.deepStrictEqual( result.style?.spacing, {
			padding: {
				top: '10px',
				right: '20px',
				bottom: '10px',
				left: '20px',
			},
			margin: { top: '5px', right: '5px', bottom: '5px', left: '5px' },
		} );
	} );

	it( 'should detect flex layout', () => {
		const result = mapStylesToBlockAttrs( {
			display: 'flex',
			'flex-direction': 'column',
			'justify-content': 'center',
			gap: '1rem',
		} );
		assert.deepStrictEqual( result.layout, {
			type: 'flex',
			orientation: 'vertical',
			justifyContent: 'center',
		} );
		assert.strictEqual(
			( result.style?.spacing as Record< string, unknown > )?.blockGap,
			'1rem'
		);
	} );

	it( 'should detect grid layout', () => {
		const result = mapStylesToBlockAttrs( {
			display: 'grid',
			'grid-template-columns': 'repeat(3, 1fr)',
		} );
		assert.deepStrictEqual( result.layout, {
			type: 'grid',
			columnCount: 3,
		} );
	} );

	it( 'should map border properties', () => {
		const result = mapStylesToBlockAttrs( {
			'border-radius': '8px',
			border: '1px solid #eee',
		} );
		assert.strictEqual(
			( result.style?.border as Record< string, unknown > )?.radius,
			'8px'
		);
		assert.strictEqual(
			( result.style?.border as Record< string, unknown > )?.width,
			'1px'
		);
	} );

	it( 'should map box-shadow', () => {
		const result = mapStylesToBlockAttrs( {
			'box-shadow': '0 2px 4px rgba(0,0,0,0.1)',
		} );
		assert.strictEqual( result.style?.shadow, '0 2px 4px rgba(0,0,0,0.1)' );
	} );

	it( 'should strip !important', () => {
		const result = mapStylesToBlockAttrs( {
			color: 'red !important',
		} );
		assert.deepStrictEqual( result.style, {
			color: { text: 'red' },
		} );
	} );
} );

describe( 'convertHtmlToBlocks', () => {
	it( 'should convert a paragraph', () => {
		const markup = convertHtmlToBlocks( '<p>Hello world</p>' );
		assert.ok( markup.includes( '<!-- wp:paragraph' ) );
		assert.ok( markup.includes( '<p>Hello world</p>' ) );
		assert.ok( markup.includes( '<!-- /wp:paragraph -->' ) );
	} );

	it( 'should convert headings with correct level', () => {
		const markup = convertHtmlToBlocks( '<h1>Title</h1><h3>Subtitle</h3>' );
		assert.ok( markup.includes( '<!-- wp:heading {"level":1}' ) );
		assert.ok( markup.includes( '<h1>Title</h1>' ) );
		assert.ok( markup.includes( '<!-- wp:heading {"level":3}' ) );
		assert.ok( markup.includes( '<h3>Subtitle</h3>' ) );
	} );

	it( 'should convert an image', () => {
		const markup = convertHtmlToBlocks(
			'<img src="photo.jpg" alt="A photo" />'
		);
		assert.ok( markup.includes( '<!-- wp:image' ) );
		assert.ok( markup.includes( '"url":"photo.jpg"' ) );
		assert.ok( markup.includes( '"alt":"A photo"' ) );
	} );

	it( 'should convert a list', () => {
		const markup = convertHtmlToBlocks(
			'<ul><li>Item 1</li><li>Item 2</li></ul>'
		);
		assert.ok( markup.includes( '<!-- wp:list' ) );
		assert.ok( markup.includes( '<!-- wp:list-item' ) );
		assert.ok( markup.includes( 'Item 1' ) );
	} );

	it( 'should convert a styled div to a group with block styles', () => {
		const markup = convertHtmlToBlocks(
			'<div style="background-color: #333; padding: 2rem; color: white"><p>Content</p></div>'
		);
		assert.ok( markup.includes( '<!-- wp:group' ) );
		assert.ok(
			markup.includes( '"color":{"background":"#333","text":"white"}' )
		);
		assert.ok( markup.includes( '"spacing":{"padding"' ) );
		assert.ok( markup.includes( '<!-- wp:paragraph' ) );
	} );

	it( 'should handle <style> tags', () => {
		const markup = convertHtmlToBlocks( `
			<style>.hero { background-color: blue; padding: 3rem; }</style>
			<div class="hero"><p>Hero text</p></div>
		` );
		assert.ok( markup.includes( '<!-- wp:group' ) );
		assert.ok( markup.includes( '"background":"blue"' ) );
		assert.ok( markup.includes( '"padding"' ) );
	} );

	it( 'should convert flex container to group with flex layout', () => {
		const markup = convertHtmlToBlocks(
			'<div style="display: flex; justify-content: center; gap: 1rem"><p>A</p><p>B</p></div>'
		);
		assert.ok(
			markup.includes(
				'"layout":{"type":"flex","justifyContent":"center"}'
			)
		);
	} );

	it( 'should convert a button-like link', () => {
		const markup = convertHtmlToBlocks(
			'<a href="/signup" style="background-color: blue; padding: 12px 24px; border-radius: 4px; color: white">Sign Up</a>'
		);
		assert.ok( markup.includes( '<!-- wp:buttons' ) );
		assert.ok( markup.includes( '<!-- wp:button' ) );
		assert.ok( markup.includes( 'Sign Up' ) );
	} );

	it( 'should convert a separator', () => {
		const markup = convertHtmlToBlocks( '<hr />' );
		assert.ok( markup.includes( '<!-- wp:separator /-->' ) );
	} );

	it( 'should convert section with tagName', () => {
		const markup = convertHtmlToBlocks(
			'<section><p>Content</p></section>'
		);
		assert.ok( markup.includes( '"tagName":"section"' ) );
		assert.ok( markup.includes( '<!-- wp:group' ) );
	} );

	it( 'should wrap bare text in a paragraph', () => {
		const markup = convertHtmlToBlocks( 'Just some text' );
		assert.ok( markup.includes( '<!-- wp:paragraph' ) );
		assert.ok( markup.includes( 'Just some text' ) );
	} );

	it( 'should preserve inline elements inside paragraphs', () => {
		const markup = convertHtmlToBlocks(
			'<p>Hello <strong>bold</strong> and <em>italic</em></p>'
		);
		assert.ok(
			markup.includes( 'Hello <strong>bold</strong> and <em>italic</em>' )
		);
	} );

	it( 'should handle a complete page with style tag', () => {
		const html = `
			<style>
				.hero { background-color: #3858E9; padding: 4rem 2rem; }
				.hero h1 { color: white; font-size: 3rem; }
				.hero p { color: #ccc; font-size: 1.2rem; }
				.features { display: flex; gap: 2rem; padding: 2rem; }
				.card { background-color: white; padding: 1.5rem; border-radius: 8px; }
			</style>
			<section class="hero">
				<h1>Welcome to My Site</h1>
				<p>Building the future of the web</p>
			</section>
			<div class="features">
				<div class="card"><h3>Fast</h3><p>Lightning speed</p></div>
				<div class="card"><h3>Secure</h3><p>Built-in security</p></div>
				<div class="card"><h3>Scalable</h3><p>Grows with you</p></div>
			</div>
		`;
		const markup = convertHtmlToBlocks( html );

		// Hero section
		assert.ok( markup.includes( '<!-- wp:group' ) );
		assert.ok( markup.includes( '"background":"#3858E9"' ) );
		assert.ok( markup.includes( '<!-- wp:heading' ) );
		assert.ok( markup.includes( 'Welcome to My Site' ) );

		// Features section with flex layout
		assert.ok( markup.includes( '"type":"flex"' ) );

		// Cards with styles
		assert.ok(
			markup.includes( '"border-radius"' ) ||
				markup.includes( '"radius":"8px"' )
		);
	} );
} );
