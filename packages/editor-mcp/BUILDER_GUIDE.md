# Site Editor Builder Guide

Reference for AI agents building WordPress block themes via the editor-mcp server.

---

## Core Concept

Block themes = HTML with comment delimiters (`<!-- wp:block-name {"attr":"val"} -->...<!-- /wp:block-name -->`). Blocks are semantic HTML elements with a shared style attribute schema. Know the schema, write any design.

**Approach**: Navigate to document → read blocks → insert/update/replace blocks → verify with screenshot → save.

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

## Typical Workflow

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
// → Navigates to twentytwentyfive//home

// Open a page by slug (auto-resolves to post ID)
wp_open_document({ type: "page", slug: "sample-page" })

// Open by ID
wp_open_document({ type: "page", id: 42 })
wp_open_document({ type: "template-part", slug: "header" })
```

### Reading Blocks

```jsonc
// Get full block tree
wp_get_blocks()

// Filter by block name
wp_get_blocks({ blockName: "core/heading" })

// Get children of a specific block
wp_get_blocks({ rootClientId: "abc-123" })
```

### Inserting Blocks

```jsonc
// Insert a heading and paragraph
wp_insert_blocks({
  blocks: [
    { name: "core/heading", attributes: { content: "Hello World", level: 2 } },
    { name: "core/paragraph", attributes: { content: "Welcome to my site." } }
  ]
})

// Insert inside a specific parent block at position 0
wp_insert_blocks({
  blocks: [{ name: "core/paragraph", attributes: { content: "First!" } }],
  rootClientId: "parent-block-id",
  index: 0
})

// Nested blocks
wp_insert_blocks({
  blocks: [{
    name: "core/buttons",
    innerBlocks: [
      { name: "core/button", attributes: { text: "Get Started", url: "/start" } }
    ]
  }]
})
```

### Block Lookup

Always check a block's schema before writing markup for unfamiliar blocks:

```jsonc
// Look up by name
wp_lookup_block({ query: "core/cover" })

// Search by keyword
wp_lookup_block({ query: "hero", search: true })

// List all available blocks
wp_lookup_block({ query: "", listAll: true })
```

---

## Universal Style Attribute Schema

Almost every block accepts the same `style` JSON structure in its attributes:

```json
{
  "style": {
    "color": { "background": "#fff", "text": "#000", "gradient": "linear-gradient(...)" },
    "typography": {
      "fontSize": "1.5rem",
      "fontWeight": "700",
      "fontFamily": "Inter, sans-serif",
      "fontStyle": "normal",
      "lineHeight": "1.4",
      "letterSpacing": "-0.02em",
      "textTransform": "uppercase",
      "textDecoration": "none"
    },
    "spacing": {
      "padding": { "top": "20px", "right": "20px", "bottom": "20px", "left": "20px" },
      "margin": { "top": "0", "bottom": "0" },
      "blockGap": "16px"
    },
    "border": {
      "width": "1px",
      "style": "solid",
      "color": "#eee",
      "radius": "12px"
    },
    "shadow": "0 2px 8px rgba(0,0,0,0.1)",
    "dimensions": { "minHeight": "400px" }
  }
}
```

**Named presets** use top-level attributes alongside style:
- `"backgroundColor": "primary"` → uses theme palette color
- `"textColor": "white"` → uses theme text color
- `"fontSize": "large"` → uses theme font size preset
- Custom values go in `style.color.background`, `style.typography.fontSize`, etc.

Check `wp_get_styles` to see available preset slugs for the active theme.

---

## Group Layout Types

The `core/group` block is the primary layout container. Its `layout` attribute controls how children are arranged:

```jsonc
// Constrained — centered content with max-width (default for page content)
{ name: "core/group", attributes: { layout: { type: "constrained" } } }

// Flex Row — horizontal layout (like flexbox row)
{ name: "core/group", attributes: { layout: { type: "flex", flexWrap: "nowrap" } } }

// Flex Row with alignment
{ name: "core/group", attributes: {
  layout: { type: "flex", justifyContent: "space-between", verticalAlignment: "center" }
}}

// Stack — vertical layout (like flexbox column)
{ name: "core/group", attributes: { layout: { type: "flex", orientation: "vertical" } } }

// Grid — CSS grid layout
{ name: "core/group", attributes: {
  layout: { type: "grid", columnCount: 3, minimumColumnWidth: null }
}}

// Grid with auto-fill (responsive)
{ name: "core/group", attributes: {
  layout: { type: "grid", minimumColumnWidth: "250px", columnCount: null }
}}
```

The `core/columns` block is a simpler alternative for multi-column layouts — it creates `core/column` children with optional `width` attributes (e.g. `"33.33%"`).

---

## skipSerialization — The 13 Tricky Blocks

Most blocks: set JSON attributes → block supports generate correct HTML. Done.

These 13 blocks serialize some properties **manually** in `save.js`. Run `wp_lookup_block` and read the output before writing markup:

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

All other blocks: standard schema works perfectly.

---

## Parent-Child Block Relationships

Some blocks can only exist inside specific parent blocks:

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

---

## Common Block Patterns

### Hero Section

```jsonc
wp_insert_blocks({
  blocks: [{
    name: "core/cover",
    attributes: {
      dimRatio: 50,
      minHeight: 600,
      align: "full"
    },
    innerBlocks: [
      { name: "core/heading", attributes: { content: "Welcome", level: 1, textAlign: "center" } },
      { name: "core/buttons", innerBlocks: [
        { name: "core/button", attributes: { text: "Get Started" } }
      ]}
    ]
  }]
})
```

### Two-Column Layout

```jsonc
wp_insert_blocks({
  blocks: [{
    name: "core/columns",
    innerBlocks: [
      { name: "core/column", innerBlocks: [
        { name: "core/heading", attributes: { content: "Left", level: 3 } },
        { name: "core/paragraph", attributes: { content: "Left column content." } }
      ]},
      { name: "core/column", innerBlocks: [
        { name: "core/heading", attributes: { content: "Right", level: 3 } },
        { name: "core/paragraph", attributes: { content: "Right column content." } }
      ]}
    ]
  }]
})
```

### Blog Query Loop

```jsonc
wp_insert_blocks({
  blocks: [{
    name: "core/query",
    attributes: { query: { perPage: 10, postType: "post", order: "desc", orderBy: "date" } },
    innerBlocks: [
      { name: "core/post-template", innerBlocks: [
        { name: "core/post-featured-image", attributes: { isLink: true } },
        { name: "core/post-title", attributes: { isLink: true } },
        { name: "core/post-date" },
        { name: "core/post-excerpt" }
      ]},
      { name: "core/query-pagination", innerBlocks: [
        { name: "core/query-pagination-previous" },
        { name: "core/query-pagination-numbers" },
        { name: "core/query-pagination-next" }
      ]}
    ]
  }]
})
```

### Template Structure

A typical template uses template-part references for header/footer:

```jsonc
wp_insert_blocks({
  blocks: [
    { name: "core/template-part", attributes: { slug: "header", tagName: "header" } },
    { name: "core/group", attributes: { layout: { type: "constrained" } }, innerBlocks: [
      // ... page content blocks ...
    ]},
    { name: "core/template-part", attributes: { slug: "footer", tagName: "footer" } }
  ]
})
```

---

## Global Styles

### Reading Styles

`wp_get_styles` returns the merged theme.json (theme defaults + user customizations):

```jsonc
// Returns: { settings, styles, version }
// settings: color palette, font families/sizes, spacing units, layout widths
// styles: default colors, typography, element styles, per-block styles
```

### Updating Styles

```jsonc
// Change the color palette
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

// Change global typography
wp_set_styles({
  styles: {
    typography: {
      fontFamily: "var(--wp--preset--font-family--inter)",
      fontSize: "var(--wp--preset--font-size--medium)"
    }
  }
})
```

---

## Visual Verification

Always verify changes visually:

```jsonc
// Full page screenshot
wp_get_screenshot()

// Screenshot a specific element
wp_get_screenshot({ selector: ".wp-block-cover" })

// Check layout metrics
wp_get_computed_layout({
  clientIds: ["block-id-1", "block-id-2"],
  properties: ["display", "width", "height", "gap"]
})
```

---

## Available Core Blocks (Key Blocks)

### Layout & Structure
| Block | Name | Use for |
|-------|------|---------|
| Group | `core/group` | Container. Supports Row, Stack, Grid layouts via `layout` attribute |
| Columns | `core/columns` | Multi-column responsive layouts |
| Column | `core/column` | Single column within Columns |
| Cover | `core/cover` | Hero sections with background image/color + overlay |
| Spacer | `core/spacer` | Vertical/horizontal spacing |
| Separator | `core/separator` | Horizontal dividers |

### Text
| Block | Name | Use for |
|-------|------|---------|
| Paragraph | `core/paragraph` | Body text |
| Heading | `core/heading` | Section headings (H1-H6) |
| List | `core/list` | Ordered/unordered lists |
| Quote | `core/quote` | Block quotes |
| Table | `core/table` | Structured data |
| Details | `core/details` | Collapsible content |

### Media
| Block | Name | Use for |
|-------|------|---------|
| Image | `core/image` | Single images |
| Gallery | `core/gallery` | Image grids |
| Video | `core/video` | Video embeds |
| Media & Text | `core/media-text` | Side-by-side media + text |

### Interactive
| Block | Name | Use for |
|-------|------|---------|
| Buttons | `core/buttons` | CTA button groups |
| Button | `core/button` | Individual buttons (must be inside `core/buttons`) |
| Accordion | `core/accordion` | Collapsible sections |
| Tabs | `core/tabs` | Tabbed content |
| Search | `core/search` | Search form |
| Social Icons | `core/social-links` | Social media links |

### Theme / Dynamic
| Block | Name | Use for |
|-------|------|---------|
| Template Part | `core/template-part` | Header, footer, sidebar regions |
| Navigation | `core/navigation` | Site menus |
| Site Title | `core/site-title` | Dynamic site name |
| Site Logo | `core/site-logo` | Site logo image |
| Query Loop | `core/query` | Dynamic post lists |
| Post Template | `core/post-template` | Post rendering inside query |
| Post Title | `core/post-title` | Dynamic post title |
| Post Content | `core/post-content` | Dynamic post body |
| Post Featured Image | `core/post-featured-image` | Post thumbnail |
| Post Excerpt | `core/post-excerpt` | Post summary |
| Post Date | `core/post-date` | Publication date |
