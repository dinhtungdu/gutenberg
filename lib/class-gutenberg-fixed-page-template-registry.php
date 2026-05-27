<?php
/**
 * Registry for pages that always use a specific block template.
 *
 * @package gutenberg
 */

/**
 * Registry for pages that always use a specific block template.
 */
class Gutenberg_Fixed_Page_Template_Registry {
	/**
	 * Fixed page template definitions.
	 *
	 * @var array
	 */
	private $fixed_page_templates = array();

	/**
	 * Registers a page that always uses a specific block template.
	 *
	 * The first registration for a page wins. Later registrations for the same
	 * page are ignored to prevent one integration from replacing another.
	 *
	 * @param int    $page_id       Page ID.
	 * @param string $template_slug Template slug.
	 * @return bool Whether the page template was registered.
	 */
	public function register( $page_id, $template_slug ) {
		$page_id       = (int) $page_id;
		$template_slug = sanitize_key( (string) $template_slug );

		if ( $page_id <= 0 || ! $template_slug ) {
			_doing_it_wrong(
				__METHOD__,
				__( 'Fixed page template registration requires a positive page ID and template slug.', 'gutenberg' ),
				'23.3.0'
			);
			return false;
		}

		if ( isset( $this->fixed_page_templates[ $page_id ] ) ) {
			$registered_template_slug = $this->fixed_page_templates[ $page_id ]['templateSlug'];
			if ( $registered_template_slug !== $template_slug ) {
				_doing_it_wrong(
					__METHOD__,
					sprintf(
						/* translators: 1: Page ID, 2: Existing template slug, 3: Ignored template slug. */
						__( 'Page ID %1$d is already registered with the "%2$s" fixed template. The "%3$s" registration was ignored.', 'gutenberg' ),
						$page_id,
						$registered_template_slug,
						$template_slug
					),
					'23.3.0'
				);
			}
			return false;
		}

		$this->fixed_page_templates[ $page_id ] = array(
			'id'           => $page_id,
			'templateSlug' => $template_slug,
		);
		return true;
	}

	/**
	 * Returns registered fixed page template definitions.
	 *
	 * @return array Fixed page template definitions.
	 */
	public function get_registered() {
		return array_values( $this->fixed_page_templates );
	}
}
