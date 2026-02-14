/**
 * @fileoverview CSS Styles Module
 * Contains all styling configurations for the PDF output.
 * Modify these styles to customize the appearance of generated PDFs.
 * 
 * @module lib/styles
 */

/**
 * Default CSS styles for PDF generation
 * @type {string}
 */
const defaultStyles = `
/* ========================
   BASE TYPOGRAPHY
   ======================== */
body { 
    font-family: "Times New Roman", Times, serif; 
    font-size: 12pt; 
    line-height: 1.5; 
    color: #000; 
    margin: 0 auto; 
    padding: 40px; 
    max-width: 800px; 
    text-align: justify; 
}

/* ========================
   TABLE OF CONTENTS
   ======================== */
.toc { 
    margin-bottom: 50px; 
}

.toc h1 { 
    text-align: center; 
    border-bottom: 2px solid #000; 
    padding-bottom: 10px; 
}

.toc ul { 
    list-style: none; 
    padding: 0; 
}

.toc li { 
    margin-bottom: 8px; 
    border-bottom: 1px dotted #ccc; 
}

.toc a { 
    text-decoration: none; 
    color: #000; 
    display: block; 
    width: 100%; 
}

.toc-indent { 
    margin-left: 20px; 
    font-size: 0.95em; 
    color: #444; 
}

/* ========================
   PAGE BREAKS
   ======================== */
.page-break { 
    page-break-after: always; 
}

/* ========================
   HEADINGS
   ======================== */
h1 { 
    text-align: center; 
    font-size: 24pt; 
    font-weight: bold; 
    margin-bottom: 30px; 
    text-transform: uppercase; 
    margin-top: 0; 
}

h2 { 
    font-size: 18pt; 
    font-weight: bold; 
    border-bottom: 1px solid #000; 
    padding-bottom: 5px; 
    margin-top: 30px; 
}

h3 { 
    font-size: 16pt; 
    font-weight: bold; 
    margin-top: 25px; 
    color: #000; 
    text-decoration: underline;
}

h4 { 
    font-size: 14pt; 
    font-weight: bold; 
    margin-top: 20px; 
    color: #333; 
}

/* ========================
   CONTENT ELEMENTS
   ======================== */
p { 
    margin-bottom: 15px; 
}

ul, ol { 
    margin-bottom: 15px; 
    padding-left: 30px; 
}

/* ========================
   TABLES
   ======================== */
table { 
    border-collapse: collapse; 
    width: 100%; 
    margin: 20px 0; 
}

th, td { 
    border: 1px solid #000; 
    padding: 8px; 
    text-align: left; 
}

th { 
    background-color: #eee; 
    font-weight: bold; 
}

/* ========================
   MATH (MathJax)
   ======================== */
.MathJax { 
    font-size: 110%; 
}

/* ========================
   PRINT OPTIMIZATION
   ======================== */
h1, h2, h3, h4 { 
    page-break-after: avoid; 
}

img, table, pre { 
    page-break-inside: avoid; 
}

/* ========================
   CODE BLOCKS
   ======================== */
pre {
    background-color: #f5f5f5;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 10pt;
    line-height: 1.4;
    border: 1px solid #ddd;
}

code {
    font-family: 'Consolas', 'Monaco', monospace;
    background-color: #f0f0f0;
    padding: 2px 5px;
    border-radius: 3px;
    font-size: 0.9em;
}

pre code {
    background-color: transparent;
    padding: 0;
}

/* ========================
   BLOCKQUOTES
   ======================== */
blockquote {
    border-left: 4px solid #333;
    margin: 20px 0;
    padding: 10px 20px;
    background-color: #f9f9f9;
    font-style: italic;
}
`;

/**
 * PDF page footer template
 * @type {string}
 */
const footerTemplate = `
<div style="font-size:10px; font-family:'Times New Roman'; text-align:center; width:100%; color:black;">
    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
</div>
`;

/**
 * PDF page header template (empty by default)
 * @type {string}
 */
const headerTemplate = '<div></div>';

/**
 * highlight.js theme CDN URL
 * @type {string}
 */
const highlightTheme = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/arduino-light.min.css';

/**
 * MathJax CDN URL
 * @type {string}
 */
const mathJaxUrl = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';

module.exports = {
    defaultStyles,
    footerTemplate,
    headerTemplate,
    highlightTheme,
    mathJaxUrl
};
