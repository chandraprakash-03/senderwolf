#!/usr/bin/env node

/**
 * Senderwolf Templates CLI
 * Command-line interface for managing email templates
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Import template system
import {
    registerTemplate,
    getTemplate,
    listTemplates,
    removeTemplate,
    previewTemplate,
    loadTemplateFromFile,
    saveTemplateToFile,
    loadTemplatesFromDirectory,
    TemplateManager,
    BUILTIN_TEMPLATES
} from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
    .name('senderwolf-templates')
    .description('Senderwolf Email Templates CLI')
    .version('1.0.0');

// List templates command
program
    .command('list')
    .description('List all available templates')
    .option('-c, --category <category>', 'Filter by category')
    .option('-j, --json', 'Output as JSON')
    .action(async (options) => {
        try {
            const templates = listTemplates(options.category);

            if (options.json) {
                console.log(JSON.stringify(templates.map(t => t.toJSON()), null, 2));
                return;
            }

            if (templates.length === 0) {
                console.log(chalk.yellow('No templates found.'));
                return;
            }

            console.log(chalk.blue.bold('\n📧 Email Templates\n'));

            // Group by category
            const byCategory = {};
            templates.forEach(template => {
                if (!byCategory[template.category]) {
                    byCategory[template.category] = [];
                }
                byCategory[template.category].push(template);
            });

            Object.entries(byCategory).forEach(([category, categoryTemplates]) => {
                console.log(chalk.green.bold(`📂 ${category.toUpperCase()}`));
                categoryTemplates.forEach(template => {
                    console.log(`  ${chalk.cyan(template.name)} - ${template.description}`);
                    console.log(`    Variables: ${chalk.gray(template.variables.join(', '))}`);
                });
                console.log();
            });

        } catch (error) {
            console.error(chalk.red('Error listing templates:'), error.message);
            process.exit(1);
        }
    });

// Show template command
program
    .command('show <name>')
    .description('Show template details')
    .option('-j, --json', 'Output as JSON')
    .action(async (name, options) => {
        try {
            const template = getTemplate(name);

            if (!template) {
                console.error(chalk.red(`Template '${name}' not found.`));
                process.exit(1);
            }

            if (options.json) {
                console.log(JSON.stringify(template.toJSON(), null, 2));
                return;
            }

            console.log(chalk.blue.bold(`\n📧 Template: ${template.name}\n`));
            console.log(`${chalk.bold('Description:')} ${template.description}`);
            console.log(`${chalk.bold('Category:')} ${template.category}`);
            console.log(`${chalk.bold('Variables:')} ${template.variables.join(', ')}`);
            console.log(`${chalk.bold('Created:')} ${template.created.toISOString()}`);
            console.log(`${chalk.bold('Updated:')} ${template.updated.toISOString()}`);

            console.log(chalk.bold('\nSubject:'));
            console.log(chalk.gray(template.subject || '(none)'));

            console.log(chalk.bold('\nHTML:'));
            console.log(chalk.gray(template.html ? template.html.substring(0, 200) + '...' : '(none)'));

            console.log(chalk.bold('\nText:'));
            console.log(chalk.gray(template.text ? template.text.substring(0, 200) + '...' : '(none)'));

        } catch (error) {
            console.error(chalk.red('Error showing template:'), error.message);
            process.exit(1);
        }
    });

// Preview template command
program
    .command('preview <name>')
    .description('Preview template with sample data')
    .option('-v, --variables <json>', 'Variables as JSON string')
    .option('-f, --file <path>', 'Variables from JSON file')
    .action(async (name, options) => {
        try {
            const template = getTemplate(name);

            if (!template) {
                console.error(chalk.red(`Template '${name}' not found.`));
                process.exit(1);
            }

            let variables = {};

            if (options.variables) {
                try {
                    variables = JSON.parse(options.variables);
                } catch (error) {
                    console.error(chalk.red('Invalid JSON in variables:'), error.message);
                    process.exit(1);
                }
            } else if (options.file) {
                try {
                    const content = await readFile(options.file, 'utf8');
                    variables = JSON.parse(content);
                } catch (error) {
                    console.error(chalk.red(`Error reading variables file: ${error.message}`));
                    process.exit(1);
                }
            } else {
                // Use sample data based on template variables
                variables = generateSampleData(template.variables);
            }

            const rendered = previewTemplate(name, variables);

            console.log(chalk.blue.bold(`\n📧 Template Preview: ${name}\n`));
            console.log(`${chalk.bold('Subject:')} ${rendered.subject}`);

            console.log(chalk.bold('\nHTML:'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(rendered.html);
            console.log(chalk.gray('─'.repeat(50)));

            if (rendered.text) {
                console.log(chalk.bold('\nText:'));
                console.log(chalk.gray('─'.repeat(50)));
                console.log(rendered.text);
                console.log(chalk.gray('─'.repeat(50)));
            }

        } catch (error) {
            console.error(chalk.red('Error previewing template:'), error.message);
            process.exit(1);
        }
    });

// Create template command
program
    .command('create')
    .description('Create a new template interactively')
    .action(async () => {
        try {
            console.log(chalk.blue.bold('\n📧 Create New Template\n'));

            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Template name:',
                    validate: (input) => {
                        if (!input.trim()) return 'Name is required';
                        if (getTemplate(input)) return 'Template already exists';
                        return true;
                    }
                },
                {
                    type: 'input',
                    name: 'description',
                    message: 'Description:'
                },
                {
                    type: 'list',
                    name: 'category',
                    message: 'Category:',
                    choices: [
                        'authentication',
                        'notification',
                        'ecommerce',
                        'business',
                        'marketing',
                        'custom'
                    ]
                },
                {
                    type: 'input',
                    name: 'subject',
                    message: 'Email subject:',
                    validate: (input) => input.trim() ? true : 'Subject is required'
                },
                {
                    type: 'editor',
                    name: 'html',
                    message: 'HTML content (opens editor):'
                },
                {
                    type: 'confirm',
                    name: 'addText',
                    message: 'Add text version?',
                    default: true
                }
            ]);

            let textContent = '';
            if (answers.addText) {
                const textAnswer = await inquirer.prompt([
                    {
                        type: 'editor',
                        name: 'text',
                        message: 'Text content (opens editor):'
                    }
                ]);
                textContent = textAnswer.text;
            }

            const template = registerTemplate(answers.name, {
                subject: answers.subject,
                html: answers.html,
                text: textContent,
                description: answers.description,
                category: answers.category
            });

            console.log(chalk.green(`\n✅ Template '${template.name}' created successfully!`));
            console.log(`Variables detected: ${template.variables.join(', ')}`);

            const saveAnswer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'save',
                    message: 'Save template to file?',
                    default: true
                }
            ]);

            if (saveAnswer.save) {
                const fileAnswer = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'filename',
                        message: 'Filename:',
                        default: `${answers.name}.json`
                    }
                ]);

                await saveTemplateToFile(answers.name, fileAnswer.filename);
                console.log(chalk.green(`💾 Template saved to ${fileAnswer.filename}`));
            }

        } catch (error) {
            console.error(chalk.red('Error creating template:'), error.message);
            process.exit(1);
        }
    });

// Load template command
program
    .command('load <path>')
    .description('Load template(s) from file or directory')
    .action(async (path) => {
        try {
            const stat = await import('node:fs/promises').then(fs => fs.stat(path));

            if (stat.isDirectory()) {
                const templates = await loadTemplatesFromDirectory(path);
                console.log(chalk.green(`✅ Loaded ${templates.length} templates from ${path}`));
                templates.forEach(template => {
                    console.log(`  - ${template.name} (${template.category})`);
                });
            } else {
                const result = await loadTemplateFromFile(path);
                const templates = Array.isArray(result) ? result : [result];
                console.log(chalk.green(`✅ Loaded ${templates.length} template(s) from ${path}`));
                templates.forEach(template => {
                    console.log(`  - ${template.name} (${template.category})`);
                });
            }

        } catch (error) {
            console.error(chalk.red('Error loading template:'), error.message);
            process.exit(1);
        }
    });

// Save template command
program
    .command('save <name> <path>')
    .description('Save template to file')
    .action(async (name, path) => {
        try {
            const template = getTemplate(name);

            if (!template) {
                console.error(chalk.red(`Template '${name}' not found.`));
                process.exit(1);
            }

            await saveTemplateToFile(name, path);
            console.log(chalk.green(`✅ Template '${name}' saved to ${path}`));

        } catch (error) {
            console.error(chalk.red('Error saving template:'), error.message);
            process.exit(1);
        }
    });

// Remove template command
program
    .command('remove <name>')
    .description('Remove a template')
    .option('-f, --force', 'Skip confirmation')
    .action(async (name, options) => {
        try {
            const template = getTemplate(name);

            if (!template) {
                console.error(chalk.red(`Template '${name}' not found.`));
                process.exit(1);
            }

            if (!options.force) {
                const answer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `Are you sure you want to remove template '${name}'?`,
                        default: false
                    }
                ]);

                if (!answer.confirm) {
                    console.log('Cancelled.');
                    return;
                }
            }

            const removed = removeTemplate(name);
            if (removed) {
                console.log(chalk.green(`✅ Template '${name}' removed.`));
            } else {
                console.log(chalk.yellow(`Template '${name}' was not found.`));
            }

        } catch (error) {
            console.error(chalk.red('Error removing template:'), error.message);
            process.exit(1);
        }
    });

// Validate template command
program
    .command('validate <name>')
    .description('Validate template syntax')
    .action(async (name) => {
        try {
            const template = getTemplate(name);

            if (!template) {
                console.error(chalk.red(`Template '${name}' not found.`));
                process.exit(1);
            }

            const validation = template.validate();

            if (validation.valid) {
                console.log(chalk.green(`✅ Template '${name}' is valid.`));
            } else {
                console.log(chalk.red(`❌ Template '${name}' has errors:`));
                validation.errors.forEach(error => {
                    console.log(`  - ${error}`);
                });
                process.exit(1);
            }

        } catch (error) {
            console.error(chalk.red('Error validating template:'), error.message);
            process.exit(1);
        }
    });

// Generate sample data for template variables
function generateSampleData(variables) {
    const sampleData = {};

    variables.forEach(variable => {
        // Handle nested properties
        if (variable.includes('.')) {
            const parts = variable.split('.');
            let current = sampleData;

            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) {
                    current[parts[i]] = {};
                }
                current = current[parts[i]];
            }

            current[parts[parts.length - 1]] = getSampleValue(variable);
        } else {
            sampleData[variable] = getSampleValue(variable);
        }
    });

    return sampleData;
}

function getSampleValue(variable) {
    const lower = variable.toLowerCase();

    // Common patterns
    if (lower.includes('name')) return 'John Doe';
    if (lower.includes('email')) return 'user@example.com';
    if (lower.includes('url') || lower.includes('link')) return 'https://example.com';
    if (lower.includes('date')) return new Date().toLocaleDateString();
    if (lower.includes('time')) return '30';
    if (lower.includes('amount') || lower.includes('price')) return '99.99';
    if (lower.includes('number') || lower.includes('id')) return '12345';
    if (lower.includes('app')) return 'My App';
    if (lower.includes('company')) return 'My Company';
    if (lower.includes('title')) return 'Sample Title';
    if (lower.includes('message')) return 'This is a sample message.';
    if (lower.includes('items')) return [
        { name: 'Item 1', price: '29.99' },
        { name: 'Item 2', price: '39.99' }
    ];

    // Boolean patterns
    if (lower.includes('required') || lower.includes('enabled') || lower.includes('premium')) {
        return Math.random() > 0.5;
    }

    // Default
    return `Sample ${variable}`;
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error(chalk.red('Unhandled error:'), error.message);
    process.exit(1);
});

program.parse();