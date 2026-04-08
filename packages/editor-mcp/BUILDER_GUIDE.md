# Site Editor Builder Guide

Reference for AI agents building WordPress block themes via the editor-mcp server.

**Further reading**: https://developer.wordpress.org/themes/ | https://developer.wordpress.org/block-editor/

Gutenberg ships markdown docs alongside the code. After each section below, references point to the relevant doc files for deeper details.

---

## Core Concept

Block themes = HTML with comment delimiters (`<!-- wp:block-name {"attr":"val"} -->...<!-- /wp:block-name -->`). Blocks are semantic HTML elements with a shared style attribute schema. Know the schema, write any design.

**Two approaches** (choose based on the task):

1. **HTML-first (recommended for new designs)**: Write HTML/CSS → `wp_import_html` converts to blocks → verify with screenshot → save.
2. **Block-by-block (for edits)**: Navigate to document → read blocks → insert/update/replace → verify → save.

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
| `wp_import_html` | **Convert raw HTML/CSS to blocks** — maps CSS to block styles |
| `wp_get_styles` | Read theme.json global styles and settings |
| `wp_set_styles` | Update global styles (colors, typography, spacing) |
| `wp_get_screenshot` | Capture the editor canvas for visual verification |
| `wp_get_computed_layout` | Get bounding rects and computed CSS for blocks |
| `wp_save` | Persist all changes to the database |
| `wp_export` | Export current document as serialized block HTML |

---

## HTML-First Workflow (Recommended for New Designs)

The fastest way to build a design is to write HTML/CSS and let `wp_import_html` convert it:

```
1. wp_open_document        → navigate to target template/page
2. wp_import_html(html, load=true) → write HTML/CSS, convert + load into editor
3. wp_get_screenshot       → verify the result visually
4. wp_update_block / wp_insert_blocks → fine-tune individual blocks if needed
5. wp_save                 → persist changes
```

### How wp_import_html works

- Parses `<style>` tags and resolves class-based CSS onto elements
- Maps CSS properties to native block style attributes (see Style Attribute Schema below)
- Converts HTML elements to block types: `<h1>`→heading, `<p>`→paragraph, `<div>`→group, `<img>`→image, etc.
- Detects flex/grid CSS → block layout attributes
- Button-like `<a>` tags (with background + padding) → `core/buttons` + `core/button`
- With `load: true`, uses `createBlock()` in the browser for perfectly valid blocks

### Example

```html
<style>
  .hero { background-color: #f6f7f7; padding: 96px 36px 120px; }
  .hero h1 { font-size: clamp(36px, 5vw, 64px); font-weight: 400; }
  .hero p { font-size: 18px; color: #3c434a; }
  .cta { background-color: #3858E9; color: white; padding: 12px 17px; border-radius: 4px; }
</style>
<section class="hero">
  <h1>AI tools built for your WordPress site</h1>
  <p>Write better content and connect AI agents.</p>
  <a href="#" class="cta">Try the AI website builder</a>
</section>
```

This produces a `core/group` (section) with heading, paragraph, and button blocks — all with native block styles, not inline CSS.

### Tips for writing HTML that converts well

- Use semantic elements: `<section>`, `<h1>`–`<h6>`, `<p>`, `<ul>`, `<img>`, `<a>`
- Use `<style>` tags with classes (cleaner than inline styles)
- Use `display: flex` / `display: grid` for layouts — they map to block layout types
- For buttons, style `<a>` tags with `background-color` + `padding`
- Use `clamp()` for responsive typography: `font-size: clamp(36px, 5vw, 64px)`
- Avoid deeply nested containers — blocks work best with shallow nesting

### CSS features that DON'T convert to blocks

- **`background-image: url(...)`** on containers — blocks require images in the WP media library for `style.background.backgroundImage` to render. Use `core/cover` block with an uploaded image instead, or upload the image first via REST API.
- **`::before` / `::after` pseudo-elements** — no block equivalent. Decorative overlays, grid patterns, and gradient masks must use `core/cover` overlays or custom CSS classes.
- **CSS `mask-image`** — not supported in block styles.
- **`position: absolute/fixed`** — blocks use flow/flex/grid layouts only. Overlapping elements need `core/cover` or `core/group` with custom CSS.
- **CSS animations / transitions** — not supported in block styles.
- **Media queries** — blocks handle responsive behavior through their own layout system, not CSS media queries.

---

## Block-by-Block Workflow (For Edits)

```
1. wp_open_document  → navigate to template/page
2. wp_get_blocks     → read current block tree
3. wp_lookup_block   → check block schema before inserting
4. wp_insert_blocks  → add new blocks (or wp_replace_blocks / wp_update_block)
5. wp_get_screenshot → verify the result visually
6. wp_save           → persist changes
```

**Always verify visually.** After every insert/update/replace, call `wp_get_screenshot` to confirm the result matches intent. Use `wp_get_computed_layout` to check specific layout metrics when precision matters.

---

## Layout Width: contentSize and wideSize

The site editor's global styles define two key widths that affect all `constrained` layout blocks:

- **`contentSize`** — default max-width for content blocks (e.g. `645px`)
- **`wideSize`** — max-width for blocks with `align: "wide"` (e.g. `1340px`)

Check current values with `wp_get_styles`. These come from `settings.layout` in theme.json.

### Breaking out of the constraint

For full-width sections (heroes, banners), you have three options:

1. **`align: "full"`** on the block — stretches to viewport edge, ignoring both contentSize and wideSize
2. **`align: "wide"`** on the block — stretches to wideSize
3. **`layout: { type: "default" }`** (flow layout) — no width constraint at all

```jsonc
// Full-width hero section
{ "name": "core/group", "attributes": {
  "align": "full",
  "layout": { "type": "constrained", "contentSize": "1200px" },
  "style": { "spacing": { "padding": { "top": "96px", "bottom": "120px" } } }
}}
```

**Common mistake**: Using `constrained` layout without setting `contentSize` or `align` — the content gets squeezed to the theme's narrow default (often 645px).

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

## Block Theme Structure

A block theme requires only two files: `style.css` (theme metadata) and `templates/index.html` (fallback template).

```
theme/
├── style.css                 # Theme name, description, version
├── theme.json                # Global settings & styles
├── functions.php             # Custom PHP functionality (optional)
├── templates/                # Full-page templates (HTML)
│   ├── index.html            # Required fallback
│   ├── front-page.html
│   ├── single.html
│   ├── page.html
│   ├── archive.html
│   ├── 404.html
│   └── search.html
├── parts/                    # Reusable template sections (HTML)
│   ├── header.html
│   └── footer.html
├── patterns/                 # Reusable block patterns (PHP)
│   └── hero.php
├── styles/                   # Style variations (JSON)
│   └── dark.json
└── assets/                   # CSS, JS, images, fonts
```

### Template Hierarchy

WordPress selects the most specific template available, falling back through a chain:

| Context | Template Chain (most → least specific) |
|---------|---------------------------------------|
| **Front page** | `front-page.html` → `home.html` → `index.html` |
| **Single post** | `single-{post_type}-{slug}.html` → `single-{post_type}.html` → `single.html` → `singular.html` → `index.html` |
| **Page** | `page-{slug}.html` → `page-{id}.html` → `page.html` → `singular.html` → `index.html` |
| **Category** | `category-{slug}.html` → `category-{id}.html` → `category.html` → `archive.html` → `index.html` |
| **Tag** | `tag-{slug}.html` → `tag-{id}.html` → `tag.html` → `archive.html` → `index.html` |
| **Author** | `author-{nicename}.html` → `author-{id}.html` → `author.html` → `archive.html` → `index.html` |
| **Custom taxonomy** | `taxonomy-{tax}-{term}.html` → `taxonomy-{tax}.html` → `taxonomy.html` → `archive.html` → `index.html` |
| **Post type archive** | `archive-{post_type}.html` → `archive.html` → `index.html` |
| **Search** | `search.html` → `index.html` |
| **404** | `404.html` → `index.html` |

### Template Parts

Reusable sections stored in `/parts/` as `.html` files. Referenced in templates via:

```html
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->
```

Register in `theme.json` for proper editor labels:

```json
{
  "templateParts": [
    { "area": "header", "name": "header", "title": "Header" },
    { "area": "footer", "name": "footer", "title": "Footer" }
  ]
}
```

Areas: `header`, `footer`, `uncategorized` (General).

### Patterns

Reusable block groups stored in `/patterns/` as PHP files with a header comment:

```php
<?php
/**
 * Title: Hero
 * Slug: themeslug/hero
 * Categories: featured
 * Keywords: hero, banner
 * Block Types: core/cover
 * Viewport Width: 1200
 */
?>
<!-- wp:cover {"overlayColor":"contrast","align":"full"} -->
<div class="wp-block-cover alignfull">
  <!-- block markup -->
</div>
<!-- /wp:cover -->
```

Header fields: `Title`, `Slug`, `Categories`, `Description`, `Keywords`, `Block Types`, `Post Types`, `Template Types`, `Inserter` (boolean), `Viewport Width`.

You can also reference patterns from the WordPress Pattern Directory in `theme.json`:

```json
{
  "patterns": ["short-text-and-image", "pricing-table"]
}
```

> **Docs**: `docs/how-to-guides/themes/README.md` · `docs/reference-guides/block-api/block-patterns.md` · `docs/reference-guides/block-api/block-templates.md`

---

## theme.json — Global Settings & Styles

The `theme.json` file configures the entire design system. Settings follow a priority hierarchy: WordPress defaults < theme < child theme < user customizations (database).

```json
{
  "$schema": "https://schemas.wp.org/trunk/theme.json",
  "version": 3,
  "settings": {},
  "styles": {},
  "customTemplates": [],
  "templateParts": [],
  "patterns": []
}
```

### Settings

Settings control what options are available in the editor and define presets. Every preset automatically generates a CSS custom property: `--wp--preset--{type}--{slug}`.

#### Color

```json
{
  "settings": {
    "color": {
      "palette": [
        { "color": "#ffffff", "name": "Base", "slug": "base" },
        { "color": "#000000", "name": "Contrast", "slug": "contrast" },
        { "color": "#89CFF0", "name": "Primary", "slug": "primary" }
      ],
      "gradients": [
        { "gradient": "linear-gradient(to right, #10b981, #64a30d)", "name": "Emerald", "slug": "emerald" }
      ],
      "duotone": [
        { "colors": ["#450a0a", "#fef2f2"], "name": "Red", "slug": "red" }
      ],
      "defaultPalette": false,
      "defaultGradients": false,
      "custom": true,
      "link": true,
      "text": true,
      "background": true
    }
  }
}
```

Generated CSS: `--wp--preset--color--primary: #89CFF0;`

Convention: `base` and `contrast` slugs are de facto standards for site background and text.

#### Typography

```json
{
  "settings": {
    "typography": {
      "fontFamilies": [
        {
          "name": "Primary",
          "slug": "primary",
          "fontFamily": "Charter, 'Bitstream Charter', Cambria, serif"
        },
        {
          "name": "Secondary",
          "slug": "secondary",
          "fontFamily": "'Open Sans', sans-serif",
          "fontFace": [
            {
              "fontFamily": "Open Sans",
              "fontWeight": "300 800",
              "fontStyle": "normal",
              "src": ["file:./assets/fonts/open-sans.woff2"]
            }
          ]
        }
      ],
      "fontSizes": [
        { "name": "Small", "size": "1rem", "slug": "sm" },
        { "name": "Medium", "size": "1.25rem", "slug": "md", "fluid": { "min": "1rem", "max": "1.5rem" } },
        { "name": "Large", "size": "1.5rem", "slug": "lg", "fluid": { "min": "1.25rem", "max": "2rem" } }
      ],
      "fluid": true
    }
  }
}
```

Generated CSS: `--wp--preset--font-family--primary`, `--wp--preset--font-size--md` (fluid sizes use `clamp()`).

Controls: `customFontSize`, `dropCap`, `fontStyle`, `fontWeight`, `letterSpacing`, `lineHeight`, `textTransform`, `textDecoration`, `writingMode`.

#### Spacing

```json
{
  "settings": {
    "spacing": {
      "padding": true,
      "margin": true,
      "blockGap": true,
      "units": ["px", "em", "rem", "vh", "vw", "%"],
      "spacingSizes": [
        { "name": "Small", "size": "0.5rem", "slug": "20" },
        { "name": "Medium", "size": "1rem", "slug": "40" },
        { "name": "Large", "size": "2rem", "slug": "60" },
        { "name": "X-Large", "size": "clamp(2rem, 4vw, 4rem)", "slug": "80" }
      ]
    }
  }
}
```

Generated CSS: `--wp--preset--spacing--40: 1rem;`

Alternative: use `spacingScale` to auto-generate sizes: `{ operator: "*", increment: 1.5, steps: 7, mediumStep: 1.5, unit: "rem" }`.

#### Layout

```json
{
  "settings": {
    "layout": {
      "contentSize": "650px",
      "wideSize": "1200px"
    }
  }
}
```

#### Other Settings

- **`appearanceTools`**: `true` enables border, spacing, typography, shadow, and dimensions controls in one shot.
- **`border`**: `color`, `radius`, `style`, `width` (each boolean).
- **`shadow`**: Enable box-shadow support and define custom shadow presets.
- **`dimensions`**: `minHeight` (boolean).
- **`position`**: `sticky` (boolean).
- **`useRootPaddingAwareAlignments`**: `true` for proper full-width alignment with root padding.
- **`blocks`**: Per-block setting overrides (e.g., `"core/heading": { "color": { "palette": [...] } }`).

### Styles

Styles apply design values at three levels: global, elements, and per-block.

```json
{
  "styles": {
    "color": {
      "text": "var(--wp--preset--color--contrast)",
      "background": "var(--wp--preset--color--base)"
    },
    "typography": {
      "fontFamily": "var(--wp--preset--font-family--primary)",
      "fontSize": "var(--wp--preset--font-size--md)",
      "lineHeight": "1.6"
    },
    "spacing": {
      "padding": { "top": "0", "right": "var(--wp--preset--spacing--40)", "bottom": "0", "left": "var(--wp--preset--spacing--40)" }
    },
    "elements": {
      "heading": {
        "typography": { "fontFamily": "var(--wp--preset--font-family--secondary)", "fontWeight": "700" }
      },
      "link": {
        "color": { "text": "var(--wp--preset--color--primary)" }
      },
      "button": {
        "color": { "text": "#ffffff", "background": "var(--wp--preset--color--primary)" },
        "border": { "radius": "4px" }
      }
    },
    "blocks": {
      "core/code": {
        "color": { "text": "#ffffff", "background": "#1e1e1e" }
      }
    }
  }
}
```

Reference presets in styles using `var(--wp--preset--{type}--{slug})`.

> **Docs**: `docs/reference-guides/theme-json-reference/theme-json-living.md` · `docs/how-to-guides/themes/global-settings-and-styles.md` · `docs/explanations/architecture/styles.md`

### Reading & Updating Styles via MCP

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

> **Docs**: `docs/reference-guides/block-api/block-supports.md` · `docs/reference-guides/block-api/block-attributes.md`

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

> **Docs**: `docs/reference-guides/core-blocks.md`

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
