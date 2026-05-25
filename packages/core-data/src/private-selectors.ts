/**
 * WordPress dependencies
 */
import { createSelector, createRegistrySelector } from '@wordpress/data';
import type { ConnectionStatus } from '@wordpress/sync';

/**
 * Internal dependencies
 */
import { getDefaultTemplateId, getEntityRecord, type State } from './selectors';
import { STORE_NAME } from './name';
import { unlock } from './lock-unlock';
import { getSyncManager } from './sync';
import logEntityDeprecation from './utils/log-entity-deprecation';

type EntityRecordKey = string | number;

const EMPTY_OBJECT = {};

/**
 * Returns the previous edit from the current undo offset
 * for the entity records edits history, if any.
 *
 * Known Issue: Every-time state.undoManager changes, the getUndoManager
 * private selector is called (if used within useSelect and things like that)
 * which ensures the UI is always properly reactive. But, it's not the case with
 * the custom "sync" undo manager.
 *
 * Assumption: When an undo/redo is created, other parts of the core-data state
 * are likely changing simultaneously, which will trigger the selectors again.
 *
 * This issue is acceptable based on the assumption above.
 *
 * @see https://github.com/WordPress/gutenberg/pull/72407/files#r2580214235 for more details.
 *
 * @param state State tree.
 *
 * @return The undo manager.
 */
export function getUndoManager( state: State ) {
	// undoManager is undefined until the first sync-enabled entity is loaded.
	return getSyncManager()?.undoManager ?? state.undoManager;
}

/**
 * Retrieve the fallback Navigation.
 *
 * @param state Data state.
 * @return The ID for the fallback Navigation post.
 */
export function getNavigationFallbackId(
	state: State
): EntityRecordKey | undefined {
	return state.navigationFallbackId;
}

export const getBlockPatternsForPostType = createRegistrySelector(
	( select: any ) =>
		createSelector(
			( state, postType ) =>
				select( STORE_NAME )
					.getBlockPatterns()
					.filter(
						( { postTypes } ) =>
							! postTypes ||
							( Array.isArray( postTypes ) &&
								postTypes.includes( postType ) )
					),
			() => [ select( STORE_NAME ).getBlockPatterns() ]
		)
);

/**
 * Returns the entity records permissions for the given entity record ids.
 */
export const getEntityRecordsPermissions = createRegistrySelector( ( select ) =>
	createSelector(
		(
			state: State,
			kind: string,
			name: string,
			ids: string | string[]
		) => {
			const normalizedIds = Array.isArray( ids ) ? ids : [ ids ];
			return normalizedIds.map( ( id ) => ( {
				delete: select( STORE_NAME ).canUser( 'delete', {
					kind,
					name,
					id,
				} ),
				update: select( STORE_NAME ).canUser( 'update', {
					kind,
					name,
					id,
				} ),
			} ) );
		},
		( state ) => [ state.userPermissions ]
	)
);

/**
 * Returns the entity record permissions for the given entity record id.
 *
 * @param state Data state.
 * @param kind  Entity kind.
 * @param name  Entity name.
 * @param id    Entity record id.
 *
 * @return The entity record permissions.
 */
export function getEntityRecordPermissions(
	state: State,
	kind: string,
	name: string,
	id: string
) {
	logEntityDeprecation( kind, name, 'getEntityRecordPermissions' );
	return getEntityRecordsPermissions( state, kind, name, id )[ 0 ];
}

/**
 * Returns the registered post meta fields for a given post type.
 *
 * @param state    Data state.
 * @param postType Post type.
 *
 * @return Registered post meta fields.
 */
export function getRegisteredPostMeta( state: State, postType: string ) {
	return state.registeredPostMeta?.[ postType ] ?? {};
}

function normalizePageId( value: number | string | undefined ): string | null {
	if ( ! value || ! [ 'number', 'string' ].includes( typeof value ) ) {
		return null;
	}

	// We also need to check if it's not zero (`'0'`).
	if ( Number( value ) === 0 ) {
		return null;
	}

	return value.toString();
}

interface SiteData {
	show_on_front?: string;
	page_on_front?: string | number;
	page_for_posts?: string | number;
}

interface FixedPageTemplate {
	id: EntityRecordKey;
	templateSlug: string;
}

type PostTemplateResolution =
	| { type: 'resolving' }
	| { type: 'fixed'; fixedTemplateSlug: string }
	| { type: 'front-page'; frontPageTemplateId: EntityRecordKey | null }
	| { type: 'normal' };

const RESOLVING_POST_TEMPLATE_RESOLUTION: PostTemplateResolution = {
	type: 'resolving',
};

function getFixedPageTemplates( select: any ): FixedPageTemplate[] | undefined {
	const editorSettings = unlock(
		select( STORE_NAME )
	).getEditorSettings() as Record< string, any > | null | undefined;
	if ( ! editorSettings ) {
		return undefined;
	}

	return ( editorSettings.fixedPageTemplates ?? [] ) as FixedPageTemplate[];
}

function getFixedPageTemplate(
	select: any,
	postType: string | undefined,
	postId: EntityRecordKey | undefined | null
): FixedPageTemplate | null | undefined {
	if ( postType !== 'page' || postId === undefined || postId === null ) {
		return null;
	}

	const fixedPageTemplates = getFixedPageTemplates( select );
	if ( fixedPageTemplates === undefined ) {
		return undefined;
	}

	return (
		fixedPageTemplates.find(
			( { id, templateSlug } ) =>
				!! templateSlug && id.toString() === postId.toString()
		) ?? null
	);
}

function isStaticFrontPage(
	select: any,
	postType: string | undefined,
	postId: EntityRecordKey | undefined | null
): boolean | undefined {
	if ( postType !== 'page' || postId === undefined || postId === null ) {
		return false;
	}

	const homepage = unlock( select( STORE_NAME ) ).getHomePage();
	if ( ! homepage ) {
		return undefined;
	}
	return (
		homepage?.postType === 'page' && postId.toString() === homepage.postId
	);
}

function getFrontPageTemplateId(
	select: any,
	postType: string | undefined,
	postId: EntityRecordKey | undefined | null
): EntityRecordKey | null | undefined {
	const isFrontPage = isStaticFrontPage( select, postType, postId );
	if ( isFrontPage === undefined ) {
		return undefined;
	}
	if ( ! isFrontPage ) {
		return null;
	}

	// The /lookup endpoint cannot currently handle a lookup when a page is set
	// as the front page. In that case, check if there is a front page template,
	// otherwise fall back to the page template.
	const templates = select( STORE_NAME ).getEntityRecords(
		'postType',
		'wp_template',
		{
			per_page: -1,
		}
	);
	if ( ! templates ) {
		return undefined;
	}

	return templates.find( ( { slug } ) => slug === 'front-page' )?.id ?? null;
}

function getTemplateSlugToCheck(
	postType: string,
	slug: string | undefined
): string {
	if ( slug ) {
		return postType === 'page'
			? `${ postType }-${ slug }`
			: `single-${ postType }-${ slug }`;
	}
	return postType === 'page' ? 'page' : `single-${ postType }`;
}

function getPostTemplateResolutionFromSelect(
	select: any,
	postType: string | undefined,
	postId: EntityRecordKey | undefined | null
): PostTemplateResolution {
	if ( ! postType || postId === undefined || postId === null ) {
		return { type: 'normal' };
	}

	const fixedPageTemplate = getFixedPageTemplate( select, postType, postId );
	if ( fixedPageTemplate === undefined ) {
		return RESOLVING_POST_TEMPLATE_RESOLUTION;
	}
	if ( fixedPageTemplate ) {
		return {
			type: 'fixed',
			fixedTemplateSlug: fixedPageTemplate.templateSlug,
		};
	}

	const isFrontPage = isStaticFrontPage( select, postType, postId );
	if ( isFrontPage === undefined ) {
		return RESOLVING_POST_TEMPLATE_RESOLUTION;
	}
	if ( ! isFrontPage ) {
		return { type: 'normal' };
	}

	const frontPageTemplateId = getFrontPageTemplateId(
		select,
		postType,
		postId
	);
	if ( frontPageTemplateId === undefined ) {
		return RESOLVING_POST_TEMPLATE_RESOLUTION;
	}

	return {
		type: 'front-page',
		frontPageTemplateId,
	};
}

function getDefaultTemplateIdForResolution(
	select: any,
	postType: string,
	resolution: PostTemplateResolution,
	slug?: string
): EntityRecordKey | undefined {
	if ( resolution.type === 'resolving' ) {
		return undefined;
	}
	if ( resolution.type === 'fixed' ) {
		return select( STORE_NAME ).getDefaultTemplateId( {
			slug: resolution.fixedTemplateSlug,
		} );
	}
	if ( resolution.type === 'front-page' && resolution.frontPageTemplateId ) {
		return resolution.frontPageTemplateId;
	}

	return select( STORE_NAME ).getDefaultTemplateId( {
		slug: getTemplateSlugToCheck( postType, slug ),
	} );
}

export const getPostTemplateResolution = createRegistrySelector(
	( select ) => ( _state, postType, postId ) => {
		return getPostTemplateResolutionFromSelect( select, postType, postId );
	}
);

export const getDefaultTemplateIdForPost = createRegistrySelector(
	( select ) => ( _state, postType, postId, slug ) => {
		if ( ! postType || postId === undefined || postId === null ) {
			return undefined;
		}

		return getDefaultTemplateIdForResolution(
			select,
			postType,
			getPostTemplateResolutionFromSelect( select, postType, postId ),
			slug
		);
	}
);

export const getHomePage = createRegistrySelector( ( select ) =>
	createSelector(
		() => {
			const siteData = select( STORE_NAME ).getEntityRecord(
				'root',
				'__unstableBase'
			) as SiteData | undefined;
			// Still resolving getEntityRecord.
			if ( ! siteData ) {
				return null;
			}
			const homepageId =
				siteData?.show_on_front === 'page'
					? normalizePageId( siteData.page_on_front )
					: null;
			if ( homepageId ) {
				return { postType: 'page', postId: homepageId };
			}
			const frontPageTemplateId = select(
				STORE_NAME
			).getDefaultTemplateId( {
				slug: 'front-page',
			} );
			if ( frontPageTemplateId ) {
				return {
					postType: 'wp_template',
					postId: frontPageTemplateId,
				};
			}
			// Resolution is finished and no front-page template exists.
			if ( frontPageTemplateId === '' ) {
				return EMPTY_OBJECT;
			}
			// Still resolving getDefaultTemplateId.
			return null;
		},
		( state ) => [
			// Even though getDefaultTemplateId.shouldInvalidate returns true when root/site changes,
			// it doesn't seem to invalidate this cache, I'm not sure why.
			getEntityRecord( state, 'root', 'site' ),
			getEntityRecord( state, 'root', '__unstableBase' ),
			getDefaultTemplateId( state, {
				slug: 'front-page',
			} ),
		]
	)
);

export const getPostsPageId = createRegistrySelector( ( select ) => () => {
	const siteData = select( STORE_NAME ).getEntityRecord(
		'root',
		'__unstableBase'
	) as SiteData | undefined;
	return siteData?.show_on_front === 'page'
		? normalizePageId( siteData.page_for_posts )
		: null;
} );

export const getTemplateId = createRegistrySelector(
	( select ) => ( state, postType, postId ) => {
		const resolution = getPostTemplateResolutionFromSelect(
			select,
			postType,
			postId
		);
		if ( resolution.type === 'resolving' ) {
			return;
		}
		if ( resolution.type === 'fixed' ) {
			return getDefaultTemplateIdForResolution(
				select,
				postType,
				resolution
			);
		}
		if (
			resolution.type === 'front-page' &&
			resolution.frontPageTemplateId
		) {
			return resolution.frontPageTemplateId;
		}

		const editedEntity = select( STORE_NAME ).getEditedEntityRecord(
			'postType',
			postType,
			postId
		);
		if ( ! editedEntity ) {
			return;
		}
		// First see if the post/page has an assigned template and fetch it.
		const currentTemplateSlug = editedEntity.template;
		if ( currentTemplateSlug ) {
			const currentTemplate = select( STORE_NAME )
				.getEntityRecords( 'postType', 'wp_template', {
					per_page: -1,
				} )
				?.find( ( { slug } ) => slug === currentTemplateSlug );
			if ( currentTemplate ) {
				return currentTemplate.id;
			}
		}

		return getDefaultTemplateIdForResolution(
			select,
			postType,
			resolution,
			editedEntity.slug
		);
	}
);

/**
 * Returns the editor settings.
 *
 * @param state Data state.
 * @return Editor settings object or null if not loaded.
 */
export function getEditorSettings(
	state: State
): Record< string, any > | null {
	return state.editorSettings;
}

/**
 * Returns fixed page template definitions.
 *
 * @param state Data state.
 * @return Fixed page template definitions, or undefined if not loaded.
 */
export function getFixedPageTemplateDefinitions(
	state: State
): FixedPageTemplate[] | undefined {
	return state.editorSettings
		? state.editorSettings.fixedPageTemplates ?? []
		: undefined;
}

/**
 * Returns the editor assets.
 *
 * @param state Data state.
 * @return Editor assets object or null if not loaded.
 */
export function getEditorAssets( state: State ): Record< string, any > | null {
	return state.editorAssets;
}

/**
 * Returns whether collaboration is supported.
 *
 * @param state Data state.
 * @return Whether collaboration is supported.
 */
export function isCollaborationSupported( state: State ): boolean {
	return state.collaborationSupported;
}

/**
 * Returns the view configuration for the given entity type.
 *
 * @param state Data state.
 * @param kind  Entity kind.
 * @param name  Entity name.
 *
 * @return The view configuration or undefined if not loaded.
 */
export function getViewConfig(
	state: State,
	kind: string,
	name: string
): Record< string, any > | undefined {
	return (
		state.viewConfigs?.[ `${ kind }/${ name }` ] ?? {
			default_view: undefined,
			default_layouts: undefined,
			view_list: undefined,
			form: undefined,
		}
	);
}

/**
 * Returns the current sync connection status across all entities. Prioritizes
 * disconnected states, then connecting, then connected.
 *
 * @param state Data state.
 *
 * @return The current sync connection state, prioritized by importance.
 */
export function getSyncConnectionStatus(
	state: State
): ConnectionStatus | undefined {
	if ( ! state.syncConnectionStatuses ) {
		return undefined;
	}

	const PRIORITIZED_STATUSES = [ 'disconnected', 'connecting', 'connected' ];

	let coalesced: ConnectionStatus | undefined;

	for ( const status of Object.values( state.syncConnectionStatuses ) ) {
		if (
			! coalesced ||
			PRIORITIZED_STATUSES.indexOf( status.status ) <
				PRIORITIZED_STATUSES.indexOf( coalesced.status )
		) {
			coalesced = status;
		}
	}

	return coalesced;
}
