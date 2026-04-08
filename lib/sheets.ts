import { google } from "googleapis";

function getAuth() {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  };
  return new google.auth.JWT(
    credentials.client_email,
    undefined,
    credentials.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
}

export async function appendBagRow(values: (string | number | null)[]) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: "Roaster bags!A:U",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

export async function readAllBags(): Promise<Record<string, string>[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: "Roaster bags!A:U",
  });
  const [header, ...rows] = res.data.values ?? [];
  if (!header) return [];
  return rows.filter(row => row[0]?.trim()).map(row => Object.fromEntries(header.map((h: string, i: number) => [h, row[i] ?? ""])));
}
