/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { PanelBody } from '@wordpress/components';
import { withSelect, withDispatch } from '@wordpress/data';
import { compose, ifCondition } from '@wordpress/compose';

/**
 * Internal dependencies
 */
import PostTrash from '../post-trash';
import PostSticky from '../post-sticky';
import PostAuthor from '../post-author';
import PostSlug from '../post-slug';
import PostPendingStatus from '../post-pending-status';
import PluginPostStatusInfo from '../plugin-post-status-info';

/**
 * Module Constants
 */
const PANEL_NAME = 'post-status';

function PostStatus( { isOpened, onTogglePanel } ) {
	return (
		<PanelBody
			className="edit-post-post-status"
			title={ __( 'General' ) }
			opened={ isOpened }
			onToggle={ onTogglePanel }
		>
			<PluginPostStatusInfo.Slot>
				{ ( fills ) => (
					<>
						<PostSticky />
						<PostPendingStatus />
						<PostSlug />
						<PostAuthor />
						{ fills }
						<PostTrash />
					</>
				) }
			</PluginPostStatusInfo.Slot>
		</PanelBody>
	);
}

export default compose( [
	withSelect( ( select ) => {
		// We use isEditorPanelRemoved to hide the panel if it was programatically removed. We do
		// not use isEditorPanelEnabled since this panel should not be disabled through the UI.
		const { isEditorPanelRemoved, isEditorPanelOpened } = select(
			'core/edit-post'
		);
		return {
			isRemoved: isEditorPanelRemoved( PANEL_NAME ),
			isOpened: isEditorPanelOpened( PANEL_NAME ),
		};
	} ),
	ifCondition( ( { isRemoved } ) => ! isRemoved ),
	withDispatch( ( dispatch ) => ( {
		onTogglePanel() {
			return dispatch( 'core/edit-post' ).toggleEditorPanelOpened(
				PANEL_NAME
			);
		},
	} ) ),
] )( PostStatus );
