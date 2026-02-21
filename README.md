# 🐺 Senderwolf

> **The simplest way to send emails in Node.js** - Powerful, intuitive, and built for modern developers.

[![npm version](https://badge.fury.io/js/senderwolf.svg)](https://www.npmjs.com/package/senderwolf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Senderwolf** makes email sending **ridiculously simple**. Built from the ground up with an intuitive API, automatic provider detection, built-in connection pooling, and zero configuration for popular email services.

## 🆕 What's New in v3.4.0

- 🔄 **Retry Logic with Exponential Backoff** - Automatic retry for transient SMTP failures
- ⚡ **Smart Error Classification** - Never retries auth errors, only transient failures
- 📡 **Structured Event System** - Lifecycle hooks for `sending`, `sent`, `failed`, `retrying`
- 🎯 **Event Listeners on Mailer** - `mailer.on()`, `mailer.off()`, `mailer.once()` with chaining
- 🛡️ **Connection Pooling Fix** - Fixed critical bug where pooling was silently disabled
- 📊 **Attempt Tracking** - `sendEmail()` now returns `attempts` count in results
- 🔧 **Pool Schema Validation** - Proper Zod validation for pool configuration
- 🛡️ **Zero Breaking Changes** - Full backward compatibility

## ✨ Key Features

- ✅ **One-liner email sending** - Send emails with a single function call
- ✅ **High-performance connection pooling** - 50-80% faster bulk email sending
- ✅ **Auto-provider detection** - Just provide your email, we handle the rest
- ✅ **Built-in provider presets** - 13+ popular email services ready to use
- ✅ **Retry with exponential backoff** - Automatic retry for transient SMTP failures
- ✅ **Event system & hooks** - Lifecycle events for sending, sent, failed, retrying
- ✅ **Zero SMTP dependencies** - Pure Node.js implementation
- ✅ **Modern authentication** - OAuth2, XOAUTH2, and traditional methods
- ✅ **Extensible architecture** - Add any SMTP provider instantly
- ✅ **Full email features** - CC/BCC, attachments, custom headers, priority
- ✅ **Template system** - 4 built-in templates with variable substitution
- ✅ **CLI tools** - Complete command-line interface for email and template management
- ✅ **Clear error messages** - Actionable feedback for troubleshooting
- ✅ **TypeScript support** - Complete type definitions with IntelliSense

---

## 🚀 Quick Start

### Installation

```bash
npm install senderwolf
```

**TypeScript users**: Type definitions are included automatically!

### Send Your First Email (3 Ways)

#### 1. **Super Simple** (One-liner)

```js
import { sendGmail } from "senderwolf";

await sendGmail(
	"your@gmail.com",
	"app-password",
	"to@example.com",
	"Hello!",
	"<h1>World!</h1>"
);
```

#### 2. **Auto-Detection** (Just provide your email)

```js
import { sendEmail } from "senderwolf";

await sendEmail({
	smtp: {
		auth: { user: "your@outlook.com", pass: "password" }, // Auto-detects Outlook!
	},
	mail: {
		to: "recipient@example.com",
		subject: "Hello from Senderwolf!",
		html: "<h1>No SMTP configuration needed!</h1>",
	},
});
```

#### 3. **High-Performance Mailer** (For multiple emails - Recommended)

```js
import { createMailer } from "senderwolf";

const mailer = createMailer({
	smtp: {
		provider: "gmail",
		auth: { user: "your@gmail.com", pass: "app-password" },
	},
});

// Single email
await mailer.sendHtml("to@example.com", "Subject", "<h1>Hello World!</h1>");

// Bulk sending with connection pooling (50-80% faster!)
const results = await mailer.sendBulk(
	["user1@example.com", "user2@example.com", "user3@example.com"],
	"Newsletter",
	"<h1>Monthly Update</h1>"
);
```

---

## 🔷 TypeScript Support

Senderwolf includes comprehensive TypeScript support with full type definitions:

```typescript
import {
	sendEmail,
	createMailer,
	type SendEmailConfig,
	type Mailer,
} from "senderwolf";

// Type-safe configuration with IntelliSense
const config: SendEmailConfig = {
	smtp: {
		provider: "gmail", // Auto-completion for providers
		auth: {
			user: "your@gmail.com",
			pass: "app-password",
			type: "login", // Only valid auth types allowed
		},
	},
	mail: {
		to: "recipient@example.com",
		subject: "TypeScript Email",
		html: "<h1>Fully typed!</h1>",
		priority: "high", // Only 'high' | 'normal' | 'low' allowed
	},
};

const result = await sendEmail(config); // Fully typed result
```

**Features:**

- Complete type definitions for all functions and interfaces
- IntelliSense support with auto-completion
- Compile-time error checking
- Rich JSDoc documentation in IDE tooltips

---

## 📧 Template System

Senderwolf includes a powerful template system with built-in templates and custom template support:

### **Built-in Templates**

```js
import { previewTemplate, listTemplates } from "senderwolf";

// List all available templates
console.log(listTemplates()); // welcome, passwordReset, notification, invoice

// Preview a template with variables
const preview = previewTemplate("welcome", {
	appName: "My App",
	userName: "John Doe",
	verificationUrl: "https://myapp.com/verify",
});

console.log(preview.subject); // "Welcome to My App!"
console.log(preview.html); // Rendered HTML
```

### **Custom Templates**

```js
import { registerTemplate, createMailer } from "senderwolf";

// Register a custom template
registerTemplate('order-confirmation', {
  subject: 'Order #{{orderNumber}} Confirmed',
  html: `
    <h1>Thank you {{customerName}}!</h1>
    <p>Your order #{{orderNumber}} has been confirmed.</p>
    <ul>
      {{#each items}}
      <li>{{this.name}}: ${{this.price}}</li>
      {{/each}}
    </ul>
    <p>Total: ${{totalAmount}}</p>
  `,
  description: 'Order confirmation email',
  category: 'ecommerce'
});

// Use template in email
const mailer = createMailer({ /* config */ });
await mailer.sendTemplate('order-confirmation', 'customer@example.com', {
  customerName: 'John Doe',
  orderNumber: '12345',
  items: [
    { name: 'Product 1', price: '29.99' },
    { name: 'Product 2', price: '39.99' }
  ],
  totalAmount: '69.98'
});
```

### **Template CLI**

```bash
# List all templates
senderwolf-templates list

# Show template details
senderwolf-templates show welcome

# Preview template with data
senderwolf-templates preview welcome --variables '{"appName":"MyApp","userName":"John"}'

# Create new template interactively
senderwolf-templates create

# Save/load templates from files
senderwolf-templates save welcome ./templates/welcome.json
senderwolf-templates load ./templates/welcome.json
```

---

## 🌐 Supported Providers

### **Built-in Support** (No configuration needed!)

- **Gmail** - `gmail`
- **Outlook/Hotmail/Live** - `outlook`
- **Yahoo** - `yahoo`
- **Zoho** - `zoho`
- **Amazon SES** - `ses`
- **SendGrid** - `sendgrid`
- **Mailgun** - `mailgun`
- **Postmark** - `postmark`
- **Mailjet** - `mailjet`
- **Mailtrap** - `mailtrap`
- **Resend** - `resend`
- **Brevo** - `brevo`
- **ConvertKit** - `convertkit`

### **Plus Any Custom SMTP Server**

```js
await sendEmail({
	smtp: {
		host: "mail.your-domain.com",
		port: 587,
		secure: false,
		requireTLS: true,
		auth: { user: "noreply@your-domain.com", pass: "password" },
	},
	mail: {
		/* ... */
	},
});
```

### **🔧 Easily Add New Providers**

```js
import { registerProvider } from "senderwolf";

// Add any new email service instantly
registerProvider("newservice", {
	host: "smtp.newservice.com",
	port: 587,
	secure: false,
	requireTLS: true,
});

// Use it immediately
await sendEmail({
	smtp: {
		provider: "newservice",
		auth: { user: "you@newservice.com", pass: "pass" },
	},
	mail: {
		to: "user@example.com",
		subject: "Hello!",
		html: "<h1>It works!</h1>",
	},
});
```

---

## 📧 Full Email Features

### **Multiple Recipients**

```js
await sendEmail({
	smtp: {
		provider: "gmail",
		auth: { user: "your@gmail.com", pass: "app-password" },
	},
	mail: {
		to: ["user1@example.com", "user2@example.com"],
		cc: "manager@example.com",
		bcc: ["audit@example.com", "backup@example.com"],
		subject: "Team Update",
		html: "<h1>Important announcement</h1>",
	},
});
```

### **Attachments** (Files, Buffers, Streams)

```js
await sendEmail({
	smtp: {
		provider: "gmail",
		auth: { user: "your@gmail.com", pass: "app-password" },
	},
	mail: {
		to: "recipient@example.com",
		subject: "Files attached",
		html: "<p>Please find the attached files.</p>",
		attachments: [
			{ filename: "document.pdf", path: "./files/document.pdf" },
			{ filename: "data.json", content: JSON.stringify({ data: "value" }) },
			{ filename: "buffer.txt", content: Buffer.from("Hello World!") },
		],
	},
});
```

### **Advanced Options**

```js
await sendEmail({
	smtp: {
		provider: "gmail",
		auth: { user: "your@gmail.com", pass: "app-password" },
	},
	mail: {
		to: "recipient@example.com",
		replyTo: "support@example.com",
		subject: "Advanced Email",
		html: "<h1>Professional Email</h1>",
		priority: "high",
		headers: {
			"X-Custom-Header": "Custom Value",
			"X-Mailer": "Senderwolf",
		},
	},
});
```

---

## 🔐 Authentication Methods

### **Basic Authentication** (Most common)

```js
auth: {
    user: 'your@gmail.com',
    pass: 'your-app-password',
    type: 'login' // Default
}
```

### **OAuth2** (Recommended for production)

```js
auth: {
    type: 'oauth2',
    user: 'your@gmail.com',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    refreshToken: 'your-refresh-token'
}
```

### **XOAUTH2** (Modern apps)

```js
auth: {
    type: 'xoauth2',
    user: 'your@gmail.com',
    accessToken: 'your-access-token'
}
```

---

## ⚡ Simple API Methods

### **One-Liner Functions**

```js
import { sendGmail, sendOutlook, quickSend } from "senderwolf";

// Gmail shortcut
await sendGmail(
	"your@gmail.com",
	"app-password",
	"to@example.com",
	"Subject",
	"<h1>HTML</h1>"
);

// Outlook shortcut
await sendOutlook(
	"your@outlook.com",
	"password",
	"to@example.com",
	"Subject",
	"Text content"
);

// Any provider
await quickSend(
	"sendgrid",
	"apikey",
	"your-api-key",
	"to@example.com",
	"Subject",
	"<h1>HTML</h1>"
);
```

### **High-Performance Mailer** (Automatic Connection Pooling)

```js
import { createMailer } from "senderwolf";

const mailer = createMailer({
	smtp: {
		provider: "gmail",
		auth: { user: "your@gmail.com", pass: "app-password" },
	},
	defaults: { fromName: "My App", replyTo: "support@myapp.com" },
});

// Simple methods
await mailer.sendHtml("user@example.com", "Welcome!", "<h1>Welcome!</h1>");
await mailer.sendText("user@example.com", "Reset Code", "Your code: 123456");

// With attachments
await mailer.sendWithAttachments(
	"user@example.com",
	"Invoice",
	"<p>Your invoice is attached.</p>",
	[{ filename: "invoice.pdf", path: "./invoice.pdf" }]
);

// High-performance bulk sending (50-80% faster with connection pooling!)
const results = await mailer.sendBulk(
	["user1@example.com", "user2@example.com"],
	"Newsletter",
	"<h1>Monthly Update</h1>"
);
```

---

## 🛠️ Configuration

### **Config File** (Recommended)

Create `.senderwolfrc.json` in your project root:

```json
{
	"provider": "gmail",
	"user": "your@gmail.com",
	"pass": "your-app-password",
	"fromName": "My Application",
	"fromEmail": "your@gmail.com",
	"replyTo": "support@myapp.com",

	"customProviders": {
		"mycompany": {
			"host": "smtp.mycompany.com",
			"port": 587,
			"secure": false,
			"requireTLS": true
		}
	},

	"customDomains": {
		"mycompany.com": "mycompany"
	}
}
```

Now send emails with minimal code:

```js
await sendEmail({
	mail: {
		to: "user@example.com",
		subject: "Using Config",
		html: "<p>SMTP settings loaded automatically!</p>",
	},
});
```

---

## 🔍 Testing & Debugging

### **Test Connection**

```js
import { testConnection } from "senderwolf";

const result = await testConnection({
	smtp: {
		provider: "gmail",
		auth: { user: "your@gmail.com", pass: "app-password" },
	},
});

console.log(result.success ? "Connected!" : "Failed:", result.message);
```

### **Debug Mode**

```js
await sendEmail({
	smtp: {
		provider: "gmail",
		debug: true, // Enable detailed logging
		auth: { user: "your@gmail.com", pass: "app-password" },
	},
	mail: {
		/* ... */
	},
});
```

### **Provider Discovery**

```js
import { listProviders, suggestSMTPSettings } from "senderwolf";

// List all available providers
console.log(listProviders());

// Get suggestions for unknown domains
console.log(suggestSMTPSettings("newcompany.com"));
```

---

## 🚀 CLI Usage

Senderwolf includes comprehensive command-line tools for both email sending and template management.

### **Email CLI (`senderwolf`)**

#### **Basic Commands**

```bash
# Simple email with auto-detection
senderwolf --user your@gmail.com --pass yourapppass \
  --to someone@example.com --subject "Hello" --html "<h1>World!</h1>"

# Use provider preset
senderwolf --provider gmail --user your@gmail.com --pass yourapppass \
  --to person@xyz.com --subject "Hello" --html ./email.html

# Multiple recipients with CC/BCC
senderwolf --user your@outlook.com --pass password \
  --to "user1@example.com,user2@example.com" \
  --cc manager@example.com --bcc audit@example.com \
  --subject "Team Update" --html "<h1>Update</h1>"

# Interactive mode (guided setup)
senderwolf --interactive

# Dry run (preview without sending)
senderwolf --dry-run --provider gmail --user your@gmail.com --pass yourapppass \
  --to user@example.com --subject "Test" --html "<h1>Preview</h1>"
```

#### **Utility Commands**

```bash
# Test SMTP connection
senderwolf --test --provider gmail --user your@gmail.com --pass yourapppass

# List all available providers
senderwolf --list-providers

# Get SMTP suggestions for a domain
senderwolf --suggest mycompany.com

# Show configuration file example
senderwolf --config-example
```

### **Template CLI (`senderwolf-templates`)**

```bash
# List all templates
senderwolf-templates list

# Show template details
senderwolf-templates show welcome

# Preview template with sample data
senderwolf-templates preview welcome

# Preview with custom variables
senderwolf-templates preview welcome \
  --variables '{"appName":"MyApp","userName":"John"}'

# Create new template interactively
senderwolf-templates create

# Load template from file
senderwolf-templates load ./my-template.json

# Save template to file
senderwolf-templates save welcome ./welcome-template.json

# Remove template
senderwolf-templates remove my-template --force

# Validate template syntax
senderwolf-templates validate welcome
```

---

## 📚 Examples & Documentation

- **[examples.js](examples.js)** - Comprehensive usage examples
- **[examples/](examples/)** - Real-world example scripts
- **[ADDING-PROVIDERS.md](ADDING-PROVIDERS.md)** - Guide for adding new email providers
- **[TEMPLATES.md](TEMPLATES.md)** - Complete template system documentation
- **Configuration examples** for all major providers
- **Error handling patterns** and troubleshooting

---

## 🔧 Advanced Features

### **🔧 Connection Pooling** (High Performance)

Senderwolf includes built-in connection pooling for efficient bulk email sending:

```js
import { sendEmail, createMailer } from "senderwolf";

// Automatic pooling with createMailer (recommended for multiple emails)
const mailer = createMailer({
	smtp: {
		provider: "gmail",
		pool: {
			maxConnections: 5, // Max concurrent connections
			maxMessages: 100, // Max messages per connection
			rateDelta: 1000, // Rate limiting window (ms)
			rateLimit: 3, // Max messages per rateDelta
			idleTimeout: 30000, // Connection idle timeout (ms)
		},
		auth: { user: "your@gmail.com", pass: "app-password" },
	},
});

// Efficient bulk sending using pooled connections (50-80% faster!)
const results = await mailer.sendBulk(
	["user1@example.com", "user2@example.com", "user3@example.com"],
	"Newsletter",
	"<h1>Monthly Update</h1>"
);
```

**Pool Configuration Options:**

- `maxConnections` - Maximum concurrent SMTP connections (default: 5)
- `maxMessages` - Messages per connection before rotation (default: 100)
- `rateDelta` - Rate limiting time window in ms (default: 1000)
- `rateLimit` - Max messages per rateDelta (default: 3)
- `idleTimeout` - Connection idle timeout in ms (default: 30000)

**Pool Management:**

```js
import { getPoolStats, closeAllPools } from "senderwolf";

// Monitor pool performance
console.log(getPoolStats());

// Graceful shutdown
await closeAllPools();
```

**Performance Benefits:**

- 🚀 **50-80% faster** bulk email sending
- 💾 **Reduced memory usage** through connection reuse
- ⚡ **Lower CPU usage** with efficient connection management
- 🛡️ **Built-in rate limiting** to avoid provider limits
- 🔄 **Automatic connection rotation** for reliability

### **🔄 Retry Logic with Exponential Backoff**

Senderwolf automatically retries failed email sends on transient errors like connection timeouts and SMTP 4xx responses — with exponential backoff and jitter to prevent thundering herd:

```js
import { sendEmail } from "senderwolf";

const result = await sendEmail({
	smtp: {
		provider: "gmail",
		auth: { user: "your@gmail.com", pass: "app-password" },
	},
	mail: {
		to: "recipient@example.com",
		subject: "Important Update",
		html: "<h1>Hello!</h1>",
	},
	retry: {
		maxRetries: 3,         // Retry up to 3 times (default: 0 = disabled)
		initialDelay: 1000,    // 1s before first retry (default: 1000)
		backoffMultiplier: 2,  // Double the delay each retry (default: 2)
		maxDelay: 30000,       // Cap delay at 30s (default: 30000)
	},
});

console.log(`Delivered in ${result.attempts} attempt(s)`);
```

**Retry with createMailer** (applies to all sends):

```js
const mailer = createMailer({
	smtp: {
		provider: "gmail",
		auth: { user: "your@gmail.com", pass: "app-password" },
	},
	retry: { maxRetries: 2 }, // Default retry for all sends
});

// Override per-send
await mailer.send({
	to: "user@example.com",
	subject: "Critical Alert",
	html: "<p>Alert!</p>",
	retry: { maxRetries: 5 }, // Override with more retries
});
```

**Custom retry logic:**

```js
await sendEmail({
	// ...smtp & mail config
	retry: {
		maxRetries: 3,
		retryableErrors: ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"], // Custom error codes
	},
});
```

**Standalone retry utility:**

```js
import { withRetry } from "senderwolf";

// Wrap any async function with retry
const { result, attempts } = await withRetry(
	async (attempt) => {
		console.log(`Attempt ${attempt}...`);
		return await someAsyncOperation();
	},
	{ maxRetries: 3, initialDelay: 500 }
);
```

**Smart error classification:**

- ✅ **Retries:** `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EPIPE`, `EHOSTUNREACH`, SMTP 4xx, DNS failures
- ❌ **Never retries:** Authentication errors, invalid mailbox, relay denied, SMTP 5xx

**Retry Configuration Options:**

| Option | Default | Description |
|--------|---------|-------------|
| `maxRetries` | `0` (disabled) | Maximum retry attempts |
| `initialDelay` | `1000` | Milliseconds before first retry |
| `backoffMultiplier` | `2` | Delay multiplier per retry |
| `maxDelay` | `30000` | Maximum delay cap in ms |
| `retryableErrors` | See above | Error codes to retry on |

---

### **📡 Event System & Lifecycle Hooks**

Senderwolf emits events at every stage of the email lifecycle — perfect for logging, monitoring, analytics, and error tracking:

```js
import { on, off, once, removeAllListeners } from "senderwolf";

// Listen to lifecycle events
on("sending", ({ to, subject, attempt }) => {
	console.log(`📤 Sending to ${to} (attempt ${attempt})...`);
});

on("sent", ({ messageId, to, elapsed, attempt }) => {
	console.log(`✅ Delivered ${messageId} to ${to} in ${elapsed}ms`);
});

on("failed", ({ error, to, attempt, willRetry }) => {
	console.warn(`❌ Failed to send to ${to}: ${error}`);
	if (willRetry) console.log("  ↻ Will retry...");
});

on("retrying", ({ to, attempt, delay, error }) => {
	console.log(`🔄 Retrying to ${to} (attempt ${attempt}) in ${delay}ms`);
});
```

**Events on mailer instances** (with method chaining):

```js
const mailer = createMailer({ /* config */ });

mailer
	.on("sent", ({ messageId, elapsed }) => {
		console.log(`Delivered in ${elapsed}ms`);
	})
	.on("failed", ({ error }) => {
		console.error(`Send failed: ${error}`);
	});

await mailer.sendHtml("user@example.com", "Subject", "<h1>Hi!</h1>");
```

**One-time listeners:**

```js
// Listen once — automatically removed after first event
once("sent", ({ messageId }) => {
	console.log(`First email sent: ${messageId}`);
});

// Remove specific listener
off("sent", myListener);

// Remove all listeners for an event
removeAllListeners("failed");
```

**Event Payloads:**

| Event | Payload | When |
|-------|---------|------|
| `sending` | `{ to, subject, attempt, timestamp }` | Before each send attempt |
| `sent` | `{ messageId, to, subject, elapsed, attempt, timestamp }` | After successful delivery |
| `failed` | `{ error, to, subject, attempt, willRetry, timestamp }` | After a failed attempt |
| `retrying` | `{ to, subject, attempt, maxRetries, delay, error, timestamp }` | Before a retry delay |

---

### **Bulk Email Sending**

```js
const mailer = createMailer({
	/* config */
});

const recipients = [
	"user1@example.com",
	"user2@example.com",
	"user3@example.com",
];
const results = await mailer.sendBulk(
	recipients,
	"Newsletter",
	"<h1>Monthly Update</h1>"
);

results.forEach((result) => {
	console.log(`${result.recipient}: ${result.success ? "Sent" : "Failed"}`);
});
```

### **Custom Error Handling**

```js
try {
	await sendEmail({
		/* config */
	});
} catch (error) {
	if (error.message.includes("authentication")) {
		console.log("Check your credentials");
	} else if (error.message.includes("connection")) {
		console.log("Check your network/firewall");
	}
}
```

### **Provider Management**

```js
import { registerProvider, hasProvider, getAllProviders } from "senderwolf";

// Add new provider
registerProvider("newservice", { host: "smtp.newservice.com", port: 587 });

// Check if provider exists
console.log(hasProvider("newservice")); // true

// Get all provider configurations
console.log(getAllProviders());
```

---

## 🔒 Security Best Practices

1. **Use App Passwords** for Gmail (not your main password)
2. **Use OAuth2** for production applications
3. **Store credentials** in environment variables or config files
4. **Enable 2FA** on your email accounts
5. **Use STARTTLS** when available (`requireTLS: true`)

---

## 🤝 Contributing

We welcome contributions! Whether it's:

- Adding new email provider presets
- Improving documentation
- Fixing bugs
- Adding features

See our [contribution guidelines](CONTRIBUTING.md) and [provider addition guide](ADDING-PROVIDERS.md).

---

## 📄 License

MIT © 2025 [Chandraprakash](https://github.com/Chandraprakash-03)

---

## 🌟 Why Senderwolf?

- **🚀 Faster development** - Less time configuring, more time building
- **⚡ High performance** - Built-in connection pooling for 50-80% faster bulk sending
- **🔄 Resilient** - Automatic retry with exponential backoff for transient failures
- **📡 Observable** - Structured event system for logging, monitoring, and analytics
- **🧠 Lower cognitive load** - Intuitive API that just makes sense
- **🔮 Future-proof** - Easily add any new email provider
- **🪶 Lightweight** - Zero unnecessary dependencies
- **🛡️ Reliable** - Built on Node.js native modules with robust error handling
- **📧 Template system** - Built-in templates with advanced variable substitution
- **🔧 CLI tools** - Complete command-line interface for all operations
- **📚 Well-documented** - Clear examples and guides

**Ready to simplify your email sending?** Install senderwolf today!

```bash
npm install senderwolf
```

---

<div align="center">

**[🌐 Website](https://senderwolf.vercel.app)** • **[📖 Documentation](https://github.com/Chandraprakash-03/senderwolf)** • **[🐛 Issues](https://github.com/Chandraprakash-03/senderwolf/issues)** • **[💬 Discussions](https://github.com/Chandraprakash-03/senderwolf/discussions)**

Made with ❤️ for developers who value simplicity

</div>
