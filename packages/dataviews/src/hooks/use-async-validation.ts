/**
 * WordPress dependencies
 */
import { useCallback, useEffect, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import type { Field, Form } from '../types';
import { isItemValidAsync } from '../utils/is-item-valid';

type AsyncValidationState = {
	isValid: boolean;
	isResolving: boolean;
	validate: () => Promise< boolean >;
};

type InternalState = {
	token: symbol | null;
	isValid: boolean;
	isResolving: boolean;
};

export function useAsyncValidation< Item >(
	item: Item,
	fields: Field< Item >[],
	form: Form
): AsyncValidationState {
	const [ state, setState ] = useState< InternalState >( {
		token: null,
		isValid: false,
		isResolving: true,
	} );

	const runValidation = useCallback( async () => {
		const token = Symbol( 'validation' );
		setState( ( prev ) => ( {
			token,
			isValid: prev.isValid,
			isResolving: true,
		} ) );

		try {
			const result = await isItemValidAsync( item, fields, form );
			setState( ( prev ) =>
				prev.token === token
					? {
							token: prev.token,
							isValid: result,
							isResolving: false,
					  }
					: prev
			);
			return result;
		} catch {
			setState( ( prev ) =>
				prev.token === token
					? {
							token: prev.token,
							isValid: false,
							isResolving: false,
					  }
					: prev
			);
			return false;
		}
	}, [ item, fields, form ] );

	useEffect( () => {
		runValidation();

		return () => {
			setState( ( prev ) => ( {
				token: prev.token,
				isValid: prev.isValid,
				isResolving: false,
			} ) );
		};
	}, [ runValidation ] );

	return {
		isValid: state.isValid,
		isResolving: state.isResolving,
		validate: runValidation,
	};
}
