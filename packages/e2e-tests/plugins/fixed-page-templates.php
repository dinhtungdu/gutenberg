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
 * @param Gutenberg_Fixed_Page_Template_Registry $registry Fixed page template registry.
 */
function gutenberg_test_fixed_page_templates( $registry ) {
	$fixed_page = get_page_by_path( 'fixed-template-page' );

	if ( $fixed_page instanceof WP_Post ) {
		$registry->register( $fixed_page->ID, 'index' );
	}
}
add_action( 'block_editor_register_fixed_page_templates', 'gutenberg_test_fixed_page_templates' );
