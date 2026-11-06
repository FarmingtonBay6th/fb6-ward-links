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
    { id: "m2", channelId: "main", authorId: "u-mignon", text: "Reminder: two adults are always watching each channel. No private youth-to-youth chats here.", createdAt: "2026-11-05T18:05:00-07:00", removed: false },
    { id: "m3", channelId: "main", authorId: "u-presley", text: "Excited for activity night! 🌟", createdAt: "2026-11-05T18:12:00-07:00", removed: false },
    { id: "m4", channelId: "gatherers", authorId: "u-chandra", text: "Gatherers — bring a flashlight for Thursday’s light walk.", createdAt: "2026-11-05T17:30:00-07:00", removed: false },
    { id: "m5", channelId: "gatherers", authorId: "u-presley", text: "Got it! Can we also bring glow sticks?", createdAt: "2026-11-05T17:40:00-07:00", removed: false },
    { id: "m6", channelId: "messengers", authorId: "u-denise", text: "Messengers of Hope: service project sign-up is on the Hub Young Women page.", createdAt: "2026-11-05T16:00:00-07:00", removed: false },
    { id: "m7", channelId: "messengers", authorId: "u-lucy", text: "I’ll bring cookies for the care packages.", createdAt: "2026-11-05T16:20:00-07:00", removed: false },
    { id: "m8", channelId: "builders", authorId: "u-adviser-b", text: "Builders — scripture study challenge starts Sunday. Who’s in?", createdAt: "2026-11-05T15:00:00-07:00", removed: false },
    { id: "m9", channelId: "builders", authorId: "u-builders-pres", text: "I’m in! Let’s do Alma 32 this week.", createdAt: "2026-11-05T15:15:00-07:00", removed: false },
    { id: "m10", channelId: "main", authorId: "u-brooke", text: "(This message can be removed by a moderator in the demo.)", createdAt: "2026-11-05T18:20:00-07:00", removed: false }
  ],

  reports: [
    { id: "r1", messageId: "m10", reporterId: "u-presley", reason: "Just testing the Report button", createdAt: "2026-11-05T18:22:00-07:00", status: "open" }
  ],

  invites: [
    { id: "inv1", userId: "u-anna", invitedBy: "u-traci", createdAt: "2026-11-04T12:00:00-07:00" },
    { id: "inv2", userId: "u-emma", invitedBy: "u-mignon", createdAt: "2026-11-04T12:05:00-07:00" },
    { id: "inv3", userId: "u-oakley", invitedBy: "u-lori", createdAt: "2026-11-04T12:10:00-07:00" }
  ]
};
