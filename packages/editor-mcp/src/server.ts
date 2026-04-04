import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	ListToolsRequestSchema,
	CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from './transports/types.js';
import { tools } from './tools/index.js';

function loadBuilderGuide(): string {
	const __dirname = dirname( fileURLToPath( import.meta.url ) );
	const guidePath = resolve( __dirname, '..', 'BUILDER_GUIDE.md' );
	try {
		return readFileSync( guidePath, 'utf-8' );
	} catch {
		return '';
	}
}

export interface ServerOptions {
	transport: Transport;
}

export async function createServer(
	options: ServerOptions
): Promise< Server > {
	const { transport } = options;

	const server = new Server(
		{ name: 'wordpress-editor', version: '0.1.0' },
		{
			capabilities: { tools: {} },
			instructions: loadBuilderGuide(),
		}
	);

	// List tools handler
	server.setRequestHandler( ListToolsRequestSchema, async () => ( {
		tools: tools.map( ( t ) => ( {
			name: t.name,
			description: t.description,
			inputSchema: t.inputSchema,
		} ) ),
	} ) );

	// Call tool handler
	server.setRequestHandler( CallToolRequestSchema, async ( request ) => {
		const { name, arguments: args } = request.params;
		const tool = tools.find( ( t ) => t.name === name );

		if ( ! tool ) {
			return {
				content: [
					{ type: 'text' as const, text: `Unknown tool: ${ name }` },
				],
				isError: true,
			};
		}

		try {
			return await tool.handler( args ?? {}, transport );
		} catch ( error: unknown ) {
			const message =
				error instanceof Error ? error.message : String( error );
			return {
				content: [
					{ type: 'text' as const, text: `Error: ${ message }` },
				],
				isError: true,
			};
		}
	} );

	return server;
}

export async function startServer( options: ServerOptions ): Promise< void > {
	const { transport } = options;

	// Connect transport
	await transport.connect();

	const server = await createServer( options );
	const mcpTransport = new StdioServerTransport();

	await server.connect( mcpTransport );

	// Handle shutdown
	process.on( 'SIGINT', async () => {
		await transport.disconnect();
		process.exit( 0 );
	} );
	process.on( 'SIGTERM', async () => {
		await transport.disconnect();
		process.exit( 0 );
	} );
}
