/**
 * WordPress dependencies
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

async function updateSiteSettings( { pageId, requestUtils } ) {
	return requestUtils.updateSiteSettings( {
		show_on_front: 'page',
		page_on_front: 0,
		page_for_posts: pageId,
	} );
}

test.describe( 'Template resolution', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.activateTheme( 'emptytheme' );
	} );

	test.afterEach( async ( { requestUtils } ) => {
		await Promise.all( [
			requestUtils.deleteAllPages(),
			requestUtils.updateSiteSettings( {
				show_on_front: 'posts',
				page_on_front: 0,
				page_for_posts: 0,
			} ),
		] );
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.activateTheme( 'twentytwentyone' );
	} );

	test( 'Site editor proper front page template resolution when we have only set posts page in settings', async ( {
		page,
		admin,
		requestUtils,
	} ) => {
		const newPage = await requestUtils.createPage( {
			title: 'Posts Page',
			status: 'publish',
		} );
		await updateSiteSettings( { requestUtils, pageId: newPage.id } );
		await admin.visitSiteEditor();
		await expect( page.locator( '.edit-site-canvas-loader' ) ).toHaveCount(
			0
		);
	} );

	test.describe( 'fixed page templates', () => {
		test.beforeAll( async ( { requestUtils } ) => {
			await requestUtils.activatePlugin(
				'gutenberg-test-fixed-page-templates'
			);
		} );

		test.beforeEach( async ( { requestUtils } ) => {
			await requestUtils.resetPreferences();
		} );

		test.afterAll( async ( { requestUtils } ) => {
			await requestUtils.deactivatePlugin(
				'gutenberg-test-fixed-page-templates'
			);
		} );

		test( 'locks template mode and template switching controls', async ( {
			page,
			admin,
			editor,
			requestUtils,
		} ) => {
			const fixedPage = await requestUtils.createPage( {
				title: 'Fixed Template Page',
				slug: 'fixed-template-page',
				status: 'publish',
			} );

			await admin.editPost( fixedPage.id );

			await expect
				.poll( async () =>
					page.evaluate( () =>
						window.wp.data
							.select( 'core/editor' )
							.getRenderingMode()
					)
				)
				.toBe( 'template-locked' );

			await editor.openDocumentSettingsSidebar();
			const templateOptionsButton = page
				.getByRole( 'region', { name: 'Editor settings' } )
				.getByRole( 'button', { name: 'Template options' } );
			await expect( templateOptionsButton ).toHaveText( 'Index' );

			await templateOptionsButton.click();
			await expect(
				page.getByRole( 'menuitemcheckbox', {
					name: 'Show template',
				} )
			).toHaveCount( 0 );
			await expect(
				page.getByRole( 'menuitem', { name: 'Create new template' } )
			).toHaveCount( 0 );
			await expect(
				page.getByRole( 'menuitem', { name: 'Use default template' } )
			).toHaveCount( 0 );
			await expect(
				page.getByRole( 'menuitem', { name: 'Change template' } )
			).toBeDisabled();
		} );
	} );

	test.describe( '`page_for_posts` setting', () => {
		test( 'Post editor proper template resolution', async ( {
			page,
			admin,
			editor,
			requestUtils,
		} ) => {
			const newPage = await requestUtils.createPage( {
				title: 'Posts Page',
				status: 'publish',
			} );
			await admin.editPost( newPage.id );
			await editor.openDocumentSettingsSidebar();
			await expect(
				page.getByRole( 'button', { name: 'Template options' } )
			).toHaveText( 'Single Entries' );
			await updateSiteSettings( { requestUtils, pageId: newPage.id } );
			await page.reload();
			await expect(
				page.getByRole( 'button', { name: 'Template options' } )
			).toHaveText( 'Index' );
		} );

		test( 'Site editor proper template resolution', async ( {
			page,
			editor,
			admin,
			requestUtils,
		} ) => {
			const newPage = await requestUtils.createPage( {
				title: 'Posts Page',
				status: 'publish',
			} );
			await updateSiteSettings( { requestUtils, pageId: newPage.id } );
			await admin.visitSiteEditor( {
				postId: newPage.id,
				postType: 'page',
				canvas: 'edit',
			} );
			await editor.openDocumentSettingsSidebar();
			await expect(
				page.getByRole( 'button', { name: 'Template options' } )
			).toHaveText( 'Index' );
		} );
	} );
} );
