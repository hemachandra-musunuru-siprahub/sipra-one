# Project Documentation

## 1. Project Overview

This project is an intranet dashboard demo built with React and TypeScript. It demonstrates Single Sign-On (SSO) authentication using Microsoft Entra ID and integrates key Microsoft services through secure browser-based flows.

The application is designed as an enterprise-style intranet where users can access profile information, files, and communication links without manual login steps.

## 2. Tech Stack

- Frontend: React + TypeScript
- Authentication: Microsoft Entra ID
- Libraries: MSAL (`@azure/msal-browser`, `@azure/msal-react`)
- APIs: Microsoft Graph API

## 3. Features Implemented

### SSO Authentication

- Auto-login using MSAL
- Silent authentication via `ssoSilent`
- No manual login required for returning users
- Redirect-based fallback when silent auth is unavailable

### Protected Routes

- Only authenticated users can access the dashboard
- Auth guard implementation protects route access

### Dashboard Modules

- My Profile (fetches user data)
- Files (OneDrive integration)
- Communication section

## 4. Microsoft Integrations (SSO-based)

### Outlook Integration

- Opens Outlook in a new tab
- Uses `login_hint` to ensure the correct signed-in user is used

### OneDrive Integration

- Opens OneDrive using the same SSO session
- Ensures the user stays signed in across Microsoft services

### Teams Integration

- Opens Teams using the same logged-in account
- Keeps the experience consistent with enterprise single sign-on

## 5. SSO Flow Explanation

1. User opens the application.
2. The app checks the session state using MSAL.
3. If a valid session exists, the user is logged in directly.
4. If no active session exists, the app redirects to Microsoft login.
5. After successful authentication, the user is redirected back to the app.

## 6. Key Components

- `src/components/LoginHandler.tsx` → Handles auto-login and silent auth logic
- `src/components/ProtectedRoute.tsx` → Secures routes and ensures only authenticated users can view protected pages
- `src/authConfig.ts` → Contains MSAL configuration and authentication settings
- `src/App.tsx` → Main dashboard UI and route structure

## 7. Problem Solved

- Fixed account mismatch when opening Outlook by using `login_hint`
- Ensures Outlook and other Microsoft services open in the context of the currently authenticated enterprise user

## 8. Expected Behavior

- Seamless login experience for users
- No repeated authentication prompts during an active session
- Works like a polished enterprise intranet portal

## 9. Future Enhancements

- Role-based access control (RBAC)
- Improved token refresh handling
- Microsoft apps launcher UI
- Logout from all sessions across Microsoft applications
