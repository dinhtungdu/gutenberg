<?php
/**
 * Plugin Name: Gutenberg Test Fixed Page Templates
 * Plugin URI: https://github.com/WordPress/gutenberg
 * Author: Gutenberg Team
 *
 * @package gutenberg-test-fixed-page-templates
 */

/**
 * Registers a fixed template page for e2e tests.
 *
 * @param array $fixed_page_templates Fixed page template definitions.
 * @return array Fixed page template definitions.
 */
function gutenberg_test_fixed_page_templates( $fixed_page_templates ) {
	$fixed_page = get_page_by_path( 'fixed-template-page' );

	if ( $fixed_page instanceof WP_Post ) {
		$fixed_page_templates[] = array(
			'id'            => $fixed_page->ID,
			'template_slug' => 'index',
		);
	}

	return $fixed_page_templates;
}
add_filter( 'block_editor_fixed_page_templates', 'gutenberg_test_fixed_page_templates' );
