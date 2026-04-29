# 📋 Changelog

All notable changes to Senderwolf will be documented in this file.

## [4.3.2] - 2026-04-29

### 🛡️ Security & Reliability Hardening
- **Opportunistic STARTTLS** - The client now automatically prefers and upgrades to STARTTLS if the server supports it, even if `requireTLS` is disabled, drastically improving default security.
- **Header CRLF Injection Prevention** - Enhanced strict sanitization across all standard header fields (`Subject`, `Message-ID`, `From`, `To`, `Cc`, `Reply-To`) to completely mitigate SMTP header injection attacks.
- **Envelope Sender Correctness** - The `MAIL FROM:` SMTP envelope explicitly uses pure email addresses (stripping display names) to prevent envelope validation rejection by strict SMTP relays.
- **Queue Draining Fix** - The pool queue now properly replays waiting requests against idle connections instead of indefinitely stalling under high concurrency limits.

### ⚡ Performance & Memory
- **Native Attachment Streaming** - Attachments can now be efficiently streamed directly to the SMTP socket with real-time base64 encoding, massively reducing memory pressure for large payloads (automatically active when DKIM is disabled).
- **Optimized Pool Tracking** - Refactored internal `activeConnections` to use native `Set` collections preventing key collisions under high concurrency and fixing an edge-case counter underflow on connection failures.
- **Accurate Statistics** - Fixed an issue where `messagesSent` in pool stats was exposed but never incremented.

---

## [4.3.1] - 2026-04-26

### 🛡️ Security Hardening
- **RFC 5321 Dot-Stuffing** - Implemented transparent dot-stuffing in the SMTP DATA stream to prevent message truncation and protocol desync.
- **Injection Protection** - Added strict sanitization for SMTP envelope commands (`MAIL FROM`, `RCPT TO`) and custom headers to prevent protocol injection.
- **Prototype Pollution Guard** - Secured template variable resolution and configuration loading against prototype pollution attacks.
- **Path Traversal Protection** - Added validation for attachment paths to prevent arbitrary file reads.
- **Dev Server Security** - Bound the local preview server to `127.0.0.1`, added CSP sandboxing for HTML previews, and fixed a memory leak by capping stored emails to 100.

### 🔧 Bug Fixes & Stability
- **Pool Reliability** - Fixed `activeConnections` counter underflow and idle timer leaks in the connection pool.
- **Config Management** - Implemented non-mutating config caching and fixed provider/domain re-registration side-effects.
- **Protocol Reliability** - Added mandatory timeouts to all SMTP response reads to prevent indefinite hangs.
- **Date Handling** - Fixed support for ISO 8601 date strings in the `sendAt` scheduling field.
- **Proxy Fixes** - Fixed missing UTF-8 encoding on upgraded TLS sockets when using proxies.

### ⚡ Performance
- **Optimized MIME Assembly** - Switched from string concatenation to array-based joining for building large email bodies, reducing GC pressure and memory usage.
- **Bulk Concurrency Control** - Implemented default concurrency batching (10) for `sendBulk` and `sendBulkTemplate` to prevent pool exhaustion.

---

## [4.3.0] - 2026-04-26

### ✨ What's New

- **🔄 Smart Failover Transports** - Support for secondary SMTP configurations. If the primary transport fails (after its configured retries), Senderwolf automatically attempts to send via the `failover` array of transports.
- **📊 A/B Testing Support** - Native support for rotating subject lines. Provide a `subjects` array, and Senderwolf will randomly select one for the email. Includes a new `mailer.sendAB()` convenience method.
- **🌐 SMTP Proxy Support** - Built-in support for tunneling SMTP connections through **SOCKS5** and **HTTP CONNECT** proxies. Zero external dependencies, using raw Node.js sockets.
- **🔍 Improved MX Validation** - Enhanced recipient domain verification with better error handling and integration into the core sending pipeline.

### 🔧 Improvements & Fixes
- Added `ProxyConfig` and `MXResult` to TypeScript definitions.
- Enhanced `sendEmail` results to include the active `transport` used (e.g., `primary`, `failover-1`).
- Updated internal `coreSend` to handle dev-mode interception across all transport types.

---

## [4.2.0] - 2026-04-23
 
### ✨ What's New
 
- **🔍 Recipient Domain MX Validation** - Built-in verification for recipient email domains.
  - Automatically checks for MX records to prevent bounces and protect sender reputation.
  - Supports RFC 5321-compliant fallback to A/AAAA records if MX records are absent.
  - Enable globally or per-email using `verifyDomain: true`.
  - New exports: `verifyMX()` and `validateRecipientsMX()` for manual validation.
 
## [4.1.0] - 2026-04-07

### ✨ What's New

- **🦕 Deno Compatibility** - Native support for Deno with `node:` prefix imports, `deno.json` configuration, and `mod.js` entry point.

## [4.0.0] - 2026-03-30

- **🎨 Automatic CSS Inlining** - Robust CSS-to-inline-styles transformation using `juice`. Set `inlineCSS: true` to automatically move your `<style>` block rules into element `style` attributes.
- **🛡️ SMTP Circuit Breakers** - Built-in resilience. Automatically "opens" the circuit after 5 consecutive failures, failing fast for subsequent requests.
- **⏱️ Human-Readable Scheduling** - Enhanced `delay` and `sendAt` to support interval strings like `"5m"`, `"1h"`, or `"2d"`.
- **✂️ HTML Minification** - Native HTML minifier to reduce email payload size. Set `minify: true` in your mail options.
- **🏷️ BIMI & DMARC Support** - Support for `BIMI-Location`, `BIMI-Selector` and `DMARC-Filter` headers.
- **🔌 Official Plugin Ecosystem** - Launching three new official plugins to extend core functionality.

### 🔌 Official Plugins

- **[`@senderwolf/plugin-metrics`](file:///@senderwolf/plugin-metrics)**: Multi-dimensional monitoring for active connections, pooled bytes, and failed deliveries with built-in Prometheus/JSON HTTP server.
- **[`@senderwolf/plugin-open-tracker`](file:///@senderwolf/plugin-open-tracker)**: Zero-dependency email analytics for tracking opens (pixel injection) and clicks (link rewriting) with a built-in tracking server.
- **[`@senderwolf/plugin-queue-local`](file:///@senderwolf/plugin-queue-local)**: Persistent SQLite-based bulk job queue for crash-resilient background email sending.

---

## [3.9.0] - 2026-03-29

### ✨ What's New

- **🛠️ Inbuilt Dev Preview Server** - Zero-configuration embedded HTTP server to visualize and test your emails locally without ever dropping a payload onto the network.
  - Set `dev: true` inside your `smtp` configuration to automatically intercept outgoing mail.
  - Provides a beautiful dashboard at `http://localhost:3000` out-of-the-box.
  - Renders visual previews for HTML, plain text, and AMP strings.
  - Native protection against port conflicts (auto-increments upwards).
  - Designed completely ephemerally with `server.unref()` to avoid Node process hanging.

---

## [3.8.0] - 2026-03-28

- **📫 Delivery Status Notification (DSN)** - Native support for tracking email delivery, failure, or delay directly from the SMTP server.
  - Automatically handles `RET`, `ENVID`, `NOTIFY`, and `ORCPT` arguments
- **⚡ AMP for Email** - Native support for interactive, dynamic AMP emails (`text/x-amp-html`).
  - Automatically handles optimal `multipart/alternative` structural injection for backward HTML compatibility.

---

## [3.7.0] - 2026-03-25

### ✨ What's New

- **📅 Calendar Invites (ICS)** - First-class support for sending RFC 5545-compliant calendar invites (`.ics`) as email attachments.
  - Zero-dependency Node.js implementation
  - Auto-rendering in major clients (Gmail, Outlook, Apple Mail) via `multipart/alternative` injection
  - Extensive support for event metadata (summary, time, location, attendees, alarms, recurrence)
  - Automatic plain-text fallback generation if no other body is provided

---

## [3.6.0] - 2026-03-22

### ✨ What's New

- **📝 Pluggable Logger** - Inject your own logger (Winston, Pino, etc.) or use the built-in console-based logger
- **⚙️ Environment Variable Support** - Configure SMTP settings via `SENDERWOLF_` prefixed env vars for cloud-native deployments
- **🖼️ Inline Images (CID)** - Support for `Content-ID` (CID) to embed images directly in HTML emails
- **📎 Automatic MIME Detection** - Intelligent MIME type detection for attachments based on file extensions
- **⏱️ Email Scheduling & Delayed Send** - Schedule emails for specific dates or add arbitrary delays

---

## [3.5.0] - 2026-02-27

### ✨ What's New

- **🔑 DKIM Email Signing** - RFC 6376-compliant DKIM signing using Node.js built-in `crypto` — zero new dependencies
  - `rsa-sha256` algorithm with `relaxed/relaxed` canonicalization (most compatible)
  - Works with direct sends, connection pool, and `createMailer` — all sign automatically
  - Accepts private key as PEM string **or** as an absolute file path
  - Fully configurable signed headers via `headerFields`
- **🔐 Low-level DKIM utilities** — `signMessage()` and `validateDKIMConfig()` exported for advanced use cases
- **🔷 TypeScript** — `DKIMConfig` interface added; `dkim?` field added to `SMTPConfig`

### 🆕 New API

- `smtp.dkim.domainName` - Signing domain (`d=` tag)
- `smtp.dkim.keySelector` - DNS selector (`s=` tag)
- `smtp.dkim.privateKey` - RSA private key PEM string or file path
- `smtp.dkim.headerFields` - Custom header list to sign (optional)
- `smtp.dkim.hashAlgo` - Hash algorithm, only `'sha256'` (optional, default: `'sha256'`)
- `signMessage(message, dkimConfig)` - Low-level message signer (exported from main)
- `validateDKIMConfig(dkim)` - Config validator (exported from main)

### 🔁 Backward Compatibility

- **✅ Zero breaking changes** — omitting `dkim` from config changes nothing

---

## [3.4.0] - 2026-02-21

## ✨ What's New

- Retry Logic with Exponential Backoff
- Smart Error Classification
- Jitter on Retry Delays
- Custom Retry Control
- Structured Event System
- Event Listeners on Mailer Instances
- Global Event Listeners
- Attempt Tracking in Results 

## 🛠️ Improvements

- Connection Pooling Fix
- Pool Configuration Validation
- Provider Field Preserved
- Enhanced TypeScript Definitions
- Comprehensive Validation Suite

## 🔄️ Backward Compatibility

- Fully compatible with older versions
- Events fire silently with no listeners attached — zero overhead when unused
- sendEmail() result shape unchanged — attempts field is additive
- All existing APIs (sendGmail, quickSend, createMailer, etc.) work identically

---

## [3.3.0] - 2025-01-27

### ✨ What's New

- **🔷 Complete TypeScript Support** - Full type definitions with IntelliSense
- **📧 Advanced Template System** - 4 built-in templates with variable substitution
- **🔧 Template CLI Tool** - Complete command-line interface for template management
- **⚡ Enhanced Connection Pooling** - 50-80% faster bulk email sending
- **📊 Pool Statistics** - Real-time monitoring with `getPoolStats()`
- **🛡️ Rate Limiting** - Built-in protection against provider limits
- **🎨 Template Engine** - Support for conditionals, loops, and nested variables
- **💾 Template File Operations** - Save/load templates from JSON files
- **🔍 Template Validation** - Syntax checking and error reporting
- **📝 Template Categories** - Organized templates by use case
- **🚀 Bulk Template Sending** - Send templated emails to multiple recipients
- **🎯 Template Preview** - Preview rendered templates before sending
- **13+ Built-in Email Providers** - Gmail, Outlook, SendGrid, and more
- **🔍 Auto Provider Detection** - Automatic SMTP configuration from email address
- **⚙️ Runtime Provider Registration** - Add custom providers dynamically
- **🔐 OAuth 2 & XOAUTH2 Support** - Modern authentication methods
- **📬 CC/BCC Recipients** - Multiple recipient types support
- **⚡ Email Priority Levels** - High, normal, and low priority emails
- **📋 Custom Headers Support** - Add custom email headers
- **🔒 STARTTLS Support** - Secure email transmission
- **🧪 Connection Testing** - Verify SMTP settings before sending
- **📦 Bulk Emailing** - Efficient mass email sending with pooling
- **🎯 Simple API Methods** - One-liner functions for common tasks
- **🔧 Enhanced CLI** - Interactive mode and comprehensive options
- **🐛 Debug Mode** - Detailed logging for troubleshooting

### 🛠️ Improvements

- **📝 Better Error Messages** - More descriptive and actionable error reporting
- **✅ Enhanced Validation** - Comprehensive input validation and sanitization
- **📚 Improved Documentation** - Complete examples and usage guides
- **🏗️ Extensible Architecture** - Easy to add new providers and features
- **🎨 Template System Architecture** - Modular and extensible template engine
- **🔧 CLI User Experience** - Interactive prompts and better help text
- **⚡ Performance Optimizations** - Faster email processing and connection handling
- **🛡️ Security Enhancements** - Better credential handling and validation
- **📊 Monitoring Capabilities** - Pool statistics and performance metrics
- **🔍 Provider Discovery** - SMTP setting suggestions for unknown domains

### 🔁 Backward Compatibility

- **✅ Full v3.0.0 Compatibility** - All existing code continues to work
- **🔧 CLI Compatibility** - Existing CLI commands remain unchanged
- **⚙️ Configuration Compatibility** - All configuration formats supported
- **📦 API Compatibility** - No breaking changes to existing functions
- **🔌 Provider Compatibility** - All existing providers continue to work

### 🆕 New Functions & Methods

#### Template System

- `registerTemplate(name, config)` - Register custom templates
- `getTemplate(name)` - Retrieve template by name
- `listTemplates(category?)` - List all or filtered templates
- `removeTemplate(name)` - Remove template from registry
- `previewTemplate(name, variables)` - Preview rendered template
- `TemplateEngine.compile(template, variables)` - Direct template compilation
- `EmailTemplate` class - Template object with validation
- `TemplateManager` class - Template registry management

#### Enhanced Mailer

- `mailer.sendTemplate(templateName, to, variables)` - Send templated email
- `mailer.sendBulkTemplate(templateName, recipients, variables)` - Bulk template sending
- `mailer.previewTemplate(templateName, variables)` - Preview template
- `mailer.getStats()` - Get mailer-specific statistics

#### Pool Management

- `getPoolStats()` - Get connection pool statistics
- `closeAllPools()` - Close all active connection pools

#### Provider Management

- `suggestSMTPSettings(domain)` - Get SMTP suggestions for domain
- `getAllProviders()` - Get all registered providers
- `hasProvider(name)` - Check if provider exists

### 🔧 CLI Enhancements

#### New `senderwolf-templates` CLI

- `list` - List all available templates
- `show <name>` - Show template details
- `preview <name>` - Preview template with sample data
- `create` - Create new template interactively
- `load <path>` - Load template from file
- `save <name> <path>` - Save template to file
- `remove <name>` - Remove template
- `validate <name>` - Validate template syntax

#### Enhanced `senderwolf` CLI

- `--interactive` - Interactive email composition
- `--dry-run` - Preview email without sending
- `--suggest <domain>` - Get SMTP suggestions
- `--config-example` - Show configuration examples
- `--debug` - Enable detailed logging

### 📦 Built-in Templates

1. **Welcome** - User onboarding emails
2. **Password Reset** - Account recovery emails
3. **Notification** - General notification emails
4. **Invoice** - Business invoice emails

### 🔷 TypeScript Features

- **Complete Type Definitions** - Full IntelliSense support
- **Generic Types** - Type-safe template variables
- **Interface Definitions** - All configuration objects typed
- **Enum Types** - Provider names, priorities, auth types
- **JSDoc Documentation** - Rich tooltips in IDEs
- **Compile-time Validation** - Catch errors before runtime

### 🐛 Bug Fixes

- Fixed connection pool cleanup on process exit
- Improved error handling for invalid SMTP configurations
- Fixed template variable extraction for nested properties
- Enhanced CLI argument parsing and validation
- Resolved memory leaks in connection pooling
- Fixed provider detection for custom domains

### 📚 Documentation Updates

- Added comprehensive template system guide
- Enhanced CLI documentation with examples
- Added TypeScript usage examples
- Updated provider configuration examples
- Added troubleshooting guide
- Enhanced API reference documentation

---

## [3.2.0] - 2024-12-15

### ✨ What's New

- **🚀 Built-in Connection Pooling** - 50-80% faster bulk email sending
- **⚡ High Performance** - Efficient connection reuse and management
- **🔄 Automatic Pool Management** - Smart connection rotation and cleanup
- **📊 Pool Monitoring** - Real-time statistics
- **🛡️ Rate Limiting** - Built-in protection against provider limits

### 🛠️ Improvements

- Enhanced bulk email performance
- Better connection management
- Improved error handling

### 🔁 Backward Compatibility

- Full v3.1.0 compatibility maintained
- No breaking changes

---

## [3.1.0] - 2024-11-20

### ✨ What's New

- Enhanced provider detection
- Improved CLI interface
- Better error messages

### 🛠️ Improvements

- Performance optimizations
- Documentation updates
- Code quality improvements

---

## [3.0.0] - 2024-10-15

### ✨ What's New

- Complete rewrite with modern Node.js
- 13+ built-in email providers
- Auto provider detection
- Enhanced CLI tools
- Comprehensive documentation

### 🛠️ Improvements

- Better architecture
- Improved performance
- Enhanced security

### 💥 Breaking Changes

- Requires Node.js 16+
- New API structure
- Updated configuration format

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © 2025 [Chandraprakash](https://github.com/Chandraprakash-03)
