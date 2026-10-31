// One place to rename the app.
export const SITE_NAME = "Bean Feed";
export const SITE_TAGLINE = "New coffees from the roasters you love. No account, no tracking.";

// Where visitors report a roaster that doesn't work or anything else that's off.
export const REPORT_PATH = "/report";
export const reportLink = (roaster?: string) => (roaster ? `${REPORT_PATH}?roaster=${encodeURIComponent(roaster)}` : REPORT_PATH);
