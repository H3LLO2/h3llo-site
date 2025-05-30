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
    const count = rows ? rows.filter(row => row[0] && row[0].trim() !== '').length : 0; // Count non-empty cells in Column A

    res.status(200).json({ count });
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    res.status(500).json({ error: 'Failed to fetch sheet data', details: error.message });
  }
};