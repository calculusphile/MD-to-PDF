#!/usr/bin/env node

/**
 * @fileoverview CLI Entry Point for md-to-pdf
 * Provides a command-line interface for converting Markdown files to PDF.
 * 
 * @example
 * # Convert markdown to PDF
 * npx md-to-pdf input.md -o output.pdf
 * 
 * # With options
 * npx md-to-pdf notes.md --no-toc --format Letter
 */

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const { convertMdToPdf, findChromePath } = require('./lib/converter');
const pkg = require('./package.json');

// Initialize CLI program
const program = new Command();

program
    .name('md-to-pdf')
    .description('Convert Markdown files to beautifully formatted PDF documents')
    .version(pkg.version, '-v, --version', 'Display version number')
    .argument('<input>', 'Input markdown file path')
    .option('-o, --output <file>', 'Output PDF file path')
    .option('--chrome-path <path>', 'Custom Chrome/Chromium executable path')
    .option('--no-toc', 'Disable Table of Contents generation')
    .option('--toc-title <title>', 'Custom Table of Contents title', 'Table of Contents')
    .option('--toc-filter <pattern>', 'Regex pattern for TOC heading filter', 'Topic|Summary|Section|Detailed')
    .option('-f, --format <format>', 'Page format (A4, Letter, Legal, Tabloid)', 'A4')
    .option('-l, --landscape', 'Use landscape orientation')
    .option('--margin-top <margin>', 'Top margin (e.g., 25.4mm)', '25.4mm')
    .option('--margin-bottom <margin>', 'Bottom margin', '25.4mm')
    .option('--margin-left <margin>', 'Left margin', '25.4mm')
    .option('--margin-right <margin>', 'Right margin', '25.4mm')
    .addHelpText('after', `

${chalk.bold('Examples:')}
  $ md-to-pdf notes.md                          Convert notes.md to notes.pdf
  $ md-to-pdf notes.md -o output.pdf            Specify output filename
  $ md-to-pdf notes.md --no-toc                 Skip Table of Contents
  $ md-to-pdf notes.md --format Letter          Use Letter page format
  $ md-to-pdf notes.md -l                       Use landscape orientation
  
${chalk.bold('Supported Formats:')}
  A4, Letter, Legal, Tabloid, A3, A5
  
${chalk.bold('Chrome Detection:')}
  The tool auto-detects Chrome/Chromium. Use --chrome-path if detection fails.
`);

// Parse arguments
program.parse(process.argv);

const options = program.opts();
const inputFile = program.args[0];

// Generate output filename if not specified
const outputFile = options.output || inputFile.replace(/\.md$/i, '.pdf');

/**
 * Main execution function
 */
async function main() {
    console.log(chalk.cyan('🚀 md-to-pdf v' + pkg.version));
    console.log(chalk.gray('─'.repeat(50)));
    
    // Show detected Chrome path
    const chromePath = options.chromePath || findChromePath();
    if (chromePath) {
        console.log(chalk.green('✓') + ' Chrome found: ' + chalk.gray(chromePath));
    } else {
        console.log(chalk.red('✗') + ' Chrome not found');
    }
    
    console.log(chalk.blue('→') + ` Input:  ${chalk.white(inputFile)}`);
    console.log(chalk.blue('→') + ` Output: ${chalk.white(outputFile)}`);
    console.log(chalk.blue('→') + ` Format: ${chalk.white(options.format)}${options.landscape ? ' (landscape)' : ''}`);
    console.log(chalk.blue('→') + ` TOC:    ${chalk.white(options.toc ? 'Enabled' : 'Disabled')}`);
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(chalk.yellow('⏳ Converting...'));
    
    // Perform conversion
    const result = await convertMdToPdf(inputFile, outputFile, {
        chromePath: options.chromePath,
        noToc: !options.toc,
        tocTitle: options.tocTitle,
        tocFilter: options.tocFilter,
        format: options.format,
        landscape: options.landscape,
        marginTop: options.marginTop,
        marginBottom: options.marginBottom,
        marginLeft: options.marginLeft,
        marginRight: options.marginRight,
    });
    
    // Display result
    if (result.success) {
        console.log(chalk.green('✅ ' + result.message));
    } else {
        console.log(chalk.red('❌ Error: ' + result.message));
        process.exit(1);
    }
}

// Run main function
main().catch(error => {
    console.error(chalk.red('❌ Unexpected error: ' + error.message));
    process.exit(1);
});
