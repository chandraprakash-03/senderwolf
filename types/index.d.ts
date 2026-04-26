/**
 * TypeScript definitions for senderwolf
 * The simplest way to send emails in Node.js
 */

import { Readable } from "stream";

// ============================================================================
// Template Types
// ============================================================================

export interface TemplateVariables {
	[key: string]: any;
}

export interface RenderedTemplate {
	subject: string;
	html: string;
	text: string;
}

export interface EmailTemplateConfig {
	subject?: string;
	html?: string;
	text?: string;
	variables?: string[];
	description?: string;
	category?: string;
	created?: Date;
	updated?: Date;
}

export interface EmailTemplate {
	name: string;
	subject: string;
	html: string;
	text: string;
	variables: string[];
	description: string;
	category: string;
	created: Date;
	updated: Date;
	render(variables?: TemplateVariables): RenderedTemplate;
	validate(): { valid: boolean; errors: string[] };
	toJSON(): EmailTemplateConfig & { name: string };
}

export interface TemplateValidationResult {
	valid: boolean;
	errors: string[];
}

// ============================================================================
// Core Types
// ============================================================================

export interface EmailAddress {
	name?: string;
	address: string;
}

export type EmailRecipient = string | EmailAddress;
export type EmailRecipients = EmailRecipient | EmailRecipient[];

// ============================================================================
// Authentication Types
// ============================================================================

export interface BasicAuth {
	user: string;
	pass: string;
	type?: "login" | "plain";
}

export interface OAuth2Auth {
	type: "oauth2";
	user: string;
	clientId: string;
	clientSecret: string;
	refreshToken: string;
	accessToken?: string;
}

export interface XOAuth2Auth {
	type: "xoauth2";
	user: string;
	accessToken: string;
}

export type AuthConfig = BasicAuth | OAuth2Auth | XOAuth2Auth;

// ============================================================================
// DKIM Signing Types
// ============================================================================

export interface DKIMConfig {
	/**
	 * The domain the email is sent from (d= tag).
	 * Example: 'example.com'
	 */
	domainName: string;
	/**
	 * DNS selector for the public key lookup (s= tag).
	 * Example: 'mail' → looks up TXT record at mail._domainkey.example.com
	 */
	keySelector: string;
	/**
	 * RSA private key in PEM format, or an absolute filesystem path to a PEM file.
	 * Generated with: openssl genrsa -out private.pem 2048
	 */
	privateKey: string;
	/**
	 * List of header field names to include in the DKIM signature.
	 * Defaults to: ['from','to','subject','date','message-id','mime-version','content-type','cc']
	 */
	headerFields?: string[];
	/**
	 * Hashing algorithm. Currently only 'sha256' is supported (rsa-sha256).
	 * @default 'sha256'
	 */
	hashAlgo?: 'sha256';
}

// ============================================================================
// Attachment Types
// ============================================================================

export interface FileAttachment {
	filename: string;
	path: string;
	contentType?: string;
	/** Content-ID for inline images (e.g. 'logo-1') */
	cid?: string;
}

export interface BufferAttachment {
	filename: string;
	content: Buffer | string;
	contentType?: string;
	encoding?: string;
	/** Content-ID for inline images (e.g. 'logo-1') */
	cid?: string;
}

export interface StreamAttachment {
	filename: string;
	content: Readable;
	contentType?: string;
}

export type Attachment = FileAttachment | BufferAttachment | StreamAttachment;

// ============================================================================
// Connection Pool Types
// ============================================================================

export interface PoolConfig {
	/** Maximum concurrent SMTP connections (default: 5) */
	maxConnections?: number;
	/** Messages per connection before rotation (default: 100) */
	maxMessages?: number;
	/** Rate limiting time window in ms (default: 1000) */
	rateDelta?: number;
	/** Max messages per rateDelta (default: 3) */
	rateLimit?: number;
	/** Connection idle timeout in ms (default: 30000) */
	idleTimeout?: number;
}

export interface PoolStats {
	activeConnections: number;
	idleConnections: number;
	queuedRequests: number;
	messagesSent: number;
	maxConnections: number;
}

// ============================================================================
// Retry Types
// ============================================================================

export interface RetryConfig {
	/** Maximum number of retry attempts (default: 0 — disabled) */
	maxRetries?: number;
	/** Initial delay in ms before first retry (default: 1000) */
	initialDelay?: number;
	/** Multiplier applied to delay after each retry (default: 2) */
	backoffMultiplier?: number;
	/** Maximum delay cap in ms (default: 30000) */
	maxDelay?: number;
	/** Error codes that are retryable (default: ECONNRESET, ETIMEDOUT, etc.) */
	retryableErrors?: string[];
	/** Custom function to determine if an error should be retried */
	shouldRetry?: (error: Error) => boolean;
}

// ============================================================================
// Event Types
// ============================================================================

export interface SendingEvent {
	to: EmailRecipients;
	subject: string;
	attempt: number;
	timestamp: number;
}

export interface SentEvent {
	messageId: string;
	to: EmailRecipients;
	subject: string;
	elapsed: number;
	attempt: number;
	timestamp: number;
}

export interface FailedEvent {
	error: string;
	to: EmailRecipients;
	subject: string;
	attempt: number;
	willRetry: boolean;
	timestamp: number;
}

export interface RetryingEvent {
	to: EmailRecipients;
	subject: string;
	attempt: number;
	maxRetries: number;
	delay: number;
	error: string;
	timestamp: number;
}

export type SenderwolfEventMap = {
	sending: SendingEvent;
	sent: SentEvent;
	failed: FailedEvent;
	retrying: RetryingEvent;
};

export type SenderwolfEventName = keyof SenderwolfEventMap;

// ============================================================================
// SMTP Configuration Types
// ============================================================================

export interface SMTPConfig {
	/** SMTP server hostname */
	host?: string;
	/** SMTP server port */
	port?: number;
	/** Use secure connection (SSL/TLS) */
	secure?: boolean;
	/** Require STARTTLS */
	requireTLS?: boolean;
	/** Ignore TLS certificate errors */
	ignoreTLS?: boolean;
	/** Authentication configuration */
	auth: AuthConfig;
	/** Connection timeout in ms (default: 60000) */
	connectionTimeout?: number;
	/** Greeting timeout in ms (default: 30000) */
	greetingTimeout?: number;
	/** Socket timeout in ms (default: 60000) */
	socketTimeout?: number;
	/** Enable debug logging */
	debug?: boolean;
	/** Hostname for EHLO command */
	name?: string;
	/** Provider name (gmail, outlook, etc.) */
	provider?: string;
	/** Connection pool configuration */
	pool?: PoolConfig;
	/** Use connection pooling (default: true for createMailer) */
	usePool?: boolean;
	/**
	 * DKIM signing configuration.
	 * When provided, outgoing emails will be signed with the RSA private key
	 * using rsa-sha256 and relaxed/relaxed canonicalization (RFC 6376).
	 */
	dkim?: DKIMConfig;
	/** Custom logger instance (must implement info, warn, error, debug) */
	logger?: any;
	/** Proxy configuration for SMTP connection */
	proxy?: ProxyConfig;
}

export interface ProxyConfig {
	host: string;
	port: number;
	type?: 'socks5' | 'socks4' | 'http';
	auth?: {
		user: string;
		pass: string;
	};
}

// ============================================================================
// Mail Configuration Types
// ============================================================================
// Calendar Configuration Types
// ============================================================================

export interface CalendarEventAttendee {
	name?: string;
	email: string;
	rsvp?: boolean;
}

export interface CalendarEventAlarm {
	/** Trigger duration, e.g. '-PT15M' for 15 min before */
	trigger: string;
	description?: string;
}

export interface CalendarEvent {
	/** Unique event ID (auto-generated if omitted) */
	uid?: string;
	/** Event title (required) */
	summary: string;
	/** Event start time (required) */
	start: Date;
	/** Event end time (required) */
	end: Date;
	/** Event description */
	description?: string;
	/** Event location */
	location?: string;
	/** Event URL */
	url?: string;
	/** Organizer info */
	organizer?: { name?: string; email: string };
	/** Attendees */
	attendees?: CalendarEventAttendee[];
	/** iTIP method (default: REQUEST) */
	method?: 'REQUEST' | 'CANCEL' | 'REPLY';
	/** Event status (default: CONFIRMED) */
	status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
	/** All-day event (date only, no time) */
	allDay?: boolean;
	/** RRULE string for recurring events (e.g. 'FREQ=WEEKLY;COUNT=4') */
	recurrence?: string;
	/** Reminder alarm */
	alarm?: CalendarEventAlarm;
	/** Sequence number — increment on updates (default: 0) */
	sequence?: number;
}

// ============================================================================
// Mail Configuration Types
// ============================================================================

export interface MailConfig {
	/** Sender email address */
	from?: EmailRecipient;
	/** Recipient email address(es) */
	to: EmailRecipients;
	/** CC recipient email address(es) */
	cc?: EmailRecipients;
	/** BCC recipient email address(es) */
	bcc?: EmailRecipients;
	/** Reply-to email address */
	replyTo?: EmailRecipient;
	/** Email subject */
	subject: string;
	/** HTML email content */
	html?: string;
	/** Plain text email content */
	text?: string;
	/** Custom email headers */
	headers?: Record<string, string>;
	/** Email priority */
	priority?: "high" | "normal" | "low";
	/** Sender name */
	fromName?: string;
	/** Sender email address */
	fromEmail?: string;
	/** Email attachments */
	attachments?: Attachment[];
	/** Text encoding (default: 'utf8') */
	encoding?: string;
	/** Email date */
	date?: Date;
	/** Custom message ID */
	messageId?: string;
	/** Attach a calendar invite (ICS) to this email */
	calendar?: CalendarEvent;
	/** Verify recipient domain MX records before sending */
	verifyDomain?: boolean;
	/** Multiple subjects for A/B testing */
	subjects?: string[];
}

// ============================================================================
// Main Configuration Types
// ============================================================================

export interface SendEmailConfig {
	smtp?: SMTPConfig;
	mail: MailConfig;
	/** Retry configuration for transient failures */
	retry?: RetryConfig;
	/** Schedule email to be sent at a specific time */
	sendAt?: Date | string;
	/** Delay email sending by specified milliseconds */
	delay?: number;
	/** Failover SMTP configurations */
	failover?: SMTPConfig[];
}

export interface MailerDefaults {
	fromName?: string;
	fromEmail?: string;
	replyTo?: string;
	headers?: Record<string, string>;
	priority?: "high" | "normal" | "low";
}

export interface CreateMailerConfig {
	smtp: SMTPConfig;
	defaults?: MailerDefaults;
	/** Default retry configuration for all sends */
	retry?: RetryConfig;
}

// ============================================================================
// Response Types
// ============================================================================

export interface SendEmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
	/** Number of attempts made (1 = no retries) */
	attempts?: number;
}

export interface BulkSendResult {
	recipient: string;
	success: boolean;
	messageId?: string;
	error?: string;
}

export interface TestConnectionResult {
	success: boolean;
	message: string;
	messageId?: string;
	error?: Error;
}

// ============================================================================
// Provider Types
// ============================================================================

export interface ProviderConfig {
	host: string;
	port: number;
	secure: boolean;
	requireTLS?: boolean;
	name: string;
}

export interface ProviderInfo {
	name: string;
	displayName: string;
	host: string;
	port: number;
	secure: boolean;
}

export interface SMTPSuggestions {
	suggestions: string[];
	commonPorts: number[];
	note: string;
}

// ============================================================================
// Configuration File Types
// ============================================================================

export interface SenderwolfConfig {
	provider?: string;
	user?: string;
	pass?: string;
	host?: string;
	port?: number;
	secure?: boolean;
	requireTLS?: boolean;
	fromName?: string;
	fromEmail?: string;
	replyTo?: string;
	debug?: boolean;
	authType?: string;
	pool?: PoolConfig;
	usePool?: boolean;
	customProviders?: Record<string, Partial<ProviderConfig>>;
	customDomains?: Record<string, string>;
}

// ============================================================================
// Mailer Instance Type
// ============================================================================

export interface Mailer {
	/**
	 * Send a simple email
	 */
	send(
		options: Partial<MailConfig> & { smtp?: Partial<SMTPConfig> }
	): Promise<SendEmailResult>;

	/**
	 * Send HTML email
	 */
	sendHtml(
		to: EmailRecipients,
		subject: string,
		html: string,
		options?: Partial<MailConfig>
	): Promise<SendEmailResult>;

	/**
	 * Send text email
	 */
	sendText(
		to: EmailRecipients,
		subject: string,
		text: string,
		options?: Partial<MailConfig>
	): Promise<SendEmailResult>;

	/**
	 * Send email with attachments
	 */
	sendWithAttachments(
		to: EmailRecipients,
		subject: string,
		content: string,
		attachments: Attachment[],
		options?: Partial<MailConfig>
	): Promise<SendEmailResult>;

	/**
	 * Send A/B testing email with multiple subject lines
	 */
	sendAB(
		to: EmailRecipients,
		subjects: string[],
		content: string,
		options?: Partial<MailConfig>
	): Promise<SendEmailResult>;

	/**
	 * Send bulk emails (leverages connection pooling for efficiency)
	 */
	sendBulk(
		recipients: string[],
		subject: string,
		content: string,
		options?: Partial<MailConfig>
	): Promise<BulkSendResult[]>;

	/**
	 * Send email using a template
	 */
	sendTemplate(
		templateName: string,
		to: EmailRecipients,
		variables?: TemplateVariables,
		options?: Partial<MailConfig>
	): Promise<SendEmailResult>;

	/**
	 * Send bulk emails using a template
	 */
	sendBulkTemplate(
		templateName: string,
		recipients: string[],
		variables?: TemplateVariables | ((recipient: string) => TemplateVariables),
		options?: Partial<MailConfig>
	): Promise<BulkSendResult[]>;

	/**
	 * Preview a template with variables (without sending)
	 */
	previewTemplate(
		templateName: string,
		variables?: TemplateVariables
	): RenderedTemplate;

	/**
	 * Close the connection pool for this mailer
	 */
	close(): Promise<void>;

	/**
	 * Get connection pool statistics
	 */
	getStats(): Promise<Record<string, PoolStats>>;

	/**
	 * Subscribe to email lifecycle events
	 */
	on<E extends SenderwolfEventName>(
		event: E,
		listener: (data: SenderwolfEventMap[E]) => void
	): Mailer;

	/**
	 * Unsubscribe from email lifecycle events
	 */
	off<E extends SenderwolfEventName>(
		event: E,
		listener: (data: SenderwolfEventMap[E]) => void
	): Mailer;

	/**
	 * Subscribe to a single occurrence of an event
	 */
	once<E extends SenderwolfEventName>(
		event: E,
		listener: (data: SenderwolfEventMap[E]) => void
	): Mailer;
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Send an email using any SMTP provider with enhanced features
 */
export function sendEmail(config: SendEmailConfig): Promise<SendEmailResult>;

/**
 * Create a reusable mailer instance with preset configuration
 */
export function createMailer(config: CreateMailerConfig): Mailer;

/**
 * Quick send functions for one-off emails
 */
export function quickSend(
	provider: string,
	user: string,
	pass: string,
	to: EmailRecipients,
	subject: string,
	content: string,
	options?: Partial<MailConfig>
): Promise<SendEmailResult>;

/**
 * Gmail shortcut
 */
export function sendGmail(
	user: string,
	pass: string,
	to: EmailRecipients,
	subject: string,
	content: string,
	options?: Partial<MailConfig>
): Promise<SendEmailResult>;

/**
 * Outlook shortcut
 */
export function sendOutlook(
	user: string,
	pass: string,
	to: EmailRecipients,
	subject: string,
	content: string,
	options?: Partial<MailConfig>
): Promise<SendEmailResult>;

/**
 * Test email connectivity
 */
export function testConnection(
	config: SendEmailConfig
): Promise<TestConnectionResult>;

// ============================================================================
// Provider Management Functions
// ============================================================================

/**
 * Get provider configuration by name or auto-detect from email
 */
export function getProviderConfig(
	providerOrEmail: string
): ProviderConfig | null;

/**
 * Auto-detect provider based on email domain
 */
export function detectProvider(email: string): string | null;

/**
 * Register a new SMTP provider
 */
export function registerProvider(
	name: string,
	config: Partial<ProviderConfig>
): ProviderConfig;

/**
 * Remove a provider
 */
export function unregisterProvider(name: string): void;

/**
 * Register a domain mapping to a provider
 */
export function registerDomain(domain: string, provider: string): void;

/**
 * Check if a provider exists
 */
export function hasProvider(name: string): boolean;

/**
 * Suggest SMTP settings for unknown domains
 */
export function suggestSMTPSettings(domain: string): SMTPSuggestions | null;

/**
 * List all available providers
 */
export function listProviders(): ProviderInfo[];

/**
 * Get all provider configurations
 */
export function getAllProviders(): Record<string, ProviderConfig>;

// ============================================================================
// Configuration Functions
// ============================================================================

/**
 * Load configuration from file
 */
export function loadConfig(): Promise<SenderwolfConfig>;

// ============================================================================
// Pool Management Functions
// ============================================================================

/**
 * Close all connection pools (useful for graceful shutdown)
 */
export function closeAllPools(): Promise<void>;

/**
 * Get statistics for all connection pools
 */
export function getPoolStats(): Record<string, PoolStats>;

// ============================================================================
// Event Functions
// ============================================================================

/**
 * Subscribe to email lifecycle events
 */
export function on<E extends SenderwolfEventName>(
	event: E,
	listener: (data: SenderwolfEventMap[E]) => void
): void;

/**
 * Unsubscribe from email lifecycle events
 */
export function off<E extends SenderwolfEventName>(
	event: E,
	listener: (data: SenderwolfEventMap[E]) => void
): void;

/**
 * Subscribe to a single occurrence of an event
 */
export function once<E extends SenderwolfEventName>(
	event: E,
	listener: (data: SenderwolfEventMap[E]) => void
): void;

/**
 * Remove all event listeners
 */
export function removeAllListeners(event?: SenderwolfEventName): void;

/**
 * The global event emitter instance
 */
export const senderwolfEvents: import('events').EventEmitter;

// ============================================================================
// Retry Functions
// ============================================================================

/**
 * Wrap an async function with retry logic and exponential backoff
 */
export function withRetry<T>(
	fn: (attempt: number) => Promise<T>,
	options?: RetryConfig,
	callbacks?: { onRetry?: (info: { attempt: number; maxRetries: number; delay: number; error: string }) => void }
): Promise<{ result: T; attempts: number }>;

/**
 * Default retry configuration options
 */
export const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryConfig, 'shouldRetry' | 'retryableErrors'>> & { retryableErrors: string[] };

// ============================================================================
// HTML to Text Utility
// ============================================================================

/**
 * Convert HTML string to plain text (zero-dependency)
 */
export function htmlToText(html: string): string;

// ============================================================================
// Domain and MX Validation Functions
// ============================================================================

export interface MXResult {
	valid: boolean;
	records?: { exchange: string; priority: number }[];
	domain: string;
	error?: string;
	fallback?: boolean;
}

/**
 * Verify a domain or email address for MX records
 */
export function verifyMX(emailOrDomain: string): Promise<MXResult>;

/**
 * Verify multiple email addresses for MX records
 */
export function validateRecipientsMX(emails: string | string[]): Promise<MXResult[]>;

// ============================================================================
// DKIM Utility Functions
// ============================================================================

/**
 * Sign a raw email message string with DKIM.
 *
 * This is a low-level utility exposed for advanced use cases.
 * In normal usage, simply pass `dkim` inside `smtp` config to sendEmail() or createMailer().
 *
 * @param message - Full raw email message (headers + \r\n\r\n + body), WITHOUT the "\r\n.\r\n" DATA terminator
 * @param dkimConfig - DKIM signing configuration
 * @returns The message with the `DKIM-Signature` header prepended
 */
export function signMessage(message: string, dkimConfig: DKIMConfig): string;

/**
 * Validate a DKIM config object.
 * Throws a descriptive Error if the config is missing required fields.
 * Returns true if the config is valid.
 */
export function validateDKIMConfig(dkim: DKIMConfig): true;

// ============================================================================
// ICS / Calendar Utility Functions
// ============================================================================

/**
 * Generate a complete RFC 5545 iCalendar string from an event object.
 */
export function generateICS(event: CalendarEvent): string;

/**
 * Validate a calendar event object.
 * Throws a descriptive Error if required fields are missing or invalid.
 */
export function validateCalendarEvent(event: any): true;

/**
 * Format a JS Date to iCalendar UTC date-time string: YYYYMMDDTHHmmssZ
 */
export function formatICSDate(date: Date): string;

// ============================================================================
// Queue Store Types
// ============================================================================

/**
 * Abstract base class for Queue Storage backends.
 * Extend this class to implement a custom persistent queue plugin
 * (e.g. @senderwolf/plugin-queue-local).
 */
export abstract class QueueStore {
	protected options: Record<string, any>;
	constructor(options?: Record<string, any>);

	/**
	 * Enqueue a new email job.
	 * @param payload - The job payload containing smtp, mailOptions, retryOptions, etc.
	 * @returns The unique job ID assigned to the queued email.
	 */
	abstract enqueue(payload: Record<string, any>): Promise<string | number>;

	/**
	 * Start the background worker daemon that processes queued jobs.
	 */
	abstract startWorker(): Promise<void>;

	/**
	 * Gracefully stop the worker and release any held resources.
	 */
	abstract stopWorker(): Promise<void>;
}

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base error class for all Senderwolf errors
 */
export class SenderwolfError extends Error {
	name: string;
	code: string;
	constructor(message: string, code?: string);
}

/**
 * Connection-related errors (timeouts, socket failures, TLS issues)
 */
export class ConnectionError extends SenderwolfError {
	name: 'ConnectionError';
	constructor(message: string);
}

/**
 * Authentication errors (wrong credentials, unsupported auth method)
 */
export class AuthenticationError extends SenderwolfError {
	name: 'AuthenticationError';
	constructor(message: string);
}

/**
 * SMTP protocol-level errors (command rejections, send failures)
 */
export class SMTPError extends SenderwolfError {
	name: 'SMTPError';
	smtpResponse: string | null;
	responseCode: number | null;
	constructor(message: string, smtpResponse?: string, responseCode?: number);
}

/**
 * Validation errors (schema validation failures)
 */
export class ValidationError extends SenderwolfError {
	name: 'ValidationError';
	errors: any[];
	constructor(message: string, errors?: any[]);
}

/**
 * Template-related errors (missing templates, invalid config)
 */
export class TemplateError extends SenderwolfError {
	name: 'TemplateError';
	constructor(message: string);
}

/**
 * Provider-related errors (missing/invalid provider config)
 */
export class ProviderError extends SenderwolfError {
	name: 'ProviderError';
	constructor(message: string);
}

/**
 * Connection pool errors (pool closed, connection expired)
 */
export class PoolError extends SenderwolfError {
	name: 'PoolError';
	constructor(message: string);
}

/**
 * Attachment-related errors (unsupported type, missing content)
 */
export class AttachmentError extends SenderwolfError {
	name: 'AttachmentError';
	constructor(message: string);
}

// ============================================================================
// Template Management Functions
// ============================================================================

/**
 * Register a new email template
 */
export function registerTemplate(
	name: string,
	config: EmailTemplateConfig
): EmailTemplate;

/**
 * Get a template by name
 */
export function getTemplate(name: string): EmailTemplate | null;

/**
 * List all templates, optionally filtered by category
 */
export function listTemplates(category?: string): EmailTemplate[];

/**
 * Remove a template
 */
export function removeTemplate(name: string): boolean;

/**
 * Preview a template with variables (without sending)
 */
export function previewTemplate(
	templateName: string,
	variables?: TemplateVariables
): RenderedTemplate;

/**
 * Load template(s) from a JSON file
 */
export function loadTemplateFromFile(
	filePath: string
): Promise<EmailTemplate | EmailTemplate[]>;

/**
 * Save a template to a JSON file
 */
export function saveTemplateToFile(
	name: string,
	filePath: string
): Promise<string>;

/**
 * Load all templates from a directory
 */
export function loadTemplatesFromDirectory(
	dirPath: string
): Promise<EmailTemplate[]>;

// ============================================================================
// Template Engine Classes
// ============================================================================

/**
 * Template Engine for compiling templates with variables
 */
export class TemplateEngine {
	static compile(template: string, variables?: TemplateVariables): string;
	static extractVariables(template: string): string[];
}

/**
 * Email Template class
 */
export class EmailTemplate {
	constructor(name: string, config: EmailTemplateConfig);
	render(variables?: TemplateVariables): RenderedTemplate;
	validate(): TemplateValidationResult;
	toJSON(): EmailTemplateConfig & { name: string };
	static fromJSON(data: EmailTemplateConfig & { name: string }): EmailTemplate;
}

/**
 * Template Manager for registration and management
 */
export class TemplateManager {
	static registerTemplate(
		name: string,
		config: EmailTemplateConfig
	): EmailTemplate;
	static getTemplate(name: string): EmailTemplate | null;
	static hasTemplate(name: string): boolean;
	static listTemplates(category?: string): EmailTemplate[];
	static getCategories(): string[];
	static removeTemplate(name: string): boolean;
	static updateTemplate(
		name: string,
		config: Partial<EmailTemplateConfig>
	): EmailTemplate;
	static loadFromFile(
		filePath: string
	): Promise<EmailTemplate | EmailTemplate[]>;
	static saveToFile(name: string, filePath: string): Promise<string>;
	static loadFromDirectory(dirPath: string): Promise<EmailTemplate[]>;
	static clearAll(): void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Built-in SMTP provider configurations
 */
export const SMTP_PROVIDERS: Record<string, ProviderConfig>;

/**
 * Built-in email templates
 */
export const BUILTIN_TEMPLATES: Record<
	string,
	EmailTemplateConfig & { name: string }
>;

// ============================================================================
// Default Export (for CommonJS compatibility)
// ============================================================================

declare const senderwolf: {
	sendEmail: typeof sendEmail;
	createMailer: typeof createMailer;
	quickSend: typeof quickSend;
	sendGmail: typeof sendGmail;
	sendOutlook: typeof sendOutlook;
	testConnection: typeof testConnection;
	getProviderConfig: typeof getProviderConfig;
	detectProvider: typeof detectProvider;
	registerProvider: typeof registerProvider;
	unregisterProvider: typeof unregisterProvider;
	registerDomain: typeof registerDomain;
	hasProvider: typeof hasProvider;
	suggestSMTPSettings: typeof suggestSMTPSettings;
	listProviders: typeof listProviders;
	getAllProviders: typeof getAllProviders;
	loadConfig: typeof loadConfig;
	closeAllPools: typeof closeAllPools;
	getPoolStats: typeof getPoolStats;
	registerTemplate: typeof registerTemplate;
	getTemplate: typeof getTemplate;
	listTemplates: typeof listTemplates;
	removeTemplate: typeof removeTemplate;
	previewTemplate: typeof previewTemplate;
	loadTemplateFromFile: typeof loadTemplateFromFile;
	saveTemplateToFile: typeof saveTemplateToFile;
	loadTemplatesFromDirectory: typeof loadTemplatesFromDirectory;
	TemplateEngine: typeof TemplateEngine;
	EmailTemplate: typeof EmailTemplate;
	TemplateManager: typeof TemplateManager;
	SMTP_PROVIDERS: typeof SMTP_PROVIDERS;
	BUILTIN_TEMPLATES: typeof BUILTIN_TEMPLATES;
	on: typeof on;
	off: typeof off;
	once: typeof once;
	removeAllListeners: typeof removeAllListeners;
	senderwolfEvents: typeof senderwolfEvents;
	withRetry: typeof withRetry;
	DEFAULT_RETRY_OPTIONS: typeof DEFAULT_RETRY_OPTIONS;
	htmlToText: typeof htmlToText;
	SenderwolfError: typeof SenderwolfError;
	ConnectionError: typeof ConnectionError;
	AuthenticationError: typeof AuthenticationError;
	SMTPError: typeof SMTPError;
	ValidationError: typeof ValidationError;
	TemplateError: typeof TemplateError;
	ProviderError: typeof ProviderError;
	PoolError: typeof PoolError;
	AttachmentError: typeof AttachmentError;
	QueueStore: typeof QueueStore;
};

export default senderwolf;
