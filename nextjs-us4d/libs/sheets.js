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
                displayName: row[1],
                width: row[2],
                height: row[3],
                x: row[4],
                y: row[5],
                stateDate: row[6],
                startDate: row[7],
                endDate: row[8],
                xLabel: row[9],
                yLabel: row[10]
            }));
        }
    } catch(err) {
        console.log(err);
    }
    return [];
}