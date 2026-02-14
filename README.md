# MD-to-PDF

Convert Markdown files to beautifully formatted PDF documents with syntax highlighting, math support, and auto-generated Table of Contents.

## Features

- **Table of Contents** - Auto-generated, clickable TOC with configurable filtering
- **Syntax Highlighting** - Code blocks with highlight.js support
- **Math Support** - LaTeX equations via MathJax
- **Chrome Auto-Detection** - Automatically finds Chrome/Edge/Chromium
- **Customizable Output** - Page format, margins, orientation options
- **Clean Design** - Professional typography optimized for printing

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/md-to-pdf.git
cd md-to-pdf

# Install dependencies
npm install
```

### Global Installation (optional)

```bash
npm install -g .
# Now you can use 'md-to-pdf' from anywhere
```

## Requirements

- **Node.js** >= 16.0.0
- **Chrome, Edge, or Chromium** browser installed

## Quick Start

```bash
# Basic conversion
node cli.js input.md

# Specify output file
node cli.js input.md -o output.pdf

# Using npm scripts
npm run convert -- input.md -o output.pdf
```

## CLI Usage

```
md-to-pdf <input> [options]

Arguments:
  input                      Input markdown file path

Options:
  -v, --version              Display version number
  -o, --output <file>        Output PDF file path
  --chrome-path <path>       Custom Chrome/Chromium executable path
  --no-toc                   Disable Table of Contents generation
  --toc-title <title>        Custom Table of Contents title (default: "Table of Contents")
  --toc-filter <pattern>     Regex pattern for TOC heading filter (default: "Topic|Summary|Section|Detailed")
  -f, --format <format>      Page format: A4, Letter, Legal, Tabloid (default: "A4")
  -l, --landscape            Use landscape orientation
  --margin-top <margin>      Top margin (default: "25.4mm")
  --margin-bottom <margin>   Bottom margin (default: "25.4mm")
  --margin-left <margin>     Left margin (default: "25.4mm")
  --margin-right <margin>    Right margin (default: "25.4mm")
  -h, --help                 Display help for command
```

## Examples

### Basic Conversion

```bash
node cli.js notes.md
# Output: notes.pdf
```

### Custom Output File

```bash
node cli.js lecture-notes.md -o final-document.pdf
```

### Without Table of Contents

```bash
node cli.js quick-doc.md --no-toc
```

### Letter Format (US)

```bash
node cli.js report.md --format Letter
```

### Landscape Orientation

```bash
node cli.js wide-tables.md -l
```

### Custom Margins

```bash
node cli.js book.md --margin-top 30mm --margin-bottom 30mm
```

### Specify Chrome Path

```bash
node cli.js input.md --chrome-path "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

## Programmatic Usage

You can also use the converter as a module in your Node.js projects:

```javascript
const { convertMdToPdf } = require('./lib/converter');

async function main() {
    const result = await convertMdToPdf('input.md', 'output.pdf', {
        format: 'A4',
        noToc: false,
        tocTitle: 'Contents',
        landscape: false
    });
    
    if (result.success) {
        console.log('PDF generated:', result.outputPath);
    } else {
        console.error('Error:', result.message);
    }
}

main();
```

## Supported Markdown Features

- **Headings** (H1-H6)
- **Bold**, *Italic*, ~~Strikethrough~~
- Ordered and unordered lists
- Code blocks with syntax highlighting
- Tables
- Blockquotes
- Images
- Links
- Horizontal rules
- Math equations (LaTeX syntax)

### Math Support

Inline math: `$E = mc^2$`

Block math:
```latex
$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$
```

### Code Highlighting

Supports 180+ languages via highlight.js:

```javascript
function hello(name) {
    console.log(`Hello, ${name}!`);
}
```

## Table of Contents Filtering

By default, only headings containing specific keywords are included in the TOC:
- Topic
- Summary
- Section
- Detailed

Customize with the `--toc-filter` option:

```bash
# Include all Chapter and Section headings
node cli.js book.md --toc-filter "Chapter|Section"

# Include all headings (match everything)
node cli.js book.md --toc-filter ".*"
```

## Project Structure

```
md-to-pdf/
├── cli.js              # CLI entry point
├── lib/
│   ├── converter.js    # Core conversion logic
│   └── styles.js       # CSS styles configuration
├── package.json        # Project configuration
├── README.md           # This file
├── DEVELOPER.md        # Developer documentation
└── .gitignore          # Git ignore rules
```

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run CLI (prompts for args) |
| `npm run convert -- <file>` | Convert a file |
| `npm run legacy` | Run original super-convert.js |
| `npm run test` | Test conversion with project.md |
| `npm run help` | Show CLI help |

## Troubleshooting

### Chrome Not Found

If auto-detection fails, specify the path manually:

**Windows:**
```bash
node cli.js input.md --chrome-path "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

**macOS:**
```bash
node cli.js input.md --chrome-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

**Linux:**
```bash
node cli.js input.md --chrome-path "/usr/bin/google-chrome"
```

### PDF Generation Fails

1. Ensure Chrome/Edge/Chromium is installed
2. Check that the input markdown file exists
3. Verify you have write permissions for the output directory

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Made with ❤️ for the Markdown community
