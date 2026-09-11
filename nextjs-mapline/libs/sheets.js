import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// One JWT and one client for the life of the process. Each exported getter used to
// build its own, so a single page regeneration performed three OAuth handshakes on
// top of three data requests.
let sheetsClient = null;
const getSheetsClient = () => {
    if (!sheetsClient) {
        const auth = new google.auth.JWT(
            process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
            null,
            (process.env.GOOGLE_SHEETS_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            SCOPES,
        );
        sheetsClient = google.sheets({ version: 'v4', auth });
    }
    return sheetsClient;
};

const toState = (row) => ({
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
    yLabel: row[11],
});

const toTimelineEvent = (row) => ({
    id: row[0] ?? null,
    displayName: row[1] ?? 'undefined',
    italics: row[2] ?? false,
    fullName: row[3] ?? null,
    aka: row[4] ?? null,
    category: row[5] ?? 'event',
    period: row[6] ?? false,
    startDate: row[7] ?? null,
    specStartDate: row[8] ?? 'day',
    endDate: row[9] ?? null,
    specEndDate: row[10] ?? 'day',
    location: row[11] ?? null,
    filter: row[12] ?? null,
    importance: row[13] ?? 5,
    parent: row[14] ?? null,
    wikiLink: row[15] ?? null,
});

const toLocation = (row) => ({
    id: row[0] ?? null,
    displayName: row[1] ?? 'undefined',
    lat: row[2] ?? 0,
    long: row[3] ?? 0,
    foundDate: row[4] ?? null,
    foundDateSpec: row[5] ?? 'day',
    size: row[6] ?? 3,
});

/**
 * Fetches all three tabs in a single batchGet.
 *
 * Throws rather than returning empty arrays. The previous behaviour — catch, log,
 * return [] — rendered a blank site on any transient Sheets failure. That was
 * survivable with `revalidate: 1` (it retried a second later) but not with the longer
 * revalidate window; when getStaticProps throws during revalidation Next keeps serving
 * the last good page and retries, which is what we want.
 */
export async function getSheetData() {
    const response = await getSheetsClient().spreadsheets.values.batchGet({
        spreadsheetId: process.env.SPREADSHEET_ID,
        ranges: ['state', 'timeline', 'location'],
    });

    const [stateRows, timelineRows, locationRows] = (response.data.valueRanges || [])
        .map((range) => range.values || []);

    if (!stateRows?.length || !timelineRows?.length || !locationRows?.length) {
        throw new Error(
            `Sheets returned an empty tab (state: ${stateRows?.length ?? 0}, ` +
            `timeline: ${timelineRows?.length ?? 0}, location: ${locationRows?.length ?? 0})`,
        );
    }

    return {
        states: stateRows.map(toState),
        events: timelineRows.map(toTimelineEvent),
        locations: locationRows.map(toLocation),
    };
}

// Kept for compatibility; prefer getSheetData so the three tabs share one request.
export async function getStateList() {
    return (await getSheetData()).states;
}

export async function getTimeline() {
    return (await getSheetData()).events;
}

export async function getLocations() {
    return (await getSheetData()).locations;
}
