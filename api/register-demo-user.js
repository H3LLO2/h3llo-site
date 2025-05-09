// This line imports the Vercel KV helper tools
import { kv } from '@vercel/kv';

// This is the main function that Vercel runs when this API endpoint is called
export default async function handler(request, response) {
    // We only want to accept 'POST' requests for this endpoint
    // (because the demo sign-up form will send data using POST)
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Sorry, only POST requests are allowed here!' });
    }

    try {
        // Get the data that the user submitted from the website form
        // 'email', 'companyName', and 'consent' should match what your demo.js sends
        const { email, companyName, consent } = request.body;

        // --- Basic Validation ---
        // Check if an email was actually sent
        if (!email) {
            return response.status(400).json({ error: 'Oops! Email is required to sign up for more tries.' });
        }
        // You could add more validation here if needed (e.g., email format)

        // --- Prepare the data to be saved ---
        const userData = {
            email: email,
            companyName: companyName || null, // If companyName is empty or not provided, save it as null (nothing)
            consentGiven: !!consent,       // Ensures 'consent' is saved as a true boolean (true/false)
            triesRemaining: 5,             // Give them 5 new tries as promised
            signupTimestamp: new Date().toISOString(), // Record the current date and time of sign-up
        };

        // --- Create a Unique Key for Vercel KV ---
        // We'll use "demoUser:" followed by their email address as a unique ID in the database
        // Example: "demoUser:test@example.com"
        const userKey = `demoUser:${email}`;

        // --- Save to Vercel KV ---
        try {
            // This is the command that actually saves the userData object to your Vercel KV store
            // using the userKey we created.
            await kv.set(userKey, userData);

            // Log a success message on the server side (visible in Vercel logs)
            console.log(`Demo user registered: ${email}, Company: ${companyName || 'N/A'}, Consent: ${userData.consentGiven}`);

            // Send a success message back to the website (demo.js will handle this)
            // The demo.js file should then update localStorage to give the user their 5 tries.
            return response.status(200).json({ 
                message: 'User registration successful. You now have 5 additional tries.',
                triesGranted: 5 
            });

        } catch (dbError) {
            // If something went wrong while trying to save to Vercel KV
            console.error('Vercel KV saving error:', dbError);
            return response.status(500).json({ error: 'Uh oh! Could not save user registration due to a database problem. Please try again.' });
        }

    } catch (error) {
        // If any other unexpected error happened before trying to save to the database
        console.error('Error in register-demo-user API:', error);
        return response.status(500).json({ error: 'An unexpected server hiccup occurred. Please try again.' });
    }
}