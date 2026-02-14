const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');
const puppeteer = require('puppeteer-core'); 

// --- CONFIGURATION ---
const INPUT_FILE = 'project.md';       
const OUTPUT_FILE = 'final_notes_perfect.pdf'; 
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-', 
});

async function convertMdToPdf() {
    console.log(`🚀 Reading & Analyzing: ${INPUT_FILE}...`);

    const inputPath = path.resolve(INPUT_FILE);
    const outputPath = path.resolve(OUTPUT_FILE);

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ Error: Could not find "${INPUT_FILE}".`);
        return;
    }

    let rawContent = fs.readFileSync(inputPath, 'utf-8');

    // === CLEANING ENGINE ===
    // 1. Remove invisible garbage
    let cleanContent = rawContent.replace(/[\u200B-\u200D\uFEFF]/g, ''); 
    // 2. Fix Ampersands
    cleanContent = cleanContent.replace(/ & /g, ' &amp; ');              
    // 3. Remove Header Block
    cleanContent = cleanContent.replace(/^---[\s\S]*?---/, '');          
    // =======================

    // 1. SCAN FOR HEADINGS (Levels 1 - 4)
    const tokens = marked.lexer(cleanContent);
    let toc = [];

    tokens.forEach(token => {
        // FIX: We now check depth <= 4 to catch your ### and #### headings
        if (token.type === 'heading' && token.depth <= 4) {
            
            // Clean stars (**) from the title text
            const cleanText = token.text.replace(/\*\*/g, '').replace(/\*/g, '').trim();
            const anchor = cleanText.toLowerCase().replace(/[^\w]+/g, '-');
            
            // Only add "Topics", "Summary", or "Sections" to the Table of Contents
            // This prevents "Questions" from cluttering the list
            const isImportant = /Topic|Summary|Section|Detailed/i.test(cleanText);

            if (isImportant) {
                console.log(`📑 Added to ToC: ${cleanText}`);
                toc.push({
                    anchor: anchor,
                    level: token.depth,
                    text: cleanText
                });
            }

            // Update HTML for linking (Remove stars from the visual PDF title too)
            token.type = 'html';
            token.text = `<h${token.depth} id="${anchor}">${cleanText}</h${token.depth}>`;
        }
    });

    const bodyContent = marked.parser(tokens);

    // 2. Generate Table of Contents
    let tocHtml = `
    <div class="toc">
        <h1>Table of Contents</h1>
        <ul>
    `;
    
    if (toc.length === 0) {
        console.log("⚠️ Warning: No headings found. The script didn't match any 'Topic' or 'Summary' lines.");
    }

    toc.forEach(entry => {
        // Adjust indentation based on depth
        // Level 3 (###) -> No indent (Main Item)
        // Level 4 (####) -> Indent (Sub Item)
        let indentClass = '';
        if (entry.level > 3) indentClass = 'toc-indent';

        tocHtml += `<li class="${indentClass}"><a href="#${entry.anchor}">${entry.text}</a></li>`;
    });
    
    tocHtml += `</ul></div><div class="page-break"></div>`; 

    // 3. Final HTML
    const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/arduino-light.min.css">
        <script>
        window.MathJax = {
            tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']] },
            svg: { fontCache: 'global' }
        };
        </script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
        <style>
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
            .toc { margin-bottom: 50px; }
            .toc h1 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .toc ul { list-style: none; padding: 0; }
            .toc li { margin-bottom: 8px; border-bottom: 1px dotted #ccc; }
            .toc a { text-decoration: none; color: #000; display: block; width: 100%; }
            .toc-indent { margin-left: 20px; font-size: 0.95em; color: #444; }
            .page-break { page-break-after: always; }
            
            /* Typography */
            h1 { text-align: center; font-size: 24pt; font-weight: bold; margin-bottom: 30px; text-transform: uppercase; margin-top: 0; }
            h2 { font-size: 18pt; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-top: 30px; }
            
            /* Support for your Level 3 and 4 Headings */
            h3 { font-size: 16pt; font-weight: bold; margin-top: 25px; color: #000; text-decoration: underline;}
            h4 { font-size: 14pt; font-weight: bold; margin-top: 20px; color: #333; }

            p { margin-bottom: 15px; }
            ul, ol { margin-bottom: 15px; padding-left: 30px; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #eee; font-weight: bold; }
            .MathJax { font-size: 110%; }
            h1, h2, h3, h4 { page-break-after: avoid; }
            img, table, pre { page-break-inside: avoid; }
        </style>
    </head>
    <body>
        ${tocHtml}
        ${bodyContent}
    </body>
    </html>
    `;

    try {
        const browser = await puppeteer.launch({
            executablePath: CHROME_PATH, 
            headless: true
        });

        const page = await browser.newPage();
        await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
        
        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '25.4mm', bottom: '25.4mm', left: '25.4mm', right: '25.4mm' },
            displayHeaderFooter: true,
            footerTemplate: `<div style="font-size:10px; font-family:'Times New Roman'; text-align:center; width:100%; color:black;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
            headerTemplate: '<div></div>' 
        });

        await browser.close();
        console.log(`✅ Success! Generated PDF: "${OUTPUT_FILE}"`);

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

convertMdToPdf();