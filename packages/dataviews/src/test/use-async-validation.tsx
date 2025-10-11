/**
 * External dependencies
 */
import { renderHook, waitFor, act } from '@testing-library/react';

/**
 * Internal dependencies
 */
import { useAsyncValidation } from '../hooks/use-async-validation';
import type { Field, Form } from '../types';

const optionDraft = { value: 'draft', label: 'Draft' };
const optionPublished = { value: 'published', label: 'Published' };

describe( 'useAsyncValidation', () => {
	const fields: Field< { status: string } >[] = [
		{
			id: 'status',
			type: 'text',
			elements: () => Promise.resolve( [ optionDraft, optionPublished ] ),
			isValid: {
				elements: true,
			},
		},
	];
	const form: Form = {
		fields: [ 'status' ],
	};

	it( 'marks item as valid once async elements resolve', async () => {
		const item = { status: 'draft' };
		const { result } = renderHook( () =>
			useAsyncValidation( item, fields, form )
		);

		expect( result.current.isResolving ).toBe( true );

		await waitFor( () => {
			expect( result.current.isValid ).toBe( true );
		} );
		expect( result.current.isResolving ).toBe( false );
	} );

	it( 'updates validity when item changes and supports manual validation', async () => {
		const { result, rerender } = renderHook(
			( props: { item: { status: string } } ) =>
				useAsyncValidation( props.item, fields, form ),
			{
				initialProps: {
					item: { status: 'draft' },
				},
			}
		);

		await waitFor( () => {
			expect( result.current.isValid ).toBe( true );
		} );

		rerender( { item: { status: 'invalid' } } );

		await waitFor( () => {
			expect( result.current.isValid ).toBe( false );
		} );

		await act( async () => {
			const manualResult = await result.current.validate();
			expect( manualResult ).toBe( false );
		} );
	} );
} );
