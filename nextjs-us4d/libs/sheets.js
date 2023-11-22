import { google } from 'googleapis';

export async function getStateList() {
    try {
        const target = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
        
        const auth = new google.auth.JWT(
            process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
            null,
            (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            target
        );

        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: 'state',
        });

        const rows = response.data.values;
        if(rows.length) {
            return rows.map((row) => ({
                name: row[0],
                width: row[1],
                height: row[2],
                x: row[3],
                y: row[4],
            }));
        }
    } catch(err) {
        console.log(err);
    }
    return [];
}