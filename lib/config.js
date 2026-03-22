import { cosmiconfig } from "cosmiconfig";
import fs from "fs";
import path from "path";
import { registerProvider, registerDomain } from "./providers.js";
import { logger } from "./logger.js";

export async function loadConfig() {
    const explorer = cosmiconfig("senderwolf");

    let config = {};

    // Load from current directory
    const cwdConfig = path.join(process.cwd(), ".senderwolfrc.json");
    if (fs.existsSync(cwdConfig)) {
        config = JSON.parse(fs.readFileSync(cwdConfig, "utf-8"));
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
                    config = JSON.parse(fs.readFileSync(homeConfig, "utf-8"));
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

    return config;
}
