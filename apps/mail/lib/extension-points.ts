export const EXTENSION_POINTS = {
  MAIL_LIST: {
    BEFORE_LIST: "mail.list.before",
    AFTER_LIST: "mail.list.after",
    LIST_ITEM: "mail.list.item",
    LIST_ACTIONS: "mail.list.actions",
    LIST_FILTERS: "mail.list.filters",
    CONTEXT_MENU: "mail.list.context_menu",
    BULK_ACTIONS: "mail.list.bulk_actions",
    SEARCH_FILTERS: "mail.list.search_filters",
  },

  MAIL_VIEW: {
    BEFORE_CONTENT: "mail.view.before",
    AFTER_CONTENT: "mail.view.after",
    TOOLBAR: "mail.view.toolbar",
    SIDEBAR: "mail.view.sidebar",
    HEADER: "mail.view.header",
    ATTACHMENTS: "mail.view.attachments",
    ACTIONS: "mail.view.actions",
    CONTEXT_MENU: "mail.view.context_menu",
  },

  COMPOSE: {
    BEFORE_FORM: "mail.compose.before",
    AFTER_FORM: "mail.compose.after",
    TOOLBAR: "mail.compose.toolbar",
    ATTACHMENTS: "mail.compose.attachments",
    RECIPIENTS: "mail.compose.recipients",
    SUBJECT: "mail.compose.subject",
    EDITOR: "mail.compose.editor",
    SEND_BUTTON: "mail.compose.send_button",
    DRAFTS: "mail.compose.drafts",
  },

  REPLY: {
    BEFORE_FORM: "mail.reply.before",
    AFTER_FORM: "mail.reply.after",
    ATTACHMENTS: "mail.reply.attachments",
    EDITOR: "mail.reply.editor",
    SEND_BUTTON: "mail.reply.send_button",
  },

  SETTINGS: {
    GENERAL: "settings.general",
    ACCOUNT: "settings.account",
    PLUGINS: "settings.plugins",
    APPEARANCE: "settings.appearance",
    NOTIFICATIONS: "settings.notifications",
    SECURITY: "settings.security",
    INTEGRATIONS: "settings.integrations",
    SIDEBAR: "settings.sidebar",
  },

  NAV: {
    TOP: "nav.top",
    BOTTOM: "nav.bottom",
    SIDEBAR_TOP: "nav.sidebar.top",
    SIDEBAR_BOTTOM: "nav.sidebar.bottom",
    ACTIONS: "nav.actions",
    USER_MENU: "nav.user_menu",
  },

  GLOBAL: {
    HEADER: "global.header",
    FOOTER: "global.footer",
    NOTIFICATIONS: "global.notifications",
    SHORTCUTS: "global.shortcuts",
    CONTEXT_MENU: "global.context_menu",
    THEME: "global.theme",
  },

  SEARCH: {
    FILTERS: "search.filters",
    SUGGESTIONS: "search.suggestions",
    RESULTS: "search.results",
    ACTIONS: "search.actions",
  },

  AI: {
    SUGGESTIONS: "ai.suggestions",
    ACTIONS: "ai.actions",
    SIDEBAR: "ai.sidebar",
    COMPOSE_ASSIST: "ai.compose_assist",
    SUMMARY: "ai.summary",
  },
} as const;
