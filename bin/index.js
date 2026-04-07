#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import inquirer from "inquirer";
import { sendEmail } from "../lib/sendEmail.js";
import { loadConfig } from "../lib/config.js";
import {
    listProviders,
    getProviderConfig,
    detectProvider,
    testConnection,
    suggestSMTPSettings
} from "../index.js";

const program = new Command();

program
    .name("senderwolf")
    .description("📨 The simplest way to send emails via SMTP from your terminal.")
    .version("3.1.0", "-v, --version", "Display senderwolf CLI version")
    .usage("[options]")
    .addHelpText(
        "after",
        `
Examples:
  # Simple email with auto-detection
  $ senderwolf --user your@gmail.com --pass yourapppass \\
    --to someone@example.com --subject "Hello" --html "<h1>World!</h1>"

  # Use provider preset
  $ senderwolf --provider gmail --user your@gmail.com --pass yourapppass \\
    --to person@xyz.com --subject "Hello" --html ./email.html

  # Multiple recipients with CC/BCC
  $ senderwolf --user your@outlook.com --pass password \\
    --to "user1@example.com,user2@example.com" --cc manager@example.com \\
    --bcc audit@example.com --subject "Team Update" --html "<h1>Update</h1>"

  # With attachments and priority
  $ senderwolf --provider sendgrid --user apikey --pass your-api-key \\
    --to customer@example.com --subject "Invoice" --html ./invoice.html \\
    --attachments "invoice.pdf,receipt.png" --priority high

  # Test connection
  $ senderwolf --test --provider gmail --user your@gmail.com --pass yourapppass

  # List available providers
  $ senderwolf --list-providers
`
    )
    // Authentication & Provider Options
    .option("-u, --user <email>", "SMTP username/email")
    .option("-p, --pass <password>", "SMTP password or app password")
    .option("--provider <name>", "Email provider (gmail, outlook, sendgrid, etc.)")
    .option("--auth-type <type>", "Authentication type (login, plain, oauth2, xoauth2)")

    // Email Content Options
    .option("-t, --to <emails>", "Recipient email(s) - comma-separated for multiple")
    .option("--cc <emails>", "CC email(s) - comma-separated for multiple")
    .option("--bcc <emails>", "BCC email(s) - comma-separated for multiple")
    .option("-s, --subject <text>", "Email subject")
    .option("-h, --html <html>", "HTML content or path to .html file")
    .option("-x, --text <text>", "Plain text content")
    .option("--reply-to <email>", "Reply-to email address")
    .option("--priority <level>", "Email priority (high, normal, low)")

    // SMTP Configuration Options
    .option("-H, --host <host>", "SMTP host (auto-detected if provider specified)")
    .option("-P, --port <port>", "SMTP port (auto-detected if provider specified)", parseInt)
    .option("-S, --secure <bool>", "Use SSL/TLS (auto-detected if provider specified)", (value) => value === "true")
    .option("--require-tls", "Require STARTTLS")
    .option("--ignore-tls", "Ignore TLS certificate errors")

    // Sender Options
    .option("-n, --from-name <name>", "Sender name")
    .option("-e, --from-email <email>", "Sender email (defaults to --user)")

    // Attachment & Advanced Options
    .option("-a, --attachments <paths>", "Comma-separated file paths")
    .option("--headers <json>", "Custom headers as JSON string")
    .option("--message-id <id>", "Custom message ID")

    // Mode Options
    .option("-i, --interactive", "Launch interactive mode")
    .option("-d, --dry-run", "Preview email without sending")
    .option("--debug", "Enable debug logging")

    // Utility Options
    .option("--test", "Test SMTP connection without sending email")
    .option("--list-providers", "List all available email providers")
    .option("--suggest <domain>", "Get SMTP suggestions for a domain")
    .option("--config-example", "Show configuration file example")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .parse();

const opts = program.opts();

// Handle utility commands first
if (opts.listProviders) {
    console.log(chalk.cyan("📋 Available Email Providers:\n"));
    const providers = listProviders();
    providers.forEach(provider => {
        console.log(chalk.green(`  ${provider.name.padEnd(12)} - ${provider.displayName}`));
        console.log(chalk.gray(`    ${provider.host}:${provider.port} (SSL: ${provider.secure})`));
    });
    console.log(chalk.yellow(`\n💡 Use --provider <name> to use any of these providers`));
    process.exit(0);
}

if (opts.suggest) {
    console.log(chalk.cyan(`🔍 SMTP Suggestions for ${opts.suggest}:\n`));
    const suggestions = suggestSMTPSettings(opts.suggest);
    console.log(chalk.green("Possible SMTP hosts:"));
    suggestions.suggestions.forEach(host => console.log(chalk.white(`  - ${host}`)));
    console.log(chalk.green("\nCommon ports:"));
    suggestions.commonPorts.forEach(port => console.log(chalk.white(`  - ${port}`)));
    console.log(chalk.yellow(`\n💡 ${suggestions.note}`));
    process.exit(0);
}

if (opts.configExample) {
    console.log(chalk.cyan("📄 Example .senderwolfrc.json configuration:\n"));
    const example = {
        provider: "gmail",
        user: "your@gmail.com",
        pass: "your-app-password",
        fromName: "My Application",
        fromEmail: "your@gmail.com",
        replyTo: "support@myapp.com",
        customProviders: {
            mycompany: {
                host: "smtp.mycompany.com",
                port: 587,
                secure: false,
                requireTLS: true
            }
        },
        customDomains: {
            "mycompany.com": "mycompany"
        }
    };
    console.log(chalk.white(JSON.stringify(example, null, 2)));
    console.log(chalk.yellow("\n💡 Place this file in your project root or home directory"));
    process.exit(0);
}

const config = await loadConfig();
if (opts.debug) {
    console.log(chalk.gray("🔧 Loaded config:"), config);
}

const useInteractive = opts.interactive || Object.keys(opts).length === 0;

// Auto-detect provider if not specified
let providerConfig = {};
const userEmail = opts.user || config.user;

if (opts.provider) {
    providerConfig = getProviderConfig(opts.provider) || {};
    if (!providerConfig.host) {
        console.log(chalk.red(`❌ Unknown provider: ${opts.provider}`));
        console.log(chalk.yellow("💡 Use --list-providers to see available options"));
        process.exit(1);
    }
} else if (userEmail && !opts.host) {
    const detected = detectProvider(userEmail);
    if (detected) {
        providerConfig = getProviderConfig(detected) || {};
        if (opts.debug) {
            console.log(chalk.gray(`🔍 Auto-detected provider: ${detected}`));
        }
    }
}

const merged = {
    // Authentication
    user: opts.user || config.user,
    pass: opts.pass || config.pass,
    provider: opts.provider || config.provider,
    authType: opts.authType || config.authType || "login",

    // Recipients
    to: opts.to,
    cc: opts.cc,
    bcc: opts.bcc,
    replyTo: opts.replyTo || config.replyTo,

    // Content
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    priority: opts.priority || "normal",

    // SMTP Configuration
    host: opts.host || config.host || providerConfig.host || "smtp.gmail.com",
    port: opts.port || config.port || providerConfig.port || 465,
    secure: typeof opts.secure === "boolean"
        ? opts.secure
        : (config.secure ?? providerConfig.secure ?? true),
    requireTLS: opts.requireTls || config.requireTLS || providerConfig.requireTLS || false,
    ignoreTLS: opts.ignoreTls || config.ignoreTLS || false,

    // Sender
    fromName: opts.fromName || config.fromName || "Senderwolf",
    fromEmail: opts.fromEmail || config.fromEmail || userEmail,

    // Advanced
    attachments: opts.attachments,
    headers: opts.headers ? JSON.parse(opts.headers) : {},
    messageId: opts.messageId,
    debug: opts.debug || config.debug || false,

    // Modes
    interactive: opts.interactive,
    dryRun: opts.dryRun,
    test: opts.test,
};
// Handle test connection
if (merged.test) {
    if (!merged.user || !merged.pass) {
        console.log(chalk.red("❌ Username and password required for connection test"));
        process.exit(1);
    }

    console.log(chalk.cyan("🔌 Testing SMTP connection...\n"));

    const testConfig = {
        smtp: {
            host: merged.host,
            port: merged.port,
            secure: merged.secure,
            requireTLS: merged.requireTLS,
            ignoreTLS: merged.ignoreTLS,
            debug: merged.debug,
            auth: {
                user: merged.user,
                pass: merged.pass,
                type: merged.authType
            }
        }
    };

    try {
        const result = await testConnection(testConfig);
        if (result.success) {
            console.log(chalk.green(`✅ Connection successful!`));
            console.log(chalk.gray(`   Host: ${merged.host}:${merged.port}`));
            console.log(chalk.gray(`   Secure: ${merged.secure}`));
            console.log(chalk.gray(`   Auth: ${merged.authType}`));
        } else {
            console.log(chalk.red(`❌ Connection failed: ${result.message}`));
        }
    } catch (error) {
        console.log(chalk.red(`💥 Test error: ${error.message}`));
    }
    process.exit(0);
}

let smtp = {};
let mail = {};
let attachments = [];

if (useInteractive) {
    console.log(chalk.cyanBright("🐺 Senderwolf Interactive Mode\n"));

    let answers = {};
    try {
        // First, ask for provider preference
        const providerChoice = await inquirer.prompt([
            {
                type: "list",
                name: "providerType",
                message: "How would you like to configure SMTP?",
                choices: [
                    { name: "Auto-detect from email address", value: "auto" },
                    { name: "Choose from built-in providers", value: "preset" },
                    { name: "Manual SMTP configuration", value: "manual" }
                ]
            }
        ]);

        let providerQuestions = [];

        if (providerChoice.providerType === "preset") {
            const providers = listProviders();
            providerQuestions.push({
                type: "list",
                name: "provider",
                message: "Select email provider:",
                choices: providers.map(p => ({ name: `${p.displayName} (${p.name})`, value: p.name }))
            });
        } else if (providerChoice.providerType === "manual") {
            providerQuestions.push(
                { name: "host", message: "SMTP host:" },
                { name: "port", message: "SMTP port:", default: "587" },
                {
                    type: "list",
                    name: "secure",
                    message: "Connection type:",
                    choices: [
                        { name: "STARTTLS (port 587)", value: false },
                        { name: "SSL/TLS (port 465)", value: true }
                    ]
                }
            );
        }

        const providerAnswers = await inquirer.prompt(providerQuestions);

        // Main email questions
        answers = await inquirer.prompt([
            { name: "user", message: "Your email (SMTP username):" },
            { type: "password", name: "pass", message: "App password:", mask: "*" },
            { name: "fromName", message: "Your name (optional):" },
            { name: "to", message: "Recipient email(s) (comma-separated):" },
            { name: "cc", message: "CC email(s) (optional, comma-separated):" },
            { name: "bcc", message: "BCC email(s) (optional, comma-separated):" },
            { name: "replyTo", message: "Reply-to email (optional):" },
            { name: "subject", message: "Email subject:" },
            {
                type: "list",
                name: "contentType",
                message: "Email content type:",
                choices: [
                    { name: "HTML content", value: "html" },
                    { name: "Plain text", value: "text" },
                    { name: "HTML file", value: "file" }
                ]
            }
        ]);

        // Content questions based on type
        if (answers.contentType === "html") {
            const htmlAnswer = await inquirer.prompt([
                { name: "html", message: "HTML content:" }
            ]);
            answers.html = htmlAnswer.html;
        } else if (answers.contentType === "text") {
            const textAnswer = await inquirer.prompt([
                { name: "text", message: "Plain text content:" }
            ]);
            answers.text = textAnswer.text;
        } else if (answers.contentType === "file") {
            const fileAnswer = await inquirer.prompt([
                { name: "htmlFile", message: "Path to HTML file:" }
            ]);
            answers.htmlFile = fileAnswer.htmlFile;
        }

        // Additional options
        const additionalAnswers = await inquirer.prompt([
            {
                type: "list",
                name: "priority",
                message: "Email priority:",
                choices: ["normal", "high", "low"],
                default: "normal"
            },
            { name: "attachments", message: "Comma-separated attachments (optional):" },
        ]);

        // Merge all answers
        Object.assign(answers, providerAnswers, additionalAnswers);
        answers.providerType = providerChoice.providerType;

    } catch (err) {
        console.log(chalk.yellow("\n❌ Prompt cancelled. Exiting..."));
        process.exit(0);
    }

    // Handle content
    let html, text;
    if (answers.html) {
        html = answers.html;
    } else if (answers.htmlFile) {
        try {
            if (fs.existsSync(answers.htmlFile)) {
                html = fs.readFileSync(answers.htmlFile, "utf-8");
            } else {
                console.log(chalk.red(`❌ HTML file not found: ${answers.htmlFile}`));
                process.exit(1);
            }
        } catch (error) {
            console.log(chalk.red(`❌ Error reading HTML file: ${error.message}`));
            process.exit(1);
        }
    } else if (answers.text) {
        text = answers.text;
    }

    // Handle attachments
    attachments = answers.attachments
        ? answers.attachments.split(",").map((path) => ({
            filename: path.trim().split("/").pop(),
            path: path.trim(),
        }))
        : [];

    // Build SMTP config based on provider type
    let smtpConfig = {};

    if (answers.providerType === "auto") {
        const detected = detectProvider(answers.user);
        if (detected) {
            const providerConfig = getProviderConfig(detected);
            smtpConfig = {
                host: providerConfig.host,
                port: providerConfig.port,
                secure: providerConfig.secure,
                requireTLS: providerConfig.requireTLS || false,
            };
            console.log(chalk.green(`✅ Auto-detected provider: ${detected}`));
        } else {
            console.log(chalk.yellow("⚠️  Could not auto-detect provider, using Gmail defaults"));
            smtpConfig = { host: "smtp.gmail.com", port: 465, secure: true };
        }
    } else if (answers.providerType === "preset") {
        const providerConfig = getProviderConfig(answers.provider);
        smtpConfig = {
            host: providerConfig.host,
            port: providerConfig.port,
            secure: providerConfig.secure,
            requireTLS: providerConfig.requireTLS || false,
        };
    } else {
        smtpConfig = {
            host: answers.host,
            port: parseInt(answers.port) || 587,
            secure: answers.secure,
            requireTLS: !answers.secure,
        };
    }

    smtp = {
        ...smtpConfig,
        auth: {
            user: answers.user,
            pass: answers.pass,
        },
    };

    mail = {
        to: answers.to,
        cc: answers.cc || undefined,
        bcc: answers.bcc || undefined,
        replyTo: answers.replyTo || undefined,
        subject: answers.subject,
        html,
        text,
        priority: answers.priority,
        attachments,
        fromName: answers.fromName || "Senderwolf",
        fromEmail: answers.user,
    };
} else {
    if (!merged.user || !merged.pass || !merged.to || !merged.subject || (!merged.html && !merged.text)) {
        console.log(chalk.red("❌ Missing required options.\n"));
        program.outputHelp();
        process.exit(1);
    }

    // Handle HTML content (file or string)
    let html = merged.html;
    if (html) {
        try {
            if (typeof html === "string" && fs.existsSync(html) && html.endsWith(".html")) {
                html = fs.readFileSync(html, "utf-8");
            }
        } catch {
            // Use as string
        }
    }

    // Handle attachments
    attachments = merged.attachments
        ? merged.attachments.split(",").map((path) => ({
            filename: path.trim().split("/").pop(),
            path: path.trim(),
        }))
        : [];

    // Parse multiple recipients
    const parseEmails = (emailString) => {
        return emailString ? emailString.split(",").map(email => email.trim()) : undefined;
    };

    smtp = {
        host: merged.host,
        port: merged.port,
        secure: merged.secure,
        requireTLS: merged.requireTLS,
        ignoreTLS: merged.ignoreTLS,
        debug: merged.debug,
        auth: {
            user: merged.user,
            pass: merged.pass,
            type: merged.authType,
        },
    };

    mail = {
        to: parseEmails(merged.to),
        cc: parseEmails(merged.cc),
        bcc: parseEmails(merged.bcc),
        replyTo: merged.replyTo,
        subject: merged.subject,
        html: merged.text ? undefined : html,
        text: merged.text || undefined,
        priority: merged.priority,
        headers: merged.headers,
        messageId: merged.messageId,
        attachments,
        fromName: merged.fromName,
        fromEmail: merged.fromEmail,
    };
}

// 🧪 Dry-run mode
if (merged.dryRun) {
    console.log(chalk.yellow("🚫 Dry run mode enabled — no email sent.\n"));

    console.log(chalk.cyan("📬 SMTP Configuration:"));
    console.log(chalk.white(`  Host: ${smtp.host}:${smtp.port}`));
    console.log(chalk.white(`  Secure: ${smtp.secure}`));
    console.log(chalk.white(`  Auth Type: ${smtp.auth.type}`));
    console.log(chalk.white(`  User: ${smtp.auth.user}`));

    console.log(chalk.cyan("\n📧 Email Preview:"));
    console.log(chalk.white(`  From: ${mail.fromName ? `"${mail.fromName}" <${mail.fromEmail}>` : mail.fromEmail}`));
    console.log(chalk.white(`  To: ${Array.isArray(mail.to) ? mail.to.join(", ") : mail.to}`));
    if (mail.cc) console.log(chalk.white(`  CC: ${Array.isArray(mail.cc) ? mail.cc.join(", ") : mail.cc}`));
    if (mail.bcc) console.log(chalk.white(`  BCC: ${Array.isArray(mail.bcc) ? mail.bcc.join(", ") : mail.bcc}`));
    if (mail.replyTo) console.log(chalk.white(`  Reply-To: ${mail.replyTo}`));
    console.log(chalk.white(`  Subject: ${mail.subject}`));
    if (mail.priority !== "normal") console.log(chalk.white(`  Priority: ${mail.priority}`));
    if (mail.html) console.log(chalk.white(`  HTML: ${mail.html.substring(0, 100)}${mail.html.length > 100 ? "..." : ""}`));
    if (mail.text) console.log(chalk.white(`  Text: ${mail.text.substring(0, 100)}${mail.text.length > 100 ? "..." : ""}`));
    if (attachments.length > 0) {
        console.log(chalk.white(`  Attachments: ${attachments.map(a => a.filename).join(", ")}`));
    }
    if (mail.headers && Object.keys(mail.headers).length > 0) {
        console.log(chalk.white(`  Custom Headers: ${JSON.stringify(mail.headers)}`));
    }

    process.exit(0);
}

// 📤 Send email
console.log(chalk.cyan("📨 Sending email...\n"));

if (merged.debug) {
    console.log(chalk.gray("🔧 SMTP Config:"), smtp);
    console.log(chalk.gray("🔧 Mail Config:"), mail);
}

try {
    const result = await sendEmail({ smtp, mail });
    if (result.success) {
        console.log(chalk.green(`✅ Email sent successfully!`));
        console.log(chalk.gray(`   Message ID: ${result.messageId}`));
        console.log(chalk.gray(`   To: ${Array.isArray(mail.to) ? mail.to.join(", ") : mail.to}`));
        if (mail.cc) console.log(chalk.gray(`   CC: ${Array.isArray(mail.cc) ? mail.cc.join(", ") : mail.cc}`));
        if (attachments.length > 0) {
            console.log(chalk.gray(`   Attachments: ${attachments.length} file(s)`));
        }
    } else {
        console.log(chalk.red(`❌ Failed to send email: ${result.error}`));

        // Provide helpful suggestions based on error
        if (result.error.includes('authentication') || result.error.includes('535')) {
            console.log(chalk.yellow("💡 Check your username and password"));
            console.log(chalk.yellow("   For Gmail, use an App Password instead of your regular password"));
        } else if (result.error.includes('connection') || result.error.includes('ECONNREFUSED')) {
            console.log(chalk.yellow("💡 Check your network connection and SMTP settings"));
            console.log(chalk.yellow("   Try --test to verify your SMTP configuration"));
        }
    }
} catch (err) {
    console.log(chalk.red(`💥 Unexpected error: ${err.message}`));

    if (merged.debug) {
        console.log(chalk.gray("Stack trace:"), err.stack);
    } else {
        console.log(chalk.yellow("💡 Use --debug for more detailed error information"));
    }
}
