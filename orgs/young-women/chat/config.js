/* Young Women Chat · backend config (NO SECRETS)
   Keep this file free of API keys, service-account JSON, and passwords.
   Chat messages stay in Demo Mode until a chat backend exists.
   Sign-ups do not. They use signups.scriptUrl (a private Google Apps Script).
   An empty scriptUrl means Not Connected. Do not point sign-ups at localStorage.
*/
window.YW_CHAT_CONFIG = {
  /* Chat only. "demo" until a chat backend exists. Sign-ups ignore this flag. */
  mode: "demo",

  /* Display */
  wardName: "Farmington Bay 6th Ward",
  hubTitle: "Bay 6 Hub",
  appName: "Young Women Chat",

  /* Channels (ids must stay stable) */
  channels: [
    { id: "main", name: "Main", blurb: "All Young Women" },
    { id: "gatherers", name: "Gatherers", blurb: "Gatherers of Light" },
    { id: "messengers", name: "Messengers", blurb: "Messengers of Hope" },
    { id: "builders", name: "Builders", blurb: "Builders of Faith" }
  ],

  /* Safety policy flags (enforced in the client; also enforce server-side when live) */
  safety: {
    inviteOnly: true,
    requireParentApproval: true,
    requireYouthOptIn: true,
    noYouthToYouthDms: true,
    noPublicDiscovery: true,
    noAds: true,
    twoDeepAdultsRequired: true,
    minAdultsPresent: 2,
    reportEveryMessage: true
  },

  /* Firebase placeholders — replace with your project values (public web config only).
     Never commit service-account keys. Restrict Auth / Firestore rules to invitees. */
  firebase: {
    apiKey: "YOUR_FIREBASE_WEB_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    /* Optional: collection prefixes */
    collections: {
      messages: "yw_messages",
      members: "yw_members",
      reports: "yw_reports",
      invites: "yw_invites",
      /* Names only. The SQL migration is not applied and mode stays demo. */
      signupEntries: "yw_signup_entries",
      signupSlots: "yw_signup_slots"
    }
  },

  /* Supabase placeholders — use the anon/public key only; put secrets in Edge Functions. */
  supabase: {
    url: "https://YOUR_PROJECT.supabase.co",
    anonKey: "YOUR_SUPABASE_ANON_KEY",
    tables: {
      messages: "yw_messages",
      members: "yw_members",
      reports: "yw_reports",
      invites: "yw_invites",
      signupEntries: "yw_signup_entries",
      signupSlots: "yw_signup_slots"
    }
  },

  /* localStorage key prefix used in DEMO mode */
  /* Photos: client strips EXIF by canvas re-encode; 5 MB cap */
  photoMaxBytes: 5 * 1024 * 1024,
  photoMaxStored: 8,

  demoStorageKey: "bay6-yw-chat-v4",

  /* Sign-ups. Provider is the Hub's existing Google Apps Script pattern.
     scriptUrl stays empty until the private web app is deployed.
     The Google client id is read from that script. It is not a secret.
     Never put a sheet id, token, or private key here. */
  signups: {
    provider: "google-apps-script",
    scriptUrl: ""
  }
};
