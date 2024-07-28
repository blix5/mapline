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
                id: row[1],
                displayName: row[2],
                width: row[3],
                height: row[4],
                x: row[5],
                y: row[6],
                stateDate: row[7],
                startDate: row[8],
                endDate: row[9],
                xLabel: row[10],
                yLabel: row[11]
            }));
        }
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getTimeline() {
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
            range: 'timeline',
        });

        const rows = response.data.values;
        if(rows.length) {
            return rows.map((row) => ({
                id: row[0] ?? null,
                displayName: row[1] ?? 'undefined',
                fullName: row[2] ?? null,
                category: row[3] ?? 'event',
                startDate: row[4] ?? null,
                specStartDate: row[5] ?? 'day',
                endDate: row[6] ?? null,
                specEndDate: row[7] ?? 'day',
                location: row[8] ?? null,
                filter: row[9] ?? null,
                importance: row[10] ?? 5,
                parent: row[11] ?? null,
                wikiLink: row[12] ?? null,
            }));
        }
    } catch(err) {
        console.log(err);
    }
    return [];
}

export async function getLocations() {
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
            range: 'location',
        });

        const rows = response.data.values;
        if(rows.length) {
            return rows.map((row) => ({
                id: row[0] ?? null,
                displayName: row[1] ?? 'undefined',
                lat: row[2] ?? 0,
                long: row[3] ?? 0
            }));
        }
    } catch(err) {
        console.log(err);
    }
    return [];
}