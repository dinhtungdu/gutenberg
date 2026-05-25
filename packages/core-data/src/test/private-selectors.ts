/**
 * WordPress dependencies
 */
import triggerFetch from '@wordpress/api-fetch';
import { createRegistry } from '@wordpress/data';

/**
 * Internal dependencies
 */
import {
	getDefaultTemplateIdForPost,
	getPostTemplateResolution,
	getTemplateId,
} from '../private-selectors';
import { STORE_NAME } from '../name';
import { lock, unlock } from '../lock-unlock';
import { store as coreDataStore } from '../index';

jest.mock( '@wordpress/api-fetch' );

const RESOLVING_RESOLUTION = { type: 'resolving' };
const NORMAL_RESOLUTION = { type: 'normal' };

describe( 'fixed page templates', () => {
	beforeEach( () => {
		( triggerFetch as jest.Mock ).mockReset();
	} );

	function setupFixedPageTemplateRegistry( {
		fixedPageTemplates = [],
		editorSettings,
		homePage = {},
		templates = [],
		editedEntity = { slug: 'sample' },
	}: {
		fixedPageTemplates?: Array< {
			id: number | string;
			templateSlug: string;
		} >;
		editorSettings?: Record< string, any > | null;
		homePage?: object | null;
		templates?: Array< { id: string; slug: string } >;
		editedEntity?: Record< string, any > | null;
	} = {} ) {
		const settings =
			editorSettings === undefined
				? { fixedPageTemplates }
				: editorSettings;
		const selectors = {
			getEditorSettings: () => settings,
			getHomePage: () => homePage,
			getDefaultTemplateId: ( { slug }: { slug: string } ) =>
				`theme//${ slug }`,
			getEntityRecords: jest.fn( () => templates ),
			getEditedEntityRecord: () => editedEntity,
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
		( getPostTemplateResolution as any ).registry = registry;
		( getTemplateId as any ).registry = registry;
		return selectors;
	}

	it( 'uses editor settings as the fixed page template source', async () => {
		const registry = createRegistry();
		registry.register( coreDataStore );
		( triggerFetch as jest.Mock ).mockResolvedValue( {
			fixedPageTemplates: [ { id: 42, templateSlug: 'archive-product' } ],
		} );

		await expect(
			unlock(
				registry.resolveSelect( coreDataStore )
			).getEditorSettings()
		).resolves.toEqual( {
			fixedPageTemplates: [ { id: 42, templateSlug: 'archive-product' } ],
		} );
		await unlock(
			registry.resolveSelect( coreDataStore )
		).getEditorSettings();

		expect( triggerFetch ).toHaveBeenCalledTimes( 1 );
		expect( triggerFetch ).toHaveBeenCalledWith( {
			path: '/wp-block-editor/v1/settings',
		} );
		expect(
			unlock(
				registry.select( coreDataStore )
			).getFixedPageTemplateDefinitions()
		).toEqual( [ { id: 42, templateSlug: 'archive-product' } ] );
		expect(
			unlock(
				registry.select( coreDataStore )
			).getPostTemplateResolution( 'page', 42 )
		).toEqual( {
			type: 'fixed',
			fixedTemplateSlug: 'archive-product',
		} );
	} );

	it( 'bootstraps editor settings without fetching them again', async () => {
		const registry = createRegistry();
		registry.register( coreDataStore );

		unlock( registry.dispatch( coreDataStore ) ).bootstrapEditorSettings( {
			fixedPageTemplates: [ { id: 42, templateSlug: 'archive-product' } ],
		} );

		expect(
			registry
				.select( coreDataStore )
				.hasFinishedResolution( 'getEditorSettings', [] )
		).toBe( true );
		await expect(
			unlock(
				registry.resolveSelect( coreDataStore )
			).getEditorSettings()
		).resolves.toEqual( {
			fixedPageTemplates: [ { id: 42, templateSlug: 'archive-product' } ],
		} );
		expect( triggerFetch ).not.toHaveBeenCalled();
	} );

	it( 'resolves fixed page template settings by page ID', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [ { id: 42, templateSlug: 'archive-product' } ],
		} );

		expect( getPostTemplateResolution( {} as any, 'page', 42 ) ).toEqual( {
			type: 'fixed',
			fixedTemplateSlug: 'archive-product',
		} );
		expect( getDefaultTemplateIdForPost( {} as any, 'page', 42 ) ).toBe(
			'theme//archive-product'
		);
		expect( getPostTemplateResolution( {} as any, 'post', 42 ) ).toEqual(
			NORMAL_RESOLUTION
		);
	} );

	it( 'reports resolving for pages while editor settings are unresolved', () => {
		setupFixedPageTemplateRegistry( { editorSettings: null } );

		expect( getPostTemplateResolution( {} as any, 'page', 42 ) ).toEqual(
			RESOLVING_RESOLUTION
		);
		expect( getDefaultTemplateIdForPost( {} as any, 'page', 42 ) ).toBe(
			undefined
		);
		expect( getPostTemplateResolution( {} as any, 'post', 42 ) ).toEqual(
			NORMAL_RESOLUTION
		);
	} );

	it( 'treats the posts page as a fixed home template from editor settings', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [ { id: 42, templateSlug: 'home' } ],
		} );

		expect( getPostTemplateResolution( {} as any, 'page', 42 ) ).toEqual( {
			type: 'fixed',
			fixedTemplateSlug: 'home',
		} );
		expect( getDefaultTemplateIdForPost( {} as any, 'page', 42 ) ).toBe(
			'theme//home'
		);
	} );

	it( 'uses loaded fixed page templates without inferring a posts page fallback', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [],
		} );

		expect( getPostTemplateResolution( {} as any, 'page', 42 ) ).toEqual(
			NORMAL_RESOLUTION
		);
	} );

	it( 'classifies the front page without a front page template', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [],
			homePage: { postType: 'page', postId: '42' },
		} );

		expect( getPostTemplateResolution( {} as any, 'page', 42 ) ).toEqual( {
			type: 'front-page',
			frontPageTemplateId: null,
		} );
		expect(
			getDefaultTemplateIdForPost( {} as any, 'page', 42, 'front' )
		).toBe( 'theme//page-front' );
	} );

	it( 'classifies the front page with a front page template', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [],
			homePage: { postType: 'page', postId: '42' },
			templates: [ { id: 'theme//front-page', slug: 'front-page' } ],
		} );

		expect( getPostTemplateResolution( {} as any, 'page', 42 ) ).toEqual( {
			type: 'front-page',
			frontPageTemplateId: 'theme//front-page',
		} );
		expect( getDefaultTemplateIdForPost( {} as any, 'page', 42 ) ).toBe(
			'theme//front-page'
		);
	} );

	it( 'prefers a fixed template over the front page template', () => {
		const selectors = setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [ { id: 42, templateSlug: 'archive-product' } ],
			homePage: { postType: 'page', postId: '42' },
			templates: [ { id: 'theme//front-page', slug: 'front-page' } ],
		} );

		expect( getPostTemplateResolution( {} as any, 'page', 42 ) ).toEqual( {
			type: 'fixed',
			fixedTemplateSlug: 'archive-product',
		} );
		expect( getTemplateId( {} as any, 'page', 42 ) ).toBe(
			'theme//archive-product'
		);
		expect( getDefaultTemplateIdForPost( {} as any, 'page', 42 ) ).toBe(
			'theme//archive-product'
		);
		expect( selectors.getEntityRecords ).not.toHaveBeenCalled();
	} );

	it( 'uses the fixed template slug when resolving template IDs', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [ { id: 42, templateSlug: 'archive-product' } ],
		} );

		expect( getTemplateId( {} as any, 'page', 42 ) ).toBe(
			'theme//archive-product'
		);
		expect( getDefaultTemplateIdForPost( {} as any, 'page', 42 ) ).toBe(
			'theme//archive-product'
		);
	} );

	it( 'uses the assigned template before the normal default template', () => {
		setupFixedPageTemplateRegistry( {
			templates: [ { id: 'theme//custom-page', slug: 'custom-page' } ],
			editedEntity: { slug: 'sample', template: 'custom-page' },
		} );

		expect( getTemplateId( {} as any, 'page', 42 ) ).toBe(
			'theme//custom-page'
		);
		expect( getDefaultTemplateIdForPost( {} as any, 'page', 42 ) ).toBe(
			'theme//page'
		);
	} );
} );
