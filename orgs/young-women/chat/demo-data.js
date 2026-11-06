/* Seed data for DEMO mode only. First names / last initials for youth; adults full names.
   No real phone numbers or emails for youth. */
window.YW_CHAT_DEMO_SEED = {
  users: [
    /* Moderators = YW presidency (adults) */
    { id: "u-traci", name: "Traci Harward", role: "moderator", kind: "adult", classId: null, status: "active" },
    { id: "u-mignon", name: "Mignon Call", role: "moderator", kind: "adult", classId: null, status: "active" },
    { id: "u-lori", name: "Lori Barnes", role: "moderator", kind: "adult", classId: null, status: "active" },
    { id: "u-mccall", name: "McCall Brown", role: "moderator", kind: "adult", classId: null, status: "active" },
    /* Advisers (adults) — help meet two-deep */
    { id: "u-chandra", name: "Chandra Draxler", role: "adviser", kind: "adult", classId: "gatherers", status: "active" },
    { id: "u-denise", name: "Denise Evans", role: "adviser", kind: "adult", classId: "messengers", status: "active" },
    { id: "u-adviser-b", name: "Sister Adviser", role: "adviser", kind: "adult", classId: "builders", status: "active" },
    /* Parents */
    { id: "u-parent-emma", name: "Parent of Emma", role: "parent", kind: "adult", classId: null, status: "active", childIds: ["u-emma"] },
    { id: "u-parent-presley", name: "Parent of Presley", role: "parent", kind: "adult", classId: null, status: "active", childIds: ["u-presley"] },
    /* Youth — ward invite list */
    { id: "u-presley", name: "Presley P.", role: "youth", kind: "youth", classId: "gatherers", status: "active", parentId: "u-parent-presley" },
    { id: "u-emma", name: "Emma H.", role: "youth", kind: "youth", classId: "gatherers", status: "pending_parent", parentId: "u-parent-emma" },
    { id: "u-lucy", name: "Lucy", role: "youth", kind: "youth", classId: "messengers", status: "active" },
    { id: "u-oakley", name: "Oakley", role: "youth", kind: "youth", classId: "messengers", status: "pending_youth" },
    { id: "u-builders-pres", name: "Builders Pres.", role: "youth", kind: "youth", classId: "builders", status: "active" },
    { id: "u-anna", name: "Anna B.", role: "youth", kind: "youth", classId: "messengers", status: "invited" },
    { id: "u-brooke", name: "Brooke", role: "youth", kind: "youth", classId: "gatherers", status: "muted" }
  ],

  /* Adults currently “present” (two-deep). Demo starts with 2+ on Main. */
  presence: {
    main: ["u-traci", "u-mignon"],
    gatherers: ["u-chandra", "u-traci"],
    messengers: ["u-denise", "u-lori"],
    builders: ["u-adviser-b", "u-mccall"]
  },

  messages: [
    { id: "m1", channelId: "main", authorId: "u-traci", text: "Welcome to Bay 6 Young Women Chat! This replaces our GroupMe. Be kind, keep covenants, and report anything that feels off.", createdAt: "2026-11-05T18:00:00-07:00", removed: false },
    { id: "m1b", channelId: "main", authorId: "u-traci", text: "Ask a leader if you need help inviting a friend from the ward list.", createdAt: "2026-11-05T18:02:00-07:00", removed: false },
    { id: "m2", channelId: "main", authorId: "u-mignon", text: "Reminder: two adults are always watching each channel. No private youth-to-youth chats here.", createdAt: "2026-11-05T18:05:00-07:00", removed: false },
    { id: "m3", channelId: "main", authorId: "u-presley", text: "Excited for activity night! 🌟", createdAt: "2026-11-05T18:12:00-07:00", removed: false },
    { id: "m3b", channelId: "main", authorId: "u-presley", text: "Who else is coming?", createdAt: "2026-11-05T18:13:00-07:00", removed: false },
    { id: "m4", channelId: "gatherers", authorId: "u-chandra", text: "Gatherers — bring a flashlight for Thursday’s light walk.", createdAt: "2026-11-05T17:30:00-07:00", removed: false, imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAADaElEQVR42u3bWXraMBDAcZ+vbz1ML9Tb9KlLUiCBBBL2naxdnirJY9kqlpATz1gyw/c/we8DWxqJ5O/r4c/LXvc77Rn6pXvav5q9PO50z2kP0JPusHs0e9hvdYe0HbTXbbc7s+1mo4PPGlrrVpuV2XK51i3SFtBcN1/PzKazlW4yWyWs49AxgFjnWGcyzYBYp1QHgFjHpiOBWMehMwYg1rHoKCDWsevkQKxTqjOeKCDWsencCyDWcegUgFinTCcDYh2LjgJiHbuOBGIdh87deJmwjkPHAGKdY50ciHVKdQCIdWw6IwHEOg4dA4h1jnVG9xkQ65TqABDr2HQkEOs4dIYA1JBO8vGTrUB0FBC5jsPluGZ1ciAanUo0BlNDOsM7BRS4TlojOrcCKAodMCLXKQAFr5NGrJMBRaJTNKLRUUBR6aSR6UigcN7obwDC1rkZLZLodLQRgY4BVPtaGRWIRicHIt5J1AOErwNA0emAEb7OQAAh7dFpgLB1DKB6JxgEQAQ6g2EGVPt8hw4IUweAMKZfREDIOhIIaTZIAYSv0wcghMkpARCBjgLCmSsTAyHp5EC1T90pgfB0+rcKCOlMogU61wII78SGAAhbpwCEcJ6FDUSgkwGhnfbFrqOAMM9CkYDIdCQQ9klx1DpXN/OE4Bw9Xh0DCPWWQaQ6ORDBHYwYdQCI7IZKdDo9AUR/fyfYN/qxjgHUwD+uA9hJuHV6gwwoxrtfBDoAxDo2HQnEOg6dLgCxjkVHAbGOXScHYp1SnW5fAbGOTacjgFjHoVMAYp0ynQyIdSw6CqiizpfPH85HRwJV/e4IIF3rdX5ez5Kqv6wiULFW6hhAns8dG5CuTTo5UKWn8kmjtBboANB73lmeWJHqXAqgut7onlJx6RhAda13PKWi0Lm8yoCQVoOeWMHqABDBWtlTKjQdCUS8k/CUCkTnAoAa2md5YjWoo4AC2IV6StHr5ECB7NE9pch0LnoKKMwJhicWqs4PART+fMdTCkOnABTDfMdXqj6dDCjC6Zcn1jt1FFDks0F/qTfoSKDWTE49pSrpfO9Ok1bOlT2xTuoYQK2cK580cuvkQC2euqe5gOw6ANR6nf+eOwaQU+ebADo3neJzRwC5dQygc9M5+d2RdTIg1inVASDWselIINZx6HztTP8BrLO7eGTRbKUAAAAASUVORK5CYII=' },
    { id: "m5", channelId: "gatherers", authorId: "u-presley", text: "Got it! Can we also bring glow sticks?", createdAt: "2026-11-05T17:40:00-07:00", removed: false },
    { id: "m6", channelId: "messengers", authorId: "u-denise", text: "Messengers of Hope: service project sign-up is on the Hub Young Women page.", createdAt: "2026-11-05T16:00:00-07:00", removed: false },
    { id: "m6b", channelId: "messengers", authorId: "u-denise", text: "We’ll pack care packages after church. Bring a smile and a Sharpie!", createdAt: "2026-11-05T16:05:00-07:00", removed: false },
    { id: "m7", channelId: "messengers", authorId: "u-lucy", text: "I’ll bring cookies for the care packages.", createdAt: "2026-11-05T16:20:00-07:00", removed: false },
    { id: "m7b", channelId: "messengers", authorId: "u-lucy", text: "Also happy to help write thank-you notes.", createdAt: "2026-11-05T16:22:00-07:00", removed: false },
    { id: "m7c", channelId: "messengers", authorId: "u-lori", text: "Thank you, Lucy. Parents can drop supplies by the church kitchen Saturday morning.", createdAt: "2026-11-05T16:35:00-07:00", removed: false },
    { id: "m8", channelId: "builders", authorId: "u-adviser-b", text: "Builders — scripture study challenge starts Sunday. Who’s in?", createdAt: "2026-11-05T15:00:00-07:00", removed: false, imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAAp0lEQVR42u3aQREAEBRAQflEkMFNI22UcaCAEv9g2JmXYM8vzb3ea/QcVQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQIECBAgQIAAAQJ0ccFApdXbAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIkE9agAABAgQIECBAAgQIECBAgAABAiRAgAABAgQI0HcdSe92kWGBJNEAAAAASUVORK5CYII=' },
    { id: "m8b", channelId: "builders", authorId: "u-adviser-b", text: "We’ll meet for five minutes after class to share one verse that stood out.", createdAt: "2026-11-05T15:03:00-07:00", removed: false },
    { id: "m9", channelId: "builders", authorId: "u-builders-pres", text: "I’m in! Let’s do Alma 32 this week.", createdAt: "2026-11-05T15:15:00-07:00", removed: false },
    { id: "m9b", channelId: "builders", authorId: "u-builders-pres", text: "I already marked verses 21 and 28 — faith like a seed!", createdAt: "2026-11-05T15:17:00-07:00", removed: false },
    { id: "m9c", channelId: "builders", authorId: "u-mccall", text: "Love that. Bring your marked scriptures Sunday and we’ll cheer each other on.", createdAt: "2026-11-05T15:25:00-07:00", removed: false },
    { id: "m4b", channelId: "gatherers", authorId: "u-chandra", text: "Meet at the pavilion at 6:30. Wear layers — it cools off fast.", createdAt: "2026-11-05T17:32:00-07:00", removed: false },
    { id: "m5b", channelId: "gatherers", authorId: "u-traci", text: "Glow sticks are great, Presley. I’ll bring a few extras.", createdAt: "2026-11-05T17:45:00-07:00", removed: false },
    { id: "m10", channelId: "main", authorId: "u-brooke", text: "(This message can be removed by a moderator in the demo.)", createdAt: "2026-11-05T18:20:00-07:00", removed: false }
  ],

  reports: [
    { id: "r1", messageId: "m10", reporterId: "u-presley", reason: "Just testing the Report button", createdAt: "2026-11-05T18:22:00-07:00", status: "open" }
  ],

  /* Demo settings (no secrets) */
  settings: {
    /* Photos post immediately; leaders can review via All Photos */
  },

  invites: [
    { id: "inv1", userId: "u-anna", invitedBy: "u-traci", createdAt: "2026-11-04T12:00:00-07:00" },
    { id: "inv2", userId: "u-emma", invitedBy: "u-mignon", createdAt: "2026-11-04T12:05:00-07:00" },
    { id: "inv3", userId: "u-oakley", invitedBy: "u-lori", createdAt: "2026-11-04T12:10:00-07:00" }
  ]
};
