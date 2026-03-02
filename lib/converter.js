/**
 * @fileoverview Core Markdown to PDF Converter Module
 * Handles all conversion logic including markdown parsing, HTML generation,
 * and PDF rendering via Puppeteer.
 * 
 * @module lib/converter
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { markedHighlight } = require('marked-highlight');
const hljs = require('highlight.js');
const puppeteer = require('puppeteer-core');
const { 
    defaultStyles, 
    footerTemplate, 
    headerTemplate, 
    mathJaxUrl 
} = require('./styles');

/**
 * Common Chrome/Chromium installation paths by platform
 * @type {Object.<string, string[]>}
 */
const CHROME_PATHS = {
    win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
    darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
        '/usr/bin/microsoft-edge',
    ]
};

/**
 * Auto-detect Chrome/Chromium installation path
 * Searches common installation locations based on the current platform
 * 
 * @returns {string|null} Path to Chrome executable or null if not found
 */
function findChromePath() {
    const platform = process.platform;
    const paths = CHROME_PATHS[platform] || [];
    
    for (const chromePath of paths) {
        if (chromePath && fs.existsSync(chromePath)) {
            return chromePath;
        }
    }
    
    return null;
}

/**
 * Configure marked with syntax highlighting and heading extraction
 * Sets up highlight.js integration via markedHighlight extension,
 * and optionally collects headings for TOC generation.
 * 
 * @param {Object} [tocOptions] - Options for TOC heading extraction
 * @param {RegExp|null} [tocOptions.tocFilter] - Regex to filter headings for TOC
 * @param {number} [tocOptions.maxDepth=3] - Max heading depth to include
 * @returns {Array<{anchor: string, level: number, text: string}>} Collected TOC entries
 */
function configureMarked(tocOptions) {
    const toc = [];
    const collectHeadings = !!tocOptions;
    const tocFilter = tocOptions?.tocFilter || null;
    const maxDepth = tocOptions?.maxDepth || 3;

    const extensions = [
        markedHighlight({
            langPrefix: 'hljs language-',
            highlight(code, lang) {
                const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language }).value;
            }
        })
    ];

    if (collectHeadings) {
        extensions.push({
            renderer: {
                heading({ tokens, depth }) {
                    const text = this.parser.parseInline(tokens);
                    // Clean markdown formatting from heading text
                    const cleanText = text.replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\*/g, '').trim();
                    // Generate URL-safe anchor ID
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
        });
    }

    marked.use(...extensions);

    return toc;
}

/**
 * Clean raw markdown content by removing invisible characters and fixing formatting
 * 
 * @param {string} rawContent - Raw markdown string
 * @returns {string} Cleaned markdown content
 * 
 * @description
 * Performs three cleaning operations:
 * 1. Removes zero-width spaces and BOM characters (U+200B-U+200D, U+FEFF)
 * 2. Escapes ampersands for proper HTML rendering
 * 3. Removes YAML front matter blocks (--- delimited)
 */
function cleanMarkdownContent(rawContent) {
    // 1. Remove invisible garbage (zero-width spaces, BOM)
    let cleanContent = rawContent.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // 2. Fix Ampersands for HTML
    cleanContent = cleanContent.replace(/ & /g, ' &amp; ');
    
    // 3. Remove YAML Header Block (front matter)
    cleanContent = cleanContent.replace(/^---[\s\S]*?---/, '');
    
    return cleanContent;
}

// extractHeadings is now integrated into configureMarked() via a custom renderer.
// Kept as a no-op for backward compatibility if called externally.
function extractHeadings(tokens, options = {}) {
    return [];
}

/**
 * Generate HTML Table of Contents from extracted headings
 * 
 * @param {Array<{anchor: string, level: number, text: string}>} toc - TOC entries
 * @param {string} title - Title for the TOC section
 * @returns {string} HTML string for Table of Contents
 * 
 * @description
 * Creates a clickable TOC with proper indentation based on heading levels.
 * Headings at level 4+ get indent styling for visual hierarchy.
 * Includes page break after TOC for PDF formatting.
 */
function generateTocHtml(toc, title = 'Table of Contents') {
    let tocHtml = `
    <div class="toc">
        <h1>${title}</h1>
        <ul>
    `;
    
    toc.forEach(entry => {
        // Indent sub-items (level 4+)
        const indentClass = entry.level > 3 ? 'toc-indent' : '';
        tocHtml += `<li class="${indentClass}"><a href="#${entry.anchor}">${entry.text}</a></li>`;
    });
    
    tocHtml += `</ul></div><div class="page-break"></div>`;
    
    return tocHtml;
}

/**
 * Generate complete HTML document for PDF rendering
 * 
 * @param {string} tocHtml - Table of Contents HTML
 * @param {string} bodyContent - Main content HTML
 * @param {Object} options - Configuration options
 * @param {string} options.customStyles - Additional CSS to inject
 * @returns {string} Complete HTML document
 */
function generateFullHtml(tocHtml, bodyContent, options = {}) {
    const { customStyles = '' } = options;
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <script>
        window.MathJax = {
            tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']] },
            svg: { fontCache: 'global' }
        };
        </script>
        <script id="MathJax-script" async src="${mathJaxUrl}"></script>
        <style>
            ${defaultStyles}
            ${customStyles}
        </style>
    </head>
    <body>
        ${tocHtml}
        ${bodyContent}
    </body>
    </html>
    `;
}

/**
 * Main conversion function - converts Markdown file to PDF
 * 
 * @async
 * @param {string} inputFile - Path to input markdown file
 * @param {string} outputFile - Path for output PDF file
 * @param {Object} options - Configuration options
 * @param {string} [options.chromePath] - Custom Chrome/Chromium path
 * @param {boolean} [options.noToc] - Skip Table of Contents generation
 * @param {string} [options.tocTitle] - Custom TOC title
 * @param {string} [options.tocFilter] - Regex pattern for TOC filtering
 * @param {string} [options.format] - Page format (A4, Letter, etc.)
 * @param {boolean} [options.landscape] - Use landscape orientation
 * @param {string} [options.marginTop] - Top margin (e.g., '25.4mm')
 * @param {string} [options.marginBottom] - Bottom margin
 * @param {string} [options.marginLeft] - Left margin
 * @param {string} [options.marginRight] - Right margin
 * @returns {Promise<{success: boolean, message: string, outputPath?: string}>}
 * 
 * @throws {Error} When Chrome cannot be found or input file doesn't exist
 * 
 * @example
 * const result = await convertMdToPdf('input.md', 'output.pdf', {
 *     format: 'A4',
 *     noToc: false
 * });
 */
async function convertMdToPdf(inputFile, outputFile, options = {}) {
    const {
        chromePath: customChromePath,
        noToc = false,
        tocTitle = 'Table of Contents',
        tocFilter = null,  // null = include all headings in TOC
        tocMaxDepth = 3,   // Include h1, h2, h3 by default
        format = 'A4',
        landscape = false,
        marginTop = '25.4mm',
        marginBottom = '25.4mm',
        marginLeft = '25.4mm',
        marginRight = '25.4mm',
    } = options;
    
    // Resolve file paths
    const inputPath = path.resolve(inputFile);
    const outputPath = path.resolve(outputFile);
    
    // Validate input file exists
    if (!fs.existsSync(inputPath)) {
        return {
            success: false,
            message: `Input file not found: "${inputFile}"`
        };
    }
    
    // Find Chrome executable
    const chromePath = customChromePath || findChromePath();
    if (!chromePath) {
        return {
            success: false,
            message: 'Chrome/Chromium not found. Please install Chrome or specify path with --chrome-path'
        };
    }
    
    // Read and clean markdown content
    const rawContent = fs.readFileSync(inputPath, 'utf-8');
    const cleanContent = cleanMarkdownContent(rawContent);
    
    // Configure marked with syntax highlighting and optional TOC extraction
    const tocFilterRegex = tocFilter ? new RegExp(tocFilter, 'i') : null;
    const toc = configureMarked(
        noToc ? null : { tocFilter: tocFilterRegex, maxDepth: tocMaxDepth }
    );
    
    // Parse markdown to HTML (uses marked.parse so markedHighlight runs)
    const bodyContent = marked.parse(cleanContent);
    const tocHtml = noToc ? '' : generateTocHtml(toc, tocTitle);
    const fullHtml = generateFullHtml(tocHtml, bodyContent);
    
    // Launch browser and generate PDF
    try {
        const browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: true
        });
        
        const page = await browser.newPage();
        await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
        
        await page.pdf({
            path: outputPath,
            format: format,
            landscape: landscape,
            printBackground: true,
            margin: {
                top: marginTop,
                bottom: marginBottom,
                left: marginLeft,
                right: marginRight
            },
            displayHeaderFooter: true,
            footerTemplate: footerTemplate,
            headerTemplate: headerTemplate
        });
        
        await browser.close();
        
        return {
            success: true,
            message: `PDF generated successfully: "${outputFile}"`,
            outputPath: outputPath
        };
        
    } catch (error) {
        return {
            success: false,
            message: `PDF generation failed: ${error.message}`
        };
    }
}

module.exports = {
    convertMdToPdf,
    findChromePath,
    cleanMarkdownContent,
    extractHeadings,
    generateTocHtml,
    generateFullHtml,
    configureMarked,
    CHROME_PATHS
};
