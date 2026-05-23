/**
 * Internal dependencies
 */
import {
	getDefaultTemplateIdForPost,
	getPostTemplatePolicy,
	getTemplateId,
} from '../private-selectors';
import { STORE_NAME } from '../name';
import { lock } from '../lock-unlock';

describe( 'fixed page templates', () => {
	function setupFixedPageTemplateRegistry(
		editorSettings: object | null,
		postsPageId: string | null = null
	) {
		const selectors = {
			getEditorSettings: () => editorSettings,
			getHomePage: () => ( {} ),
			getPostsPageId: () => postsPageId,
		};
		lock( selectors, selectors );
		const registry = {
			select: ( store: string ) => {
				if ( store === STORE_NAME ) {
					return selectors;
				}
			},
		};
		( getDefaultTemplateIdForPost as any ).registry = registry;
		( getPostTemplatePolicy as any ).registry = registry;
	}

	it( 'resolves fixed page template settings by page ID', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [ { id: 42, templateSlug: 'archive-product' } ],
		} );

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual( {
			isFixedTemplatePage: true,
			fixedTemplateSlug: 'archive-product',
			isFrontPage: false,
		} );
		expect( getPostTemplatePolicy( {} as any, 'post', 42 ) ).toEqual( {
			isFixedTemplatePage: false,
			fixedTemplateSlug: undefined,
			isFrontPage: false,
		} );
	} );

	it( 'uses an empty list while editor settings are unresolved', () => {
		setupFixedPageTemplateRegistry( null );

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual( {
			isFixedTemplatePage: false,
			fixedTemplateSlug: undefined,
			isFrontPage: false,
		} );
	} );

	it( 'treats the posts page as a fixed home template before editor settings resolve', () => {
		setupFixedPageTemplateRegistry( null, '42' );

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual( {
			isFixedTemplatePage: true,
			fixedTemplateSlug: 'home',
			isFrontPage: false,
		} );
	} );

	it( 'does not re-add the posts page after editor settings resolve', () => {
		setupFixedPageTemplateRegistry( { fixedPageTemplates: [] }, '42' );

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual( {
			isFixedTemplatePage: false,
			fixedTemplateSlug: undefined,
			isFrontPage: false,
		} );
	} );

	it( 'returns a policy for fixed template pages', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [ { id: 42, templateSlug: 'archive-product' } ],
		} );

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual( {
			isFixedTemplatePage: true,
			fixedTemplateSlug: 'archive-product',
			isFrontPage: false,
		} );
	} );

	it( 'uses the fixed template slug when resolving template IDs', () => {
		const selectors = {
			getEditorSettings: () => ( {
				fixedPageTemplates: [
					{ id: 42, templateSlug: 'archive-product' },
				],
			} ),
			getHomePage: () => ( {} ),
			getPostsPageId: () => null,
			getDefaultTemplateId: ( { slug }: { slug: string } ) =>
				`theme//${ slug }`,
		};
		lock( selectors, selectors );
		( getDefaultTemplateIdForPost as any ).registry = {
			select: ( store: string ) => {
				if ( store === STORE_NAME ) {
					return selectors;
				}
			},
		};
		( getTemplateId as any ).registry = {
			select: ( store: string ) => {
				if ( store === STORE_NAME ) {
					return selectors;
				}
			},
		};

		expect( getTemplateId( {} as any, 'page', 42 ) ).toBe(
			'theme//archive-product'
		);
		expect( getDefaultTemplateIdForPost( {} as any, 'page', 42 ) ).toBe(
			'theme//archive-product'
		);
	} );
} );
