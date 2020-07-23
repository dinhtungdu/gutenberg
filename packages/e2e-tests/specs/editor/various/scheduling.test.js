/**
 * WordPress dependencies
 */
import {
	createNewPost,
	findSidebarPanelWithTitle,
} from '@wordpress/e2e-test-utils';

describe( 'Scheduling', () => {
	beforeEach( createNewPost );

	const isDateTimeComponentFocused = () => {
		return page.evaluate( () => {
			const dateTimeElement = document.querySelector(
				'.components-datetime__date'
			);
			if ( ! dateTimeElement || ! document.activeElement ) {
				return false;
			}
			return dateTimeElement.contains( document.activeElement );
		} );
	};

	it( 'Should keep date time UI focused when the previous and next month buttons are clicked', async () => {
		const panelToggle = await findSidebarPanelWithTitle( 'Publish:' );
		await panelToggle.click();
		await page.click(
			'div[aria-label="Move backward to switch to the previous month."]'
		);
		expect( await isDateTimeComponentFocused() ).toBe( true );
		await page.click(
			'div[aria-label="Move forward to switch to the next month."]'
		);
		expect( await isDateTimeComponentFocused() ).toBe( true );
	} );
} );
