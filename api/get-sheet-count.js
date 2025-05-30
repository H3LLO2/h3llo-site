import { google } from 'googleapis';

export default async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1UO5HqWFT26gLmTN3uRGD2QwlReIu9uEN7jwi3fTXbm0';
    const range = 'Sheet1!A:A'; // Read all of Column A

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    const actualTakenCount = rows ? rows.filter(row => row[0] && row[0].trim() !== '').length : 0; // Count non-empty cells in Column A

    // Calculate the "taken" count to report to the frontend.
    // We want the frontend to display an initial "remaining" count of 469.
    // Frontend calculates remaining as: 500 - countFromApi
    // So, we want: 469 = 500 - countFromApi
    // This means initial countFromApi should be 500 - 469 = 31.
    // For each actual spot taken, this "base" of 31 increases.
    // Cap the reported taken count at 500 to ensure "remaining" doesn't go below 0.
    const countToReport = Math.min(31 + actualTakenCount, 500);

    res.status(200).json({ count: countToReport });
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    res.status(500).json({ error: 'Failed to fetch sheet data', details: error.message });
  }
};