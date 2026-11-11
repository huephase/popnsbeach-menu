# Main Plan

## Goal

Build a lightweight, highly performant menu microsite that loads menu content from CSV files in `menu_data/`. Public page URLs must work without file extensions, including direct visits and refreshes. Styling will use a dedicated CSS reset and a separate minimal custom CSS popns_custom.css, with exactly one media query for portrait mobile devices. Currency set to AED via CSS ::after pseudo-element.

## Scope and architecture

- Use semantic HTML, plain CSS, and a small JavaScript module. Avoid a frontend framework, UI library, external fonts, and unnecessary runtime dependencies.
- Keep CSV files as the source of truth for menu content. Fetch `menu_data/tabs_order.csv`, `menu_data/main_menu.csv`, and `menu_data/bowls_menu.csv` once each on page load, in parallel, and reuse the parsed data for rendering and navigation.
- Build the index page's tabs from `tabs_order.csv`, using its row order and `CATEGORY` values for tab order and visible labels. Show all eligible matching tabs, with no fixed tab count.
- Match each tab's `CATEGORY` to the `CATEGORY` column in both menu files and display matching active items. Preserve item order within each file; when both files contain a category, append matching `bowls_menu.csv` items after matching `main_menu.csv` items.
- Use native links and browser navigation. Add only the JavaScript needed for loading data and rendering the menu.
- Keep the initial implementation focused on browsing the menu; ordering, payments, accounts, and an editing dashboard are outside scope.

## Proposed project structure

```text
docs/
  MAIN_PLAN.md
menu_data/
  tabs_order.csv
  main_menu.csv
  bowls_menu.csv
menu_imgs/
  tropical_supply.jpg
assets/
  css/
    popns_resets.css
    popns_custom.css
  js/
    menu.js
index.html
```

The source entry point may be named `index.html`; visitors access it through `/`. Source and asset filenames do not determine public page URLs.

## CSV contract

Use UTF-8 CSV. Both `main_menu.csv` and `bowls_menu.csv` use this exact header and column order:

```csv
TITLE,ACTIVE,NOTES,CATEGORY,PRICE,ALLERGENS,DESCRIPTION,KCAL,PROTEIN,CARBS,FAT,IMAGE
Tropical Supply,TRUE,,smoothie,50,,"Mango, peach, passion fruit, pineapple, strawberry & coconut water",245 KCAL,04 p,60 c,02 f,tropical_supply.jpg
```

| Column | Rule |
| --- | --- |
| `TITLE` | Required, nonempty item name. |
| `ACTIVE` | Required boolean, `TRUE` or `FALSE`. Only `TRUE` items appear publicly. Trim whitespace and accept case variations when parsing. |
| `NOTES` | Optional plain-text note. Omit its UI when empty. |
| `CATEGORY` | Required, nonempty category identifier, such as `smoothie`. |
| `PRICE` | Optional nonnegative integer, normalized from the leading digits as described below. Omit its UI when empty. |
| `ALLERGENS` | Optional plain text. An empty value means no information was supplied; do not label it allergen-free. Omit its UI when empty. |
| `DESCRIPTION` | Optional plain-text description. Quote values containing commas, quotes, or line breaks. Omit its UI when empty. |
| `KCAL` | Optional nonnegative integer; normalize `245 KCAL` to `245`. Omit its UI when empty. |
| `PROTEIN` | Optional nonnegative integer; normalize `04 p` to `4`. Omit its UI when empty. |
| `CARBS` | Optional nonnegative integer; normalize `60 c` to `60`. Omit its UI when empty. |
| `FAT` | Optional nonnegative integer; normalize `02 f` to `2`. Omit its UI when empty. |
| `IMAGE` | Optional filename relative to `menu_imgs/`, such as `tropical_supply.jpg`. Omit its UI when empty. |

Parsing must support quoted commas, escaped double quotes, CRLF/LF line endings, quoted multiline fields, and an optional UTF-8 BOM. Do not parse CSV by splitting on commas or line breaks alone. Use a small, standards-aware parser and validate the header and row shape before rendering.

Trim surrounding whitespace while preserving meaningful text. Ignore blank rows. Treat invalid boolean values as invalid records. Skip malformed records with useful development diagnostics; show an unavailable state if no usable records remain because of invalid data. A valid file containing no active items should show a normal empty-menu state.

When shaping incoming CSV records, normalize `PRICE`, `KCAL`, `PROTEIN`, `CARBS`, and `FAT` after trimming surrounding whitespace: keep only the consecutive digits starting at the left edge (`^[0-9]+`), discard the remaining suffix, and convert the retained digits to a nonnegative integer. For example, `50 AED` becomes `50`, `245 KCAL` becomes `245`, and `04 p` becomes `4`. Blank values remain absent, not zero. A nonblank value without leading digits is invalid; do not search later in the text for a number. Reject integers outside JavaScript's safe integer range using the malformed-record handling above.

Render CSV content as text, never as executable HTML. Restrict image references to filenames within `menu_imgs/`; reject external URLs and path traversal.

## Index tabs and category matching

`menu_data/tabs_order.csv` uses this separate schema:

```csv
CATEGORY,DESCRIPTION,ACTIVE
Fresh Blends,This tab covers Fresh Blends,TRUE
Fresh Juices,This tab covers Fresh Juices,TRUE
```

- `CATEGORY` supplies both the matching key and the visible tab label. `DESCRIPTION` is optional supporting text, not the tab label. `ACTIVE` uses the same boolean rules as the menu files; inactive tab rows are ignored.
- Traverse active tab rows in file order. Match `CATEGORY` against the same column in either `main_menu.csv` or `bowls_menu.csv`, using exact, case-sensitive equality after trimming surrounding whitespace.
- Skip and ignore any tab category with no matching entries in either menu file. Do not render a placeholder tab or treat this as an error.
- Only active menu items appear. If a matching category contains no active valid items, omit its tab to avoid an empty panel.
- Menu categories absent from the active tab configuration do not automatically create tabs. In particular, `Bowls Base` and `Extra PROTEIN` do not create additional index tabs; any use as bowl options requires a separate explicit rendering rule.
- Render each category at most once; retain the first active occurrence if the tab file contains duplicate categories and report the duplicate in development diagnostics.
- Select the first eligible tab initially. Switching tabs displays the corresponding category panel without refetching CSV data or reloading the page.
- Use accessible tab controls with `tablist`, `tab`, and `tabpanel` semantics, correct selected state and panel associations, and arrow-key/Home/End navigation. Keep all tabs reachable on narrow screens without adding another media query.
- If no tabs qualify, show the empty-menu state. A missing or invalid tab configuration must show a load-failure state rather than silently inventing a tab order.

Show all eligible matching categories without a fixed tab count. The current CSV files yield **10 tabs**, in this order: Fresh Blends, Fresh Juices, Breakfast, Bowls, Snacks, Sandwiches, Desserts, Coffee, Matcha, Water. The tab count changes automatically as CSV content and active flags change.

## Extensionless URLs

- Serve the main menu at `/` without exposing `.html` in navigation.
- If category pages are needed, use paths such as `/menu/smoothie`. Derive category slugs deterministically and detect collisions before publishing.
- Configure the chosen host to serve the entry document for supported page routes so direct visits and refreshes work. The host must also support genuine `404` responses for unsupported routes.
- Redirect explicit document URLs such as `/index.html` to their extensionless canonical URL. Pick one trailing-slash convention and use it consistently.
- Keep file extensions on assets and data, including `.css`, `.js`, `.csv`, and images. The extensionless requirement applies to public page URLs.
- Confirm the hosting platform and route behavior before implementation; document the exact rewrite, redirect, and caching configuration alongside the code.

## CSS and responsive layout

- Load `popns_resets.css` first and `popns_custom.css` second. Keep the reset small: predictable `box-sizing`, removed default body margins, sensible text defaults, responsive images, and inherited form-control fonts. Preserve native focus visibility and accessible browser behavior.
- Use system fonts, a small spacing scale, and a few CSS custom properties for colors, spacing, and text sizes.
- Build the base layout with flexible widths, a readable maximum content width, and intrinsic Grid/Flexbox behavior so it works across viewport sizes without extra breakpoints.
- Include exactly one media query across all project CSS: `@media (max-width: 600px) and (orientation: portrait)`. Use it only for portrait mobile adjustments such as spacing, stacking, and typography.
- Treat `600px` as the initial portrait-mobile breakpoint to verify on real devices. Ensure landscape mobile remains usable through the base layout.
- Avoid animation, decorative effects, CSS frameworks, and device-specific style branches that add weight or require more media queries.

## Performance and accessibility

- Keep HTML, CSS, and JavaScript small; use a deferred JavaScript module and avoid render-blocking third-party resources.
- Target an initial combined HTML/CSS/JavaScript transfer size of no more than 50 KB compressed, excluding CSV and images. Measure representative CSV and image costs separately.
- Set image width and height to prevent layout shifts, lazy-load images below the fold, and load visible images normally. Use responsive variants only where they provide a measured benefit.
- Enable compression and appropriate cache headers on the host. Revalidate stable CSV URLs so menu edits appear on subsequent visits; use long-lived caching only for versioned assets.
- Target LCP at or below 2.5 seconds, CLS at or below 0.1, and INP at or below 200 milliseconds under representative mobile conditions. Use lab checks before launch and field measurements when available.
- Use meaningful headings, keyboard-accessible navigation, visible focus indicators, sufficient contrast, and appropriate image alternative text. Avoid duplicating adjacent item names in decorative image descriptions.
- Provide accessible loading, empty, and load-failure states, including a retry action after fetch failures. Show a short explanation when JavaScript is disabled.

## Implementation sequence

1. Confirm the deployment host, currency, and whether category-specific URLs are required. Keep `/` as the required first route.
2. Use the existing three CSV files and menu images; add the semantic page shell, reset stylesheet, and minimal base styles.
3. Implement parallel CSV loading, schema-specific parsing and validation, active-item filtering, category matching, ordered index tabs, accessible tab switching, and safe rendering. Derive the tab count from all eligible matching categories.
4. Add image handling and loading, empty, and failure states.
5. Add the single portrait-mobile media query and verify the base layout at other sizes and orientations.
6. Configure extensionless routes, document redirects, missing-route behavior, compression, and caching for the selected host.
7. Run the acceptance checks below, address failures, and document local preview and deployment commands in the README.

## Acceptance checks

- The example row renders with the correct title, category, price, description, nutrition labels, and image.
- Updating the CSV changes the menu on the next visit after revalidation, without editing application code.
- `FALSE` items are hidden; empty optional fields leave no empty UI labels or broken images.
- Tab labels and order follow `tabs_order.csv`; matching items from both menu files appear under the correct tab, preserving the defined item order.
- Unmatched tab categories are skipped. Adding or removing eligible categories updates the tab count automatically.
- Inactive tabs, categories containing only inactive items, and duplicate tab rows follow the filtering rules. Menu categories not listed in the active tab configuration do not create tabs.
- The first eligible tab is selected on load; keyboard and pointer tab switching work without refetching data. No eligible tabs produces the empty-menu state.
- CSV parsing handles quoted commas, escaped quotes, multiline fields, BOM, and both common line endings. Invalid headers and rows produce the intended error behavior.
- Missing CSV files, failed requests, missing images, and zero active items each have a usable outcome.
- Supported extensionless routes load directly and survive refreshes on the deployment host. Explicit document URLs redirect, and unknown routes return `404`.
- Portrait mobile, landscape mobile, tablet, and desktop layouts remain readable without horizontal overflow. Project CSS contains exactly one media query.
- Keyboard navigation, focus visibility, contrast, and loading/error announcements are verified.
- Mobile performance is measured with representative menu data and images, and the transfer-size and Core Web Vitals targets are checked before launch.
