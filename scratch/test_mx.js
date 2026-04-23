import { verifyMX } from "../lib/validator.js";

async function runTest() {
    console.log("Testing MX lookup for google.com...");
    try {
        const result = await verifyMX("google.com");
        console.log("Result for google.com:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Error google.com:", err);
    }

    console.log("\nTesting MX lookup for non-existent-domain-123456789.com...");
    try {
        const result = await verifyMX("non-existent-domain-123456789.com");
        console.log("Result for non-existent:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Error non-existent:", err);
    }
}

runTest();
