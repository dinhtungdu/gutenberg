import CDP from 'chrome-remote-interface';
import type {
	Transport,
	Block,
	EditorState,
	ThemeStyles,
	ComputedLayout,
} from './types.js';

interface CDPClient {
	Runtime: {
		evaluate: ( params: {
			expression: string;
			returnByValue?: boolean;
			awaitPromise?: boolean;
		} ) => Promise< {
			result: { value?: unknown; objectId?: string };
			exceptionDetails?: unknown;
		} >;
		callFunctionOn: ( params: {
			functionDeclaration: string;
			objectId?: string;
			arguments?: Array< { value?: unknown; objectId?: string } >;
			returnByValue?: boolean;
			awaitPromise?: boolean;
		} ) => Promise< {
			result: { value?: unknown };
			exceptionDetails?: unknown;
		} >;
	};
	Page: {
		captureScreenshot: ( params?: {
			format?: string;
			quality?: number;
			clip?: {
				x: number;
				y: number;
				width: number;
				height: number;
				scale: number;
			};
		} ) => Promise< { data: string } >;
	};
	DOM: {
		getDocument: () => Promise< { root: { nodeId: number } } >;
		querySelector: ( params: {
			nodeId: number;
			selector: string;
		} ) => Promise< { nodeId: number } >;
		getBoxModel: ( params: { nodeId: number } ) => Promise< {
			model: { content: number[]; width: number; height: number };
		} >;
	};
	close: () => Promise< void >;
}

export interface CDPTransportOptions {
	/** WebSocket URL, e.g. ws://localhost:9222 */
	target: string;
}

export class CDPTransport implements Transport {
	private client: CDPClient | null = null;
	private options: CDPTransportOptions;

	constructor( options: CDPTransportOptions ) {
		this.options = options;
	}

	async connect(): Promise< void > {
		const url = new URL( this.options.target );
		const host = url.hostname || 'localhost';
		const port = parseInt( url.port, 10 ) || 9222;

		const cdpOptions: { host: string; port: number; target?: string } = {
			host,
			port,
		};

		if ( url.pathname && url.pathname !== '/' ) {
			cdpOptions.target = this.options.target;
		} else {
			// Auto-detect the WordPress site editor tab.
			const tabs = await ( CDP as any ).List( { host, port } );
			const siteEditorTab = tabs.find(
				( t: { url: string; type?: string } ) =>
					t.type === 'page' && t.url.includes( 'site-editor' )
			);
			if ( siteEditorTab ) {
				cdpOptions.target = siteEditorTab;
			}
		}

		this.client = ( await CDP( cdpOptions ) ) as unknown as CDPClient;
	}

	async disconnect(): Promise< void > {
		if ( this.client ) {
			await this.client.close();
			this.client = null;
		}
	}

	/**
	 * Execute a function in the browser page context with serialized arguments.
	 * Uses Runtime.callFunctionOn to avoid string interpolation / injection risks.
	 *
	 * @param fn   Function source to execute in the page context.
	 * @param args Arguments to pass to the function (serialized via CDP protocol).
	 */
	private async callInPage< T >(
		fn: string,
		...args: unknown[]
	): Promise< T > {
		if ( ! this.client ) {
			throw new Error( 'CDP not connected. Call connect() first.' );
		}

		// Get a reference to the global (window) object
		const globalRef = await this.client.Runtime.evaluate( {
			expression: 'globalThis',
			returnByValue: false,
		} );

		const objectId = globalRef.result.objectId;
		if ( ! objectId ) {
			throw new Error( 'Could not get global object reference' );
		}

		const { result, exceptionDetails } =
			await this.client.Runtime.callFunctionOn( {
				objectId,
				functionDeclaration: `async function() { return (${ fn }).apply(null, arguments); }`,
				arguments: args.map( ( arg ) => ( { value: arg } ) ),
				returnByValue: true,
				awaitPromise: true,
			} );

		if ( exceptionDetails ) {
			throw new Error(
				`CDP error: ${ JSON.stringify( exceptionDetails ) }`
			);
		}
		return result.value as T;
	}

	async getEditorState(): Promise< EditorState > {
		return this.callInPage< EditorState >(
			`function() {
				const blockEditorSelect = window.wp.data.select("core/block-editor");
				const selectedClientId = blockEditorSelect.getSelectedBlockClientId();
				const selectedName = selectedClientId ? blockEditorSelect.getBlockName(selectedClientId) : undefined;

				let templateSlug, templateType, pageId, pageTitle, editedEntityType, editedEntityId;
				try {
					const editSiteSelect = window.wp.data.select("core/edit-site");
					if (editSiteSelect) {
						const context = editSiteSelect.getEditedPostContext?.() || {};
						templateSlug = editSiteSelect.getEditedPostSlug?.();
						templateType = editSiteSelect.getEditedPostType?.();
						editedEntityType = templateType;
						editedEntityId = editSiteSelect.getEditedPostId?.();
						pageId = context.postId;
					}
				} catch(e) {}

				try {
					const coreEditorSelect = window.wp.data.select("core/editor");
					if (coreEditorSelect && !templateSlug) {
						editedEntityType = coreEditorSelect.getCurrentPostType?.();
						editedEntityId = coreEditorSelect.getCurrentPostId?.();
					}
				} catch(e) {}

				const isDirty = window.wp.data.select("core")?.hasEditsForEntityRecord?.("postType", editedEntityType || "wp_template", editedEntityId) || false;

				return {
					templateSlug,
					templateType,
					pageId,
					pageTitle,
					editedEntityType,
					editedEntityId,
					isDirty,
					selectedBlockClientId: selectedClientId || undefined,
					selectedBlockName: selectedName || undefined,
				};
			}`
		);
	}

	async openDocument( args: {
		type: 'template' | 'page' | 'template-part' | 'pattern';
		slug?: string;
		id?: number;
	} ): Promise< { success: boolean; message: string } > {
		return this.callInPage(
			`async function(type, slug, id) {
				const coreSelect = window.wp.data.select("core");
				const coreResolve = window.wp.data.resolveSelect("core");

				// For pages, resolve slug to post ID if needed.
				if (type === "page" && slug && !id) {
					await coreResolve.getEntityRecords("postType", "page", { slug: slug, per_page: 1 });
					const pages = coreSelect.getEntityRecords("postType", "page", { slug: slug, per_page: 1 });
					if (pages && pages.length > 0) {
						id = pages[0].id;
					} else {
						return { success: false, message: "Page not found: " + slug };
					}
				}

				// For templates/template-parts, resolve short slug to full theme//slug ID.
				if ((type === "template" || type === "template-part") && slug && !slug.includes("//")) {
					const postType = type === "template" ? "wp_template" : "wp_template_part";
					await coreResolve.getEntityRecords("postType", postType, { per_page: -1 });
					const records = coreSelect.getEntityRecords("postType", postType, { per_page: -1 });
					if (records) {
						const slugLower = slug.toLowerCase();
						const match = records.find(r =>
							r.slug === slug ||
							r.id === slug ||
							(r.title && (r.title.rendered || r.title.raw || "").toLowerCase().replace(/\\s+/g, "-") === slugLower) ||
							(r.title && (r.title.rendered || r.title.raw || "").toLowerCase() === slugLower.replace(/-/g, " "))
						);
						if (match) {
							slug = match.id;
						} else {
							const available = records.map(r => r.slug).join(", ");
							return { success: false, message: "Template not found: " + slug + ". Available: " + available };
						}
					}
				}

				let routePath;
				if (type === "template") {
					routePath = "/wp_template/" + (slug || id);
				} else if (type === "template-part") {
					routePath = "/wp_template_part/" + (slug || id);
				} else if (type === "pattern") {
					routePath = "/wp_block/" + (slug || id);
				} else if (type === "page") {
					if (!id) return { success: false, message: "Page ID is required" };
					routePath = "/page/" + id;
				}

				// Replicate the site editor's history.navigate() behavior:
				// 1. Build search string the same way useHistory().navigate does
				//    (using wp.url.buildQueryString with pathArg "p")
				// 2. Push state with idx/key matching createBrowserHistory format
				// 3. Dispatch popstate so the history library's listener fires
				const search = window.wp.url.buildQueryString({
					p: routePath,
					canvas: "edit",
				});
				const newUrl = window.location.pathname + "?" + search;
				const currentIdx = (window.history.state && window.history.state.idx) || 0;
				const newState = {
					usr: null,
					key: Math.random().toString(36).slice(2, 10),
					idx: currentIdx + 1,
				};
				window.history.pushState(newState, "", newUrl);
				window.dispatchEvent(new PopStateEvent("popstate", { state: newState }));

				return { success: true, message: "Navigated to " + type + " " + (slug || id) + " (editor may still be loading)" };
			}`,
			args.type,
			args.slug,
			args.id
		);
	}

	async getBlocks( args?: {
		rootClientId?: string;
		blockName?: string;
	} ): Promise< Block[] > {
		return this.callInPage< Block[] >(
			`function(rootClientId, blockName) {
				const select = window.wp.data.select("core/block-editor");

				function serializeBlock(block) {
					return {
						clientId: block.clientId,
						name: block.name,
						attributes: block.attributes,
						innerBlocks: (block.innerBlocks || []).map(serializeBlock),
					};
				}

				let blocks;
				if (blockName) {
					const ids = select.getBlocksByName(blockName);
					blocks = ids.map(id => select.getBlock(id)).filter(Boolean);
				} else {
					blocks = select.getBlocks(rootClientId || undefined);
				}

				return blocks.map(serializeBlock);
			}`,
			args?.rootClientId ?? null,
			args?.blockName ?? null
		);
	}

	async insertBlocks( args: {
		blocks: Array< {
			name: string;
			attributes?: Record< string, unknown >;
			innerBlocks?: Array< {
				name: string;
				attributes?: Record< string, unknown >;
			} >;
		} >;
		rootClientId?: string;
		index?: number;
	} ): Promise< { clientIds: string[] } > {
		return this.callInPage(
			`async function(blockDefs, rootClientId, index) {
				function createBlockRecursive(def) {
					const innerBlocks = (def.innerBlocks || []).map(createBlockRecursive);
					return window.wp.blocks.createBlock(def.name, def.attributes || {}, innerBlocks);
				}

				const blocks = blockDefs.map(createBlockRecursive);
				const dispatch = window.wp.data.dispatch("core/block-editor");

				if (index !== null) {
					await dispatch.insertBlocks(blocks, index, rootClientId || undefined);
				} else {
					await dispatch.insertBlocks(blocks, undefined, rootClientId || undefined);
				}

				return { clientIds: blocks.map(b => b.clientId) };
			}`,
			args.blocks,
			args.rootClientId ?? null,
			args.index ?? null
		);
	}

	async updateBlock( args: {
		clientId: string;
		attributes: Record< string, unknown >;
	} ): Promise< { success: boolean } > {
		return this.callInPage(
			`async function(clientId, attributes) {
				await window.wp.data.dispatch("core/block-editor").updateBlockAttributes(clientId, attributes);
				return { success: true };
			}`,
			args.clientId,
			args.attributes
		);
	}

	async removeBlocks( args: {
		clientIds: string[];
	} ): Promise< { success: boolean } > {
		return this.callInPage(
			`async function(clientIds) {
				await window.wp.data.dispatch("core/block-editor").removeBlocks(clientIds);
				return { success: true };
			}`,
			args.clientIds
		);
	}

	async replaceBlocks( args: {
		clientIds: string[];
		blocks: Array< {
			name: string;
			attributes?: Record< string, unknown >;
			innerBlocks?: Array< {
				name: string;
				attributes?: Record< string, unknown >;
			} >;
		} >;
	} ): Promise< { success: boolean } > {
		return this.callInPage(
			`async function(clientIds, blockDefs) {
				function createBlockRecursive(def) {
					const innerBlocks = (def.innerBlocks || []).map(createBlockRecursive);
					return window.wp.blocks.createBlock(def.name, def.attributes || {}, innerBlocks);
				}

				const blocks = blockDefs.map(createBlockRecursive);
				await window.wp.data.dispatch("core/block-editor").replaceBlocks(clientIds, blocks);
				return { success: true };
			}`,
			args.clientIds,
			args.blocks
		);
	}

	async save(): Promise< { success: boolean; message: string } > {
		return this.callInPage(
			`async function() {
				try {
					const editorDispatch = window.wp.data.dispatch("core/editor");
					if (editorDispatch?.savePost) {
						await editorDispatch.savePost();
						return { success: true, message: "Saved via core/editor" };
					}
					const editSiteDispatch = window.wp.data.dispatch("core/edit-site");
					if (editSiteDispatch?.saveEditedEntityRecord) {
						await editSiteDispatch.saveEditedEntityRecord();
						return { success: true, message: "Saved via core/edit-site" };
					}
					return { success: false, message: "No save method available" };
				} catch(e) {
					return { success: false, message: e.message };
				}
			}`
		);
	}

	async getStyles(): Promise< ThemeStyles > {
		return this.callInPage< ThemeStyles >(
			`function() {
				const globalStyles = window.wp.data.select("core")
					?.getEditedEntityRecord("root", "globalStyles", window.wp.data.select("core/edit-site")?.getSettings?.()?.globalStylesId);
				if (globalStyles) {
					return {
						settings: globalStyles.settings || {},
						styles: globalStyles.styles || {},
						version: globalStyles.version,
					};
				}
				const settings = window.wp.data.select("core/block-editor").getSettings();
				return {
					settings: settings.__experimentalFeatures || {},
					styles: {},
				};
			}`
		);
	}

	async setStyles( args: {
		settings?: Record< string, unknown >;
		styles?: Record< string, unknown >;
	} ): Promise< { success: boolean } > {
		return this.callInPage(
			`async function(newSettings, newStyles) {
				const globalStylesId = window.wp.data.select("core/edit-site")?.getSettings?.()?.globalStylesId;
				if (!globalStylesId) return { success: false };

				const edits = {};
				if (newSettings) edits.settings = newSettings;
				if (newStyles) edits.styles = newStyles;

				await window.wp.data.dispatch("core").editEntityRecord("root", "globalStyles", globalStylesId, edits);
				return { success: true };
			}`,
			args.settings ?? null,
			args.styles ?? null
		);
	}

	async getScreenshot( args?: {
		selector?: string;
		fullPage?: boolean;
	} ): Promise< { base64: string; mimeType: string } > {
		if ( ! this.client ) {
			throw new Error( 'CDP not connected' );
		}

		let clip:
			| {
					x: number;
					y: number;
					width: number;
					height: number;
					scale: number;
			  }
			| undefined;

		if ( args?.selector ) {
			const doc = await this.client.DOM.getDocument();
			const node = await this.client.DOM.querySelector( {
				nodeId: doc.root.nodeId,
				selector: args.selector,
			} );
			if ( node.nodeId ) {
				const box = await this.client.DOM.getBoxModel( {
					nodeId: node.nodeId,
				} );
				clip = {
					x: box.model.content[ 0 ],
					y: box.model.content[ 1 ],
					width: box.model.width,
					height: box.model.height,
					scale: 1,
				};
			}
		}

		const screenshot = await this.client.Page.captureScreenshot( {
			format: 'png',
			...( clip ? { clip } : {} ),
		} );

		return { base64: screenshot.data, mimeType: 'image/png' };
	}

	async getComputedLayout( args: {
		clientIds: string[];
		properties?: string[];
	} ): Promise< ComputedLayout[] > {
		return this.callInPage< ComputedLayout[] >(
			`function(clientIds, properties) {
				const results = [];
				for (const clientId of clientIds) {
					const el = document.querySelector('[data-block="' + clientId + '"]');
					if (!el) {
						results.push({ clientId, tagName: 'unknown', boundingRect: { x: 0, y: 0, width: 0, height: 0 }, computedStyle: {} });
						continue;
					}
					const rect = el.getBoundingClientRect();
					const style = window.getComputedStyle(el);
					const computedStyle = {};
					for (const prop of properties) {
						computedStyle[prop] = style.getPropertyValue(prop);
					}
					results.push({
						clientId,
						tagName: el.tagName.toLowerCase(),
						boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
						computedStyle,
					});
				}
				return results;
			}`,
			args.clientIds,
			args.properties ?? [
				'display',
				'position',
				'width',
				'height',
				'margin',
				'padding',
				'gap',
			]
		);
	}

	async parseMarkup( args: {
		markup: string;
	} ): Promise< { blocks: Block[]; isValid: boolean } > {
		return this.callInPage(
			`function(markup) {
				const parsed = window.wp.blocks.parse(markup);

				function serializeBlock(block) {
					return {
						clientId: block.clientId,
						name: block.name,
						attributes: block.attributes,
						innerBlocks: (block.innerBlocks || []).map(serializeBlock),
					};
				}

				const blocks = parsed.map(serializeBlock);
				const isValid = parsed.every(b => b.isValid !== false);
				return { blocks, isValid };
			}`,
			args.markup
		);
	}

	async exportTemplate(): Promise< { html: string } > {
		return this.callInPage(
			`function() {
				const blocks = window.wp.data.select("core/block-editor").getBlocks();
				const html = window.wp.blocks.serialize(blocks);
				return { html };
			}`
		);
	}
}
