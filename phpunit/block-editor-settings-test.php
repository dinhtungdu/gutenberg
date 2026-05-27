<?php
/**
 * Tests block editor settings helpers.
 *
 * @package gutenberg
 */

/**
 * Tests fixed page template registration.
 *
 * @covers Gutenberg_Fixed_Page_Template_Registry
 * @covers ::gutenberg_get_fixed_page_templates
 */
class Gutenberg_Block_Editor_Settings_Test extends WP_UnitTestCase {
	public function tear_down() {
		remove_all_actions( 'block_editor_register_fixed_page_templates' );
		update_option( 'show_on_front', 'posts' );
		update_option( 'page_for_posts', 0 );

		parent::tear_down();
	}

	public function test_fixed_page_template_registry_registers_templates() {
		$registry = new Gutenberg_Fixed_Page_Template_Registry();

		$this->assertTrue( $registry->register( 42, 'archive-product' ) );
		$this->assertSame(
			array(
				array(
					'id'           => 42,
					'templateSlug' => 'archive-product',
				),
			),
			$registry->get_registered()
		);
	}

	public function test_fixed_page_template_registry_keeps_first_registration() {
		$registry = new Gutenberg_Fixed_Page_Template_Registry();

		$this->assertTrue( $registry->register( 42, 'home' ) );
		$this->setExpectedIncorrectUsage( 'Gutenberg_Fixed_Page_Template_Registry::register' );
		$this->assertFalse( $registry->register( 42, 'archive-product' ) );
		$this->assertSame(
			array(
				array(
					'id'           => 42,
					'templateSlug' => 'home',
				),
			),
			$registry->get_registered()
		);
	}

	public function test_fixed_page_template_registry_ignores_duplicate_registration() {
		$registry = new Gutenberg_Fixed_Page_Template_Registry();

		$this->assertTrue( $registry->register( 42, 'home' ) );
		$this->assertFalse( $registry->register( 42, 'home' ) );
		$this->assertSame(
			array(
				array(
					'id'           => 42,
					'templateSlug' => 'home',
				),
			),
			$registry->get_registered()
		);
	}

	public function test_get_fixed_page_templates_registers_action_templates() {
		$page_id = self::factory()->post->create(
			array(
				'post_type' => 'page',
			)
		);

		add_action(
			'block_editor_register_fixed_page_templates',
			static function ( $registry ) use ( $page_id ) {
				$registry->register( $page_id, 'archive-product' );
			}
		);

		$this->assertSame(
			array(
				array(
					'id'           => $page_id,
					'templateSlug' => 'archive-product',
				),
			),
			gutenberg_get_fixed_page_templates()
		);
	}

	public function test_get_fixed_page_templates_keeps_posts_page_registration_first() {
		$page_id = self::factory()->post->create(
			array(
				'post_type' => 'page',
			)
		);
		update_option( 'show_on_front', 'page' );
		update_option( 'page_for_posts', $page_id );

		add_action(
			'block_editor_register_fixed_page_templates',
			static function ( $registry ) use ( $page_id ) {
				$registry->register( $page_id, 'archive-product' );
			}
		);

		$this->setExpectedIncorrectUsage( 'Gutenberg_Fixed_Page_Template_Registry::register' );
		$this->assertSame(
			array(
				array(
					'id'           => $page_id,
					'templateSlug' => 'home',
				),
			),
			gutenberg_get_fixed_page_templates()
		);
	}
}
