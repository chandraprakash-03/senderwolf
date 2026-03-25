import { createMailer } from '../index.js';

// IMPORTANT: Replace with real credentials to test email delivery.
// Alternatively, look at the dry-run output below.
const mailer = createMailer({
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
            user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
            pass: process.env.SMTP_PASS || 'password',
        },
        debug: true // Enable debug to see the raw MIME output in console
    }
});

async function main() {
    console.log("=== Senderwolf Calendar Invite Demo ===\n");

    try {
        const result = await mailer.send({
            to: process.env.TEST_EMAIL || 'test-recipient@example.com',
            fromName: 'Senderwolf Calendar Assistant',
            subject: 'Project Kickoff Meeting',
            
            // This is the new `calendar` object that automatically generates an `.ics` File
            calendar: {
                summary: 'Project Kickoff Meeting',
                start: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
                end: new Date(Date.now() + 25 * 60 * 60 * 1000),   // Tomorrow + 1 hr
                location: 'Conference Room A (or Zoom)',
                description: 'Agenda:\n1. Introductions\n2. Project Overview\n3. Milestones\n4. Q&A',
                organizer: {
                    name: 'Project Manager',
                    email: process.env.SMTP_USER || 'manager@example.com'
                },
                attendees: [
                    { name: 'Developer 1', email: 'dev1@example.com', rsvp: true },
                    { name: 'Developer 2', email: 'dev2@example.com', rsvp: false },
                ],
                // Add a 15-minute reminder
                alarm: {
                    trigger: '-PT15M',
                    description: 'Reminder: Project Kickoff Meeting in 15 minutes!'
                }
            },
            
            // Note: If you don't provide `html` or `text`, senderwolf constructs a clean text fallback!
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>You're invited: Project Kickoff</h2>
                    <p>Please review the details below. We look forward to seeing you there.</p>
                    <p><strong>Note:</strong> Most email clients will show a beautiful calendar block above this message.</p>
                </div>
            `
        });

        console.log("\n✅ Email Sent Successfully!");
        console.log("Message ID:", result.messageId);

        // Verify the connection pool clears gracefully
        await mailer.close();
    } catch (err) {
        console.error("❌ Send failed:", err.message);
    }
}

main();
