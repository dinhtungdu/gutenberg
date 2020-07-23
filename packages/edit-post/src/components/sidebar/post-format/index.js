/**
 * WordPress dependencies
 */
import { PanelBody } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import {
	PostFormat as PostFormatForm,
	PostFormatCheck,
} from '@wordpress/editor';
import { __ } from '@wordpress/i18n';

const PANEL_NAME = 'post-format';

export default function PostFormat() {
	const { isOpened, isRemoved } = useSelect( ( select ) => {
		// We use isEditorPanelRemoved to hide the panel if it was
		// programatically removed. We don't use isEditorPanelEnabled since
		// this panel should not be disabled through the UI.
		const { isEditorPanelRemoved, isEditorPanelOpened } = select(
			'core/edit-post'
		);

		return {
			isOpened: isEditorPanelOpened( PANEL_NAME ),
			isRemoved: isEditorPanelRemoved( PANEL_NAME ),
		};
	}, [] );

	const { toggleEditorPanelOpened } = useDispatch( 'core/edit-post' );

	if ( isRemoved ) {
		return null;
	}

	return (
		<PostFormatCheck>
			<PanelBody
				initialOpen={ false }
				opened={ isOpened }
				onToggle={ () => {
					toggleEditorPanelOpened( PANEL_NAME );
				} }
				title={ __( 'Post Format' ) }
			>
				<PostFormatForm />
			</PanelBody>
		</PostFormatCheck>
	);
}
