export const ROLES = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  USER: "USER",
} as const;

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  ADMIN_QR: "/admin/qr",
  ADMIN_LOCATIONS: "/admin/locations",
  ADMIN_TICKETS: "/admin/tickets",
  PUBLIC_QR: "/q",
  PUBLIC_TRACK: "/track",
} as const;

export const AUTH_ERRORS = {
  INVALID_EMAIL: "Please enter a valid email address.",
  USER_DISABLED: "This account has been disabled.",
  USER_NOT_FOUND: "No account found with this email.",
  WRONG_PASSWORD: "Incorrect password. Please try again.",
  TOO_MANY_REQUESTS: "Too many attempts. Please try again later.",
  NETWORK_ERROR: "Network error. Please check your connection.",
  UNKNOWN: "An unexpected error occurred. Please try again.",
} as const;
