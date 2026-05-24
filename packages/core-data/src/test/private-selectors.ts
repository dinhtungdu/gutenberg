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

const SWITCHABLE_POLICY = {
	isResolving: false,
	canToggleTemplateMode: true,
	canSwitchTemplate: true,
	canEditTemplateField: true,
	shouldShowPostContentInfo: true,
};

const FIXED_TEMPLATE_POLICY = {
	isResolving: false,
	canToggleTemplateMode: false,
	canSwitchTemplate: false,
	canEditTemplateField: false,
	shouldShowPostContentInfo: false,
};

const RESOLVING_POLICY = {
	isResolving: true,
	canToggleTemplateMode: false,
	canSwitchTemplate: false,
	canEditTemplateField: false,
	shouldShowPostContentInfo: false,
};

describe( 'fixed page templates', () => {
	function setupFixedPageTemplateRegistry( {
		fixedPageTemplates,
		postsPageId = null,
		homePage = {},
		templates = [],
	}: {
		fixedPageTemplates?: Array< {
			id: number | string;
			templateSlug: string;
		} >;
		postsPageId?: string | null;
		homePage?: object | null;
		templates?: Array< { id: string; slug: string } >;
	} = {} ) {
		const selectors = {
			getFixedPageTemplateDefinitions: () => fixedPageTemplates,
			getHomePage: () => homePage,
			getPostsPageId: () => postsPageId,
			getEntityRecords: () => templates,
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

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual(
			FIXED_TEMPLATE_POLICY
		);
		expect( getPostTemplatePolicy( {} as any, 'post', 42 ) ).toEqual(
			SWITCHABLE_POLICY
		);
	} );

	it( 'reports resolving for pages while fixed page templates and homepage are unresolved', () => {
		setupFixedPageTemplateRegistry( { homePage: null } );

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual(
			RESOLVING_POLICY
		);
		expect( getPostTemplatePolicy( {} as any, 'post', 42 ) ).toEqual(
			SWITCHABLE_POLICY
		);
	} );

	it( 'reports resolving for pages before fixed page templates resolve', () => {
		setupFixedPageTemplateRegistry();

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual(
			RESOLVING_POLICY
		);
	} );

	it( 'treats the posts page as a fixed home template before fixed page templates resolve', () => {
		setupFixedPageTemplateRegistry( { postsPageId: '42' } );

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual(
			FIXED_TEMPLATE_POLICY
		);
	} );

	it( 'uses loaded fixed page templates without the posts page fallback', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [],
			postsPageId: '42',
		} );

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual(
			SWITCHABLE_POLICY
		);
	} );

	it( 'prevents switching template fields for the front page', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [],
			homePage: { postType: 'page', postId: '42' },
		} );

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual( {
			isResolving: false,
			canToggleTemplateMode: true,
			canSwitchTemplate: true,
			canEditTemplateField: false,
			shouldShowPostContentInfo: true,
		} );
	} );

	it( 'prevents switching templates for the front page when a front page template exists', () => {
		setupFixedPageTemplateRegistry( {
			fixedPageTemplates: [],
			homePage: { postType: 'page', postId: '42' },
			templates: [ { id: 'theme//front-page', slug: 'front-page' } ],
		} );

		expect( getPostTemplatePolicy( {} as any, 'page', 42 ) ).toEqual( {
			isResolving: false,
			canToggleTemplateMode: true,
			canSwitchTemplate: false,
			canEditTemplateField: false,
			shouldShowPostContentInfo: true,
		} );
	} );

	it( 'uses the fixed template slug when resolving template IDs', () => {
		const selectors = {
			getFixedPageTemplateDefinitions: () => [
				{ id: 42, templateSlug: 'archive-product' },
			],
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
