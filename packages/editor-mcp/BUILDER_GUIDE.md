# Site Editor Builder Guide

Reference for AI agents building WordPress block themes via the editor-mcp server.

## References

Before using this guide, familiarize yourself with:

- **Block themes**: https://developer.wordpress.org/themes/
- **Block API reference**: `docs/reference-guides/block-api/` — block attributes, supports, registration
- **Block supports**: `docs/reference-guides/block-api/block-supports.md` — style attributes (color, typography, spacing, border, shadow, dimensions)
- **theme.json**: `docs/reference-guides/theme-json-reference/theme-json-living.md` — global styles and settings schema
- **Core blocks reference**: `docs/reference-guides/core-blocks.md` — all available blocks with attributes
- **Theme how-to guides**: `docs/how-to-guides/themes/` — theme development patterns

Use `wp_lookup_block` to query any block's schema at runtime — this is more reliable than static docs.

---

## MCP Tools

| Tool | Purpose |
|------|---------|
| `wp_open_document` | Navigate to a template, page, template-part, or pattern |
| `wp_get_editor_state` | Current document type/ID, dirty state, selected block |
| `wp_get_blocks` | Read the block tree (optionally filtered) |
| `wp_insert_blocks` | Insert blocks by name + attributes |
| `wp_update_block` | Update attributes on an existing block |
| `wp_replace_blocks` | Swap blocks with new ones |
| `wp_remove_blocks` | Delete blocks by clientId |
| `wp_lookup_block` | Query block schema: attributes, supports, keywords |
| `wp_parse_markup` | Validate block markup before inserting |
| `wp_get_styles` | Read theme.json global styles and settings |
| `wp_set_styles` | Update global styles (colors, typography, spacing) |
| `wp_get_screenshot` | Capture the editor canvas for visual verification |
| `wp_get_computed_layout` | Get bounding rects and computed CSS for blocks |
| `wp_save` | Persist all changes to the database |
| `wp_export` | Export current document as serialized block HTML |

---

## Workflow

```
1. wp_open_document  → navigate to template/page
2. wp_get_blocks     → read current block tree
3. wp_lookup_block   → check block schema before inserting
4. wp_insert_blocks  → add new blocks (or wp_replace_blocks / wp_update_block)
5. wp_get_screenshot → verify the result visually
6. wp_save           → persist changes
```

**Always verify visually.** After every insert/update/replace, call `wp_get_screenshot` to confirm the result matches intent. Use `wp_get_computed_layout` to check specific layout metrics when precision matters.

### Navigation

```jsonc
// Open a template by short slug (auto-resolves theme prefix)
wp_open_document({ type: "template", slug: "home" })

// Open a page by slug (auto-resolves to post ID)
wp_open_document({ type: "page", slug: "sample-page" })

// Open by ID
wp_open_document({ type: "page", id: 42 })
wp_open_document({ type: "template-part", slug: "header" })
```

### Reading & Modifying Blocks

```jsonc
// Get full block tree
wp_get_blocks()

// Filter by block name
wp_get_blocks({ blockName: "core/heading" })

// Get children of a specific block
wp_get_blocks({ rootClientId: "abc-123" })

// Insert blocks (with nesting)
wp_insert_blocks({
  blocks: [{
    name: "core/buttons",
    innerBlocks: [
      { name: "core/button", attributes: { text: "Get Started", url: "/start" } }
    ]
  }]
})

// Insert inside a specific parent at position 0
wp_insert_blocks({
  blocks: [{ name: "core/paragraph", attributes: { content: "First!" } }],
  rootClientId: "parent-block-id",
  index: 0
})
```

### Block Lookup

Always check a block's schema before writing markup for unfamiliar blocks:

```jsonc
wp_lookup_block({ query: "core/cover" })          // by name
wp_lookup_block({ query: "hero", search: true })   // by keyword
wp_lookup_block({ query: "", listAll: true })       // list all blocks
```

### Global Styles

```jsonc
// Read merged theme.json (theme defaults + user customizations)
wp_get_styles()
// Returns: { settings, styles, version }

// Update color palette
wp_set_styles({
  settings: {
    color: {
      palette: [
        { slug: "primary", name: "Primary", color: "#1a1a2e" },
        { slug: "accent", name: "Accent", color: "#e94560" }
      ]
    }
  }
})
```

See the theme.json reference for the full settings/styles schema.

---

## MCP-Specific Gotchas

### skipSerialization Blocks

Most blocks: set JSON attributes and block supports generate correct HTML automatically.

These blocks serialize some style properties **manually** in their `save.js` — their markup won't match what you'd expect from the schema alone. Run `wp_lookup_block` and read the output carefully before writing markup for them:

| Block | Skipped Properties |
|-------|-------------------|
| **core/button** | color, typography, spacing, shadow, dimensions |
| **core/cover** | color |
| **core/image** | shadow |
| **core/separator** | color |
| **core/icon** | color, spacing, dimensions |
| **core/navigation** | typography |
| **core/search** | color, typography |
| **core/table** | color |
| **core/calendar** | color |
| **core/gallery** | spacing |
| **core/accordion-heading** | typography, spacing |
| **core/comment-author-avatar** | spacing |
| **core/post-featured-image** | shadow |

### Parent-Child Block Relationships

Some blocks can only exist inside specific parent blocks. Inserting them at the wrong level will fail silently or produce broken markup:

| Child Block | Required Parent |
|---|---|
| `core/button` | `core/buttons` |
| `core/column` | `core/columns` |
| `core/navigation-link` | `core/navigation` |
| `core/list-item` | `core/list` |
| `core/social-link` | `core/social-links` |
| `core/post-template` | `core/query` |
| `core/query-pagination-*` | `core/query-pagination` |
| `core/accordion-item` | `core/accordion` |
| `core/tab-panel` | `core/tabs` |

### Group Layout Types

The `core/group` block's `layout` attribute controls child arrangement — this is the primary layout mechanism:

```jsonc
// Constrained — centered content with max-width (default for page content)
{ layout: { type: "constrained" } }

// Flex Row — horizontal layout
{ layout: { type: "flex", flexWrap: "nowrap" } }

// Flex Row with alignment
{ layout: { type: "flex", justifyContent: "space-between", verticalAlignment: "center" } }

// Stack — vertical layout
{ layout: { type: "flex", orientation: "vertical" } }

// Grid — fixed columns
{ layout: { type: "grid", columnCount: 3, minimumColumnWidth: null } }

// Grid — responsive auto-fill
{ layout: { type: "grid", minimumColumnWidth: "250px", columnCount: null } }
```

### Named Presets vs Custom Values

- `"backgroundColor": "primary"` → theme palette preset
- `"style": { "color": { "background": "#1a1a2e" } }` → custom value

Same pattern applies for `textColor`/`style.color.text`, `fontSize`/`style.typography.fontSize`, etc. Check `wp_get_styles` to see available preset slugs.

### Template Structure

Templates typically reference shared template-parts for header/footer:

```jsonc
wp_insert_blocks({
  blocks: [
    { name: "core/template-part", attributes: { slug: "header", tagName: "header" } },
    { name: "core/group", attributes: { layout: { type: "constrained" } }, innerBlocks: [
      // ... page content ...
    ]},
    { name: "core/template-part", attributes: { slug: "footer", tagName: "footer" } }
  ]
})
```
