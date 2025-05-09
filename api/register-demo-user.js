// File: api/register-demo-user.js
import { kv } from '@vercel/kv';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', ['POST']);
        return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
    }

    let name;
    let email;
    let companyName;
    let consentGiven;

    try {
        const body = request.body;
        name = body?.name;
        email = body?.email;
        companyName = body?.companyName; // Optional
        consentGiven = body?.consentGiven; // Boolean
        console.log('[API LOG] Received request.body:', JSON.stringify(body)); // Log the whole body
        console.log('[API LOG] body.name:', body?.name, '| Type:', typeof body?.name);
        console.log('[API LOG] body.consentGiven:', body?.consentGiven, '| Type:', typeof body?.consentGiven);
    } catch (error) {
        console.error('Error parsing request body:', error);
        return response.status(400).json({ error: 'Invalid request body. Expecting JSON.' });
    }

    // Validate input
    if (!name || typeof name !== 'string' || name.trim() === '') {
        return response.status(400).json({ error: 'Missing or invalid name in request body.' });
    }
    if (!email || typeof email !== 'string' || email.trim() === '' || !/\S+@\S+\.\S+/.test(email)) {
        return response.status(400).json({ error: 'Missing or invalid email in request body.' });
    }
    if (typeof consentGiven !== 'boolean') {
        return response.status(400).json({ error: 'Missing or invalid consentGiven status (must be true or false).' });
    }
    if (companyName && typeof companyName !== 'string') {
        // Only validate companyName if provided
        return response.status(400).json({ error: 'Invalid companyName format (must be a string if provided).' });
    }

    try {
        const userData = {
            name: name.trim(),
            email: email.trim().toLowerCase(), // Store email in lowercase for consistency
            companyName: companyName ? companyName.trim() : null,
            marketingConsent: consentGiven,
            signedUpAt: new Date().toISOString(),
            source: 'demo_signup_modal'
        };

        // Use email as part of the key for Vercel KV to ensure uniqueness if desired,
        // or generate a unique ID. For simplicity, using email here.
        // Be mindful of PII in keys if that's a concern; a hashed email or UUID is better.
        // For now, let's store it under a key that includes the email.
        // A common pattern is to have a list of users or index them.
        // Example: Storing each user with a unique ID and then maybe an index by email.
        // For simplicity here, we'll just store the user data.
        // You might want to store this in a way that you can easily list users, e.g., in a set or list.

        const userKey = `demo_user:${userData.email}`; // Key for storing this specific user's data.
        
        // Check if user already exists (optional, depends on your desired behavior)
        // const existingUser = await kv.get(userKey);
        // if (existingUser) {
        //     // Handle existing user - maybe update their consent or timestamp?
        //     // For now, we'll overwrite, or you could return an error/specific message.
        //     console.log(`User ${userData.email} already exists. Updating data.`);
        // }

        await kv.set(userKey, userData);

        // Optionally, add user's email to a set for easy listing of all signed-up emails
        await kv.sadd('demo_user_emails', userData.email);

        console.log(`Successfully stored user data in Vercel KV: Email: ${userData.email}, Name: ${userData.name}`);

        return response.status(200).json({ message: 'User registration successful.' });

    } catch (error) {
        console.error('Error processing user registration with Vercel KV:', error);
        return response.status(500).json({ error: 'Failed to register user due to an internal error.' });
    }
}