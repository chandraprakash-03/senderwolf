import { cosmiconfig } from "cosmiconfig";
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { registerProvider, registerDomain } from "./providers.js";
import { logger } from "./logger.js";

// Cached config to avoid repeated file I/O per sendEmail() call (Perf fix)
let cachedConfig = null;

export async function loadConfig(forceReload = false) {
    if (cachedConfig && !forceReload) return { ...cachedConfig };

    const explorer = cosmiconfig("senderwolf");

    let config = {};

    // Load from current directory
    const cwdConfig = path.join(process.cwd(), ".senderwolfrc.json");
    if (fs.existsSync(cwdConfig)) {
        try {
            config = JSON.parse(fs.readFileSync(cwdConfig, "utf-8"));
        } catch (err) {
            throw new Error(`Failed to parse config file "${cwdConfig}": ${err.message}`);
        }
    } else {
        // Use cosmiconfig for other formats
        const result = await explorer.search(process.cwd());
        if (result && result.config) {
            config = result.config;
        } else {
            // Load from home directory
            const homeDir = process.env.HOME || process.env.USERPROFILE;
            if (homeDir) {
                const homeConfig = path.join(homeDir, ".senderwolfrc.json");
                if (fs.existsSync(homeConfig)) {
                    try {
                        config = JSON.parse(fs.readFileSync(homeConfig, "utf-8"));
                    } catch (err) {
                        throw new Error(`Failed to parse config file "${homeConfig}": ${err.message}`);
                    }
                }
            }
        }
    }

    // Load from process.env (SENDERWOLF_ prefix)
    const envConfig = {
        host: process.env.SENDERWOLF_SMTP_HOST,
        port: process.env.SENDERWOLF_SMTP_PORT ? parseInt(process.env.SENDERWOLF_SMTP_PORT, 10) : undefined,
        user: process.env.SENDERWOLF_SMTP_USER,
        pass: process.env.SENDERWOLF_SMTP_PASS,
        fromEmail: process.env.SENDERWOLF_FROM_EMAIL || process.env.SENDERWOLF_USER_EMAIL,
        fromName: process.env.SENDERWOLF_FROM_NAME,
        secure: process.env.SENDERWOLF_SMTP_SECURE === "true" ? true : (process.env.SENDERWOLF_SMTP_SECURE === "false" ? false : undefined),
        debug: process.env.SENDERWOLF_DEBUG === "true" || process.env.DEBUG === "true",
    };

    // Filter out undefined values
    for (const [key, value] of Object.entries(envConfig)) {
        if (value !== undefined) {
            config[key] = value;
        }
    }

    // Set custom logger if provided in config
    if (config.logger) {
        logger.setLogger(config.logger);
    }

    // Register custom providers from config
    if (config.customProviders) {
        for (const [name, providerConfig] of Object.entries(config.customProviders)) {
            try {
                registerProvider(name, providerConfig);
            } catch (error) {
                logger.warn(`Failed to register custom provider '${name}':`, error.message);
            }
        }
    }

    // Register custom domain mappings from config
    if (config.customDomains) {
        for (const [domain, provider] of Object.entries(config.customDomains)) {
            registerDomain(domain, provider);
        }
    }

    cachedConfig = config;
    return config;
}

/**
 * Clear the config cache (useful for testing or when config files change)
 */
export function clearConfigCache() {
    cachedConfig = null;
}
