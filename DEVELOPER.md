# Developer Guide - md-to-pdf

A comprehensive technical documentation explaining the architecture, code flow, and internals of the md-to-pdf converter.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure & Responsibilities](#file-structure--responsibilities)
3. [Data Flow Pipeline](#data-flow-pipeline)
4. [Module Deep Dive](#module-deep-dive)
   - [cli.js - Command Line Interface](#clijs---command-line-interface)
   - [lib/converter.js - Core Engine](#libconverterjs---core-engine)
   - [lib/styles.js - Styling Configuration](#libstylesjs---styling-configuration)
5. [Function Reference](#function-reference)
6. [Configuration Options](#configuration-options)
7. [Dependency Graph](#dependency-graph)
8. [How Changes Affect Each Other](#how-changes-affect-each-other)
9. [Extending the Tool](#extending-the-tool)
10. [Common Modifications](#common-modifications)
11. [Debugging Guide](#debugging-guide)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INPUT                               │
│                    (CLI arguments or API)                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          cli.js                                  │
│              • Parses command-line arguments                     │
│              • Validates input                                   │
│              • Displays progress feedback                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     lib/converter.js                             │
│              • Reads Markdown file                               │
│              • Cleans content                                    │
│              • Parses with marked.js                            │
│              • Extracts headings for TOC                         │
│              • Generates HTML                                    │
│              • Launches Puppeteer                                │
│              • Renders PDF                                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      lib/styles.js                               │
│              • Provides CSS styles                               │
│              • Header/Footer templates                           │
│              • CDN URLs for external resources                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        OUTPUT                                    │
│                      (PDF File)                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure & Responsibilities

```
md-to-pdf/
│
├── cli.js                 # Entry point for command-line usage
│   └── Responsibility: Parse args, validate, call converter, display results
│
├── lib/
│   ├── converter.js       # Core conversion engine
│   │   └── Responsibility: All conversion logic from MD → HTML → PDF
│   │
│   └── styles.js          # Externalized CSS and templates
│       └── Responsibility: Styling configuration, easy customization
│
├── super-convert.js       # Legacy single-file version (deprecated)
│   └── Responsibility: Original hardcoded implementation
│
├── package.json           # Node.js project configuration
│   └── Responsibility: Dependencies, scripts, metadata
│
├── debug.html             # Debug output HTML (generated for inspection)
│
├── README.md              # User documentation
│
├── DEVELOPER.md           # This file - technical documentation
│
└── .gitignore             # Git ignore rules
```

---

## Data Flow Pipeline

The conversion process follows these stages:

### Stage 1: Input Parsing (cli.js)
```
User Command → commander.js → Parsed Options Object
```

**What happens:**
1. `commander` library parses process.argv
2. Validates required arguments (input file)
3. Sets defaults for optional parameters
4. Passes options to converter

**Affects:**
- All downstream processing depends on these options
- Invalid input stops execution here

---

### Stage 2: File Reading (converter.js)
```
File Path → fs.readFileSync() → Raw Markdown String
```

**What happens:**
1. Resolves absolute path from input
2. Checks file existence
3. Reads file as UTF-8 string

**Affects:**
- Entire content available for processing
- Encoding issues would corrupt content here

---

### Stage 3: Content Cleaning (converter.js → cleanMarkdownContent)
```
Raw Markdown → Cleaning Engine → Clean Markdown
```

**What happens:**
1. **Zero-width character removal:**
   ```javascript
   content.replace(/[\u200B-\u200D\uFEFF]/g, '')
   ```
   - Removes invisible Unicode characters
   - Prevents rendering issues
   
2. **Ampersand escaping:**
   ```javascript
   content.replace(/ & /g, ' &amp; ')
   ```
   - Converts `&` to `&amp;` for valid HTML
   
3. **YAML front matter removal:**
   ```javascript
   content.replace(/^---[\s\S]*?---/, '')
   ```
   - Strips metadata blocks (common in Jekyll/Hugo)

**Affects:**
- Clean content ensures proper parsing
- Removing front matter prevents it appearing in PDF

---

### Stage 4: Markdown Parsing & Heading Extraction (converter.js → configureMarked + marked.parse)
```
Clean Markdown → configureMarked() → marked.parse() → Body HTML + TOC Array
```

**What happens:**
1. `configureMarked()` sets up marked with two extensions:
   - **markedHighlight** for syntax highlighting via highlight.js
   - **Custom renderer** that intercepts headings to extract TOC entries and inject anchor IDs
2. `marked.parse()` processes markdown in a single pass, producing HTML while the custom renderer simultaneously collects TOC entries.
3. Heading extraction and HTML generation happen together — no separate token mutation step.

**Custom Renderer Logic:**
```javascript
{
    renderer: {
        heading({ tokens, depth }) {
            const text = this.parser.parseInline(tokens);
            const cleanText = text.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').trim();
            const anchor = cleanText.toLowerCase().replace(/[^\w]+/g, '-');

            if (depth <= maxDepth) {
                const isImportant = tocFilter ? tocFilter.test(cleanText) : true;
                if (isImportant) {
                    toc.push({ anchor, level: depth, text: cleanText });
                }
            }

            return `<h${depth} id="${anchor}">${text}</h${depth}>`;
        }
    }
}
```

**TOC Entry Generated:**
```javascript
{
    anchor: 'q1-self-awareness',
    level: 3,
    text: 'Q.1) Self-awareness'
}
```

**Affects:**
- TOC links must match anchor IDs exactly
- When no `--toc-filter` is provided, **all headings** up to `maxDepth` are included in the TOC
- When `--toc-filter` is provided, only matching headings are included
- No token mutation — heading extraction is a side effect of the renderer

---

### Stage 5: HTML Generation (converter.js → generateTocHtml + generateFullHtml)
```
Body HTML (from marked.parse)  ─┐
TOC Array (from configureMarked) ─┼─→ generateFullHtml() → Complete HTML Document
CSS Styles (from styles.js)    ─┘
```

**What happens:**
1. `marked.parse()` already produced the body HTML in Stage 4
2. TOC HTML generated from collected entries via `generateTocHtml()`
3. Full document assembled with:
   - DOCTYPE and meta tags
   - MathJax script for equations
   - Inline CSS from `styles.js` (includes syntax highlighting styles)
   - Optional custom CSS
   - TOC HTML
   - Body content HTML

**Template Structure:**
```html
<!DOCTYPE html>
<html>
<head>
    <!-- MathJax configuration -->
    <script>window.MathJax = {...}</script>
    <script src="mathjax"></script>
    
    <!-- Inline styles (from lib/styles.js) -->
    <style>
        /* Base typography, TOC, headings, tables,
           code blocks, syntax highlighting (GitHub-style),
           blockquotes, print optimization */
    </style>
</head>
<body>
    <!-- Table of Contents -->
    <div class="toc">...</div>
    <div class="page-break"></div>
    
    <!-- Main content -->
    ...body content...
</body>
</html>
```

**Affects:**
- Styles in this stage determine final PDF appearance
- Syntax highlighting CSS is bundled inline (no external CDN needed)
- MathJax CDN URL must be accessible for math rendering
- Page breaks controlled by CSS classes

---

### Stage 6: Browser Launch (converter.js → puppeteer.launch)
```
Chrome Path → puppeteer.launch() → Browser Instance
```

**What happens:**
1. Auto-detects Chrome/Edge/Chromium path OR uses custom path
2. Launches headless Chrome instance
3. Creates new page for rendering

**Detection Logic:**
```javascript
// Windows paths checked:
'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
// + Edge paths

// macOS paths checked:
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
// + Edge and Chromium paths

// Linux paths checked:
'/usr/bin/google-chrome'
'/usr/bin/chromium-browser'
// etc.
```

**Affects:**
- No Chrome = conversion fails
- Custom path overrides auto-detection
- Headless mode means no visible browser window

---

### Stage 7: PDF Rendering (converter.js → page.pdf)
```
HTML String → page.setContent() → Rendered Page → page.pdf() → PDF File
```

**What happens:**
1. `page.setContent()` loads HTML into browser
2. `waitUntil: 'networkidle0'` waits for CDN resources
3. `page.pdf()` generates PDF with options:

**PDF Options:**
```javascript
{
    path: outputPath,           // Where to save
    format: 'A4',               // Page size
    printBackground: true,      // Include background colors
    margin: {
        top: '25.4mm',          // ~1 inch margins
        bottom: '25.4mm',
        left: '25.4mm',
        right: '25.4mm'
    },
    displayHeaderFooter: true,  // Show page numbers
    headerTemplate: '...',      // Empty header
    footerTemplate: '...'       // "Page X of Y"
}
```

**Affects:**
- Format changes paper size (A4, Letter, etc.)
- Margins affect content area
- Footer template controls page numbering

---

## Module Deep Dive

### cli.js - Command Line Interface

**Purpose:** User-facing entry point that handles argument parsing and output formatting.

#### Key Components:

**1. Commander Setup:**
```javascript
const program = new Command();

program
    .name('md-to-pdf')
    .description('...')
    .version(pkg.version)
    .argument('<input>', 'Input markdown file')
    .option('-o, --output <file>', '...')
    // ... more options
```

**2. Option Parsing:**
Options are automatically parsed into an object:
```javascript
const options = program.opts();
// Result: { output: 'file.pdf', format: 'A4', toc: true, ... }
```

**3. Main Function:**
```javascript
async function main() {
    // 1. Display startup info
    // 2. Call convertMdToPdf()
    // 3. Display result (success/error)
}
```

#### How CLI Options Map to Converter:

| CLI Option | Converter Option | Default |
|------------|------------------|---------|
| `--output` | outputFile param | input.pdf |
| `--chrome-path` | options.chromePath | auto-detect |
| `--no-toc` | options.noToc | false |
| `--toc-title` | options.tocTitle | "Table of Contents" |
| `--toc-filter` | options.tocFilter | null (all headings) |
| `--toc-depth` | options.tocMaxDepth | 3 |
| `--format` | options.format | "A4" |
| `--landscape` | options.landscape | false |
| `--margin-*` | options.margin* | "25.4mm" |

---

### lib/converter.js - Core Engine

**Purpose:** Contains all conversion logic, completely decoupled from CLI.

#### Exported Functions:

| Function | Purpose | Side Effects |
|----------|---------|--------------|
| `convertMdToPdf()` | Main conversion | Creates PDF file |
| `findChromePath()` | Browser detection | None (pure function) |
| `cleanMarkdownContent()` | Sanitize markdown | None (pure function) |
| `configureMarked()` | Setup parser + heading extraction | Modifies marked global state, collects TOC entries |
| `extractHeadings()` | **No-op** (backward compat) | None — heading extraction moved into `configureMarked()` |
| `generateTocHtml()` | Create TOC HTML | None (pure function) |
| `generateFullHtml()` | Assemble document | None (pure function) |

#### Heading Extraction via Custom Renderer

Heading extraction is handled inside `configureMarked()` using a custom marked renderer extension. When `marked.parse()` encounters a heading, the renderer:

1. Extracts clean text (strips HTML tags and markdown formatting)
2. Generates an anchor ID from the heading text
3. Pushes matching headings into the TOC array (a closure variable)
4. Returns HTML with the anchor ID injected

```javascript
// During marked.parse(), the renderer intercepts headings:
// Input: ### Section 1
// Output HTML: <h3 id="section-1">Section 1</h3>
// Side effect: toc.push({ anchor: 'section-1', level: 3, text: 'Section 1' })
```

**Why this matters:**
- No token mutation — cleaner architecture than the legacy approach
- `extractHeadings()` is kept as a no-op for backward compatibility
- The TOC array is returned by `configureMarked()` and passed to `generateTocHtml()`

---

### lib/styles.js - Styling Configuration

**Purpose:** Centralize all styling to make customization easy.

#### Exports:

| Export | Type | Description |
|--------|------|-------------|
| `defaultStyles` | String | All CSS rules |
| `footerTemplate` | String | PDF footer HTML |
| `headerTemplate` | String | PDF header HTML |
| `highlightTheme` | String | CDN URL for code highlighting |
| `mathJaxUrl` | String | CDN URL for math rendering |

#### CSS Section Guide:

```css
/* BASE TYPOGRAPHY - Body text appearance */
body { font-family: "Times New Roman"; ... }

/* TABLE OF CONTENTS - TOC styling */
.toc { ... }
.toc-indent { margin-left: 20px; }  /* Sub-items */

/* PAGE BREAKS - PDF pagination */
.page-break { page-break-after: always; }

/* HEADINGS - H1-H4 styling */
h1 { text-align: center; text-transform: uppercase; }
h2 { border-bottom: 1px solid; }
h3 { text-decoration: underline; }

/* PRINT OPTIMIZATION - Prevent awkward breaks */
h1, h2, h3, h4 { page-break-after: avoid; }
pre, table { page-break-inside: avoid; }
```

---

## Function Reference

### convertMdToPdf(inputFile, outputFile, options)

**The main conversion function.**

```javascript
/**
 * @param {string} inputFile - Path to markdown file
 * @param {string} outputFile - Path for PDF output
 * @param {Object} options - Configuration options
 * @returns {Promise<{success: boolean, message: string, outputPath?: string}>}
 */
```

**Options Object:**
```javascript
{
    chromePath: string | null,      // Custom browser path
    noToc: boolean,                 // Skip TOC (default: false)
    tocTitle: string,               // TOC heading (default: "Table of Contents")
    tocFilter: string,              // Regex for TOC filtering
    format: string,                 // Page format (default: "A4")
    landscape: boolean,             // Landscape mode (default: false)
    marginTop: string,              // Top margin (default: "25.4mm")
    marginBottom: string,           // Bottom margin
    marginLeft: string,             // Left margin
    marginRight: string             // Right margin
}
```

**Return Value:**
```javascript
// Success
{ success: true, message: "PDF generated...", outputPath: "/full/path.pdf" }

// Failure
{ success: false, message: "Error description" }
```

---

### findChromePath()

**Detects installed Chrome/Edge/Chromium.**

```javascript
/**
 * @returns {string|null} Path to executable or null
 */
```

**Detection Order (Windows):**
1. `C:\Program Files\Google\Chrome\...`
2. `C:\Program Files (x86)\Google\Chrome\...`
3. `%LOCALAPPDATA%\Google\Chrome\...`
4. Microsoft Edge paths

---

### cleanMarkdownContent(rawContent)

**Sanitizes markdown for processing.**

```javascript
/**
 * @param {string} rawContent - Raw markdown
 * @returns {string} Cleaned markdown
 */
```

**Operations performed:**
1. Remove zero-width Unicode characters
2. Escape ampersands
3. Strip YAML front matter

---

### configureMarked(tocOptions)

**Configures marked with syntax highlighting and optional heading extraction for TOC.**

```javascript
/**
 * @param {Object|null} tocOptions - Options for TOC heading extraction (null to skip TOC)
 * @param {RegExp|null} tocOptions.tocFilter - Regex to filter headings for TOC (null = all)
 * @param {number} tocOptions.maxDepth - Max heading depth to include (default: 3)
 * @returns {Array<{anchor: string, level: number, text: string}>} Collected TOC entries
 */
```

Sets up two marked extensions:
1. `markedHighlight` for syntax highlighting via highlight.js
2. Custom renderer for heading extraction and anchor ID injection

The returned array is populated during `marked.parse()` and should be passed to `generateTocHtml()`.

---

### extractHeadings(tokens, options)

**No-op stub for backward compatibility.**

```javascript
/**
 * @deprecated Heading extraction is now handled by configureMarked().
 * @returns {Array} Always returns empty array
 */
```

This function was kept to avoid breaking any external code that may call it.

---

## Configuration Options

### Page Formats

| Format | Dimensions | Use Case |
|--------|------------|----------|
| A4 | 210mm × 297mm | International standard |
| Letter | 8.5in × 11in | US standard |
| Legal | 8.5in × 14in | Legal documents |
| Tabloid | 11in × 17in | Large format |
| A3 | 297mm × 420mm | Posters |
| A5 | 148mm × 210mm | Booklets |

### Margin Units

Supported units:
- `mm` - Millimeters (recommended)
- `cm` - Centimeters
- `in` - Inches
- `px` - Pixels (at 96dpi)

### TOC Filter Patterns

**Default:** `null` (all headings up to `--toc-depth` are included)

**Examples:**
```bash
# All chapters and sections
--toc-filter "Chapter|Section"

# Only questions
--toc-filter "^Q\."

# Explicitly match everything (same as default)
--toc-filter ".*"

# Numbered items
--toc-filter "^\d+\."
```

---

## Dependency Graph

```
md-to-pdf
│
├─► commander (CLI parsing)
│   └─ Parses process.argv into options object
│
├─► chalk (Terminal colors)
│   └─ Colorizes CLI output for better UX
│
├─► marked (Markdown parsing)
│   ├─ lexer(): MD string → Token array
│   └─ parser(): Token array → HTML string
│
├─► highlight.js (Syntax highlighting)
│   └─ highlight(): Code string → HTML with classes
│
└─► puppeteer-core (PDF generation)
    ├─ launch(): Start headless browser
    ├─ newPage(): Create browser tab
    ├─ setContent(): Load HTML
    └─ pdf(): Generate PDF file
```

### Why puppeteer-core?

`puppeteer-core` vs `puppeteer`:
- **puppeteer**: Bundles Chromium (~300MB download)
- **puppeteer-core**: No bundled browser, needs external Chrome

We use `puppeteer-core` because:
1. Most users already have Chrome installed
2. Smaller package size
3. Uses user's familiar browser

---

## How Changes Affect Each Other

### Changing Styles (lib/styles.js)

| Change | Affects |
|--------|---------|
| Body font-family | All text in PDF |
| .toc styles | Table of Contents appearance |
| h1-h4 styles | Heading appearance AND TOC linking (IDs are in headings) |
| .page-break | Where pages split |
| @media print rules | Print-specific overrides |

### Changing TOC Filter

```javascript
// Default: null (all headings included)
// Change to: only Chapter|Unit headings
// CLI: --toc-filter "Chapter|Unit"
```

| What Changes | What Stays Same |
|--------------|-----------------|
| Which headings appear in TOC | All headings still get anchor IDs |
| TOC length | Body content unchanged |
| Navigation links | Heading styling |

### Changing Page Format

| Change | Affects |
|--------|---------|
| A4 → Letter | Content reflow, page count may change |
| Portrait → Landscape | Wide tables fit better, narrow text |
| Margins | Content area size, page count |

### Changing Chrome Path

| Scenario | Result |
|----------|--------|
| Valid path | Uses specified browser |
| Invalid path | Auto-detection kicks in |
| No Chrome anywhere | Conversion fails with error |

---

## Extending the Tool

### Adding New CLI Options

1. **Add to cli.js:**
```javascript
program
    .option('--watermark <text>', 'Add watermark to pages')
```

2. **Pass to converter:**
```javascript
const result = await convertMdToPdf(inputFile, outputFile, {
    watermark: options.watermark,
    // ... other options
});
```

3. **Handle in converter.js:**
```javascript
async function convertMdToPdf(inputFile, outputFile, options = {}) {
    const { watermark } = options;
    
    // Use watermark in HTML generation
    const watermarkHtml = watermark 
        ? `<div class="watermark">${watermark}</div>` 
        : '';
}
```

4. **Add styles in styles.js:**
```css
.watermark {
    position: fixed;
    opacity: 0.1;
    font-size: 72pt;
    transform: rotate(-45deg);
}
```

---

### Adding Custom Themes

1. **Create theme file (lib/themes/dark.js):**
```javascript
module.exports = {
    body: { background: '#1a1a1a', color: '#fff' },
    headings: { color: '#60a5fa' },
    code: { background: '#2d2d2d' }
};
```

2. **Add theme option to CLI and converter**

3. **Merge theme styles in generateFullHtml()**

---

### Adding Export Formats

To add HTML export alongside PDF:

```javascript
// In converter.js
async function convertMdToHtml(inputFile, outputFile, options = {}) {
    // ... same processing up to fullHtml generation
    
    fs.writeFileSync(outputFile, fullHtml, 'utf-8');
    
    return { success: true, message: 'HTML generated' };
}
```

---

## Common Modifications

### Change Default Font

**File:** `lib/styles.js`

```javascript
// Find:
body { font-family: "Times New Roman", Times, serif; }

// Change to:
body { font-family: "Arial", "Helvetica", sans-serif; }
```

**Affects:** All body text. Headings inherit unless overridden.

---

### Add Custom Header/Footer

**File:** `lib/styles.js`

```javascript
// Current footer:
const footerTemplate = `
<div style="...">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
`;

// Custom footer with date:
const footerTemplate = `
<div style="font-size:9px; width:100%; display:flex; justify-content:space-between; padding:0 20px;">
    <span>Generated: ${new Date().toLocaleDateString()}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>
`;
```

---

### Include ALL Headings in TOC

By default, all headings up to `--toc-depth` (default: 3) are already included in the TOC.

To include deeper headings:
```bash
node cli.js input.md --toc-depth 6
```

To filter to specific headings only:
```bash
node cli.js input.md --toc-filter "Chapter|Section"
```

---

### Change Page Margins

**CLI (one-time):**
```bash
node cli.js input.md --margin-top 20mm --margin-bottom 30mm
```

**Default (permanent) - converter.js:**
```javascript
const {
    marginTop = '20mm',     // Changed from 25.4mm
    marginBottom = '30mm',  // Changed from 25.4mm
    // ...
} = options;
```

---

## Debugging Guide

### Enable Verbose Logging

Add logging to converter.js:

```javascript
async function convertMdToPdf(inputFile, outputFile, options = {}) {
    const DEBUG = true;
    
    if (DEBUG) console.log('Options:', JSON.stringify(options, null, 2));
    if (DEBUG) console.log('Input path:', inputPath);
    if (DEBUG) console.log('Chrome path:', chromePath);
    if (DEBUG) console.log('Tokens found:', tokens.length);
    if (DEBUG) console.log('TOC entries:', toc.length);
    // ...
}
```

---

### View Generated HTML

Save HTML before PDF generation:

```javascript
// After generateFullHtml()
fs.writeFileSync('debug-output.html', fullHtml, 'utf-8');
console.log('Debug HTML saved to debug-output.html');
```

Open `debug-output.html` in browser to see exactly what will be rendered.

---

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Chrome not found" | Auto-detection failed | Use `--chrome-path` |
| "Input file not found" | Wrong path | Check file exists |
| "Protocol error" | Chrome crashed | Update Chrome |
| "Navigation timeout" | CDN blocked | Check network |
| TOC links don't work | Anchor ID mismatch | Check heading text cleaning |

---

### Testing Changes

1. **Run test conversion:**
```bash
npm run test
```

2. **Check output:**
- Open generated PDF
- Verify TOC links work
- Check styling matches expectations

3. **Test edge cases:**
- Empty file
- No headings
- Special characters in headings
- Very long documents

---

## Performance Considerations

### Optimization Tips

1. **Reduce external dependencies:**
   - Bundle highlight.js CSS locally instead of CDN
   - Pre-render MathJax if possible

2. **Reuse browser instance:**
   For batch processing, modify to keep browser open:
   ```javascript
   const browser = await puppeteer.launch({...});
   for (const file of files) {
       await convertPage(browser, file);
   }
   await browser.close();
   ```

3. **Skip unnecessary processing:**
   - Use `--no-toc` for simple documents
   - Disable MathJax if no equations

---

## Security Notes

1. **Local files only:** The tool reads local files; no URL fetching of markdown.

2. **Chrome sandbox:** Puppeteer runs with `--no-sandbox` in some environments. This is needed for Docker/CI but reduces security isolation.

3. **CDN dependencies:** MathJax and highlight.js load from CDNs. For offline use, bundle these locally.

4. **No code execution:** Markdown is converted to HTML; JavaScript in markdown is not executed (except MathJax for math rendering).

---

## Version History

| Version | Changes |
|---------|---------|
| 1.0.0 | Original single-file implementation |
| 2.0.0 | - Modular architecture<br>- CLI with commander<br>- Auto Chrome detection<br>- Configurable options<br>- Externalized styles |

---

## Contributing

### Code Style

- Use JSDoc comments for all functions
- 4-space indentation
- Descriptive variable names
- Handle errors gracefully (return objects, don't throw)

### Pull Request Checklist

- [ ] Code follows existing style
- [ ] JSDoc comments added
- [ ] README updated (if applicable)
- [ ] DEVELOPER.md updated (if API changes)
- [ ] Tested with sample documents
- [ ] No breaking changes (or documented)

---

*Last updated: March 2026*
