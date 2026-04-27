# Microsoft SSO & Graph API Demo

A minimal React + TypeScript application demonstrating **Microsoft Single Sign-On (SSO)** using Microsoft Entra ID (formerly Azure AD) and data retrieval from the **Microsoft Graph API**.

## 🚀 Overview

This project serves as an engineering demo for integrating Microsoft authentication into a modern web app. It focusses on:
- **Authentication**: Implementing the MSAL (Microsoft Authentication Library) redirect flow.
- **Graph API**: Fetching basic user profile data and listing OneDrive files.
- **Simplicity**: Minimal UI using basic React components and inline styling.

## 🛠 Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Authentication**: [@azure/msal-browser](https://www.npmjs.com/package/@azure/msal-browser) & [@azure/msal-react](https://www.npmjs.com/package/@azure/msal-react)
- **API**: [Microsoft Graph API](https://developer.microsoft.com/en-us/graph)

## 📋 Prerequisites

1. **Azure Tenant**: Access to an Azure portal with permissions to create App Registrations.
2. **Node.js**: Recommended v20 or later.

## ⚙️ Configuration

### 1. Azure App Registration
Before running the app, register it in the [Azure Portal](https://portal.azure.com/):
- **Name**: `SSO-Demo-App` (or any preferred name).
- **Supported account types**: "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)".
- **Redirect URI**:
  - Type: **SPA (Single Page Application)**
  - URI: `http://localhost:5173`
- **API Permissions**:
  - `User.Read` (Delegated)
  - `Files.Read` (Delegated) - *Grant admin consent if required*.

### 2. Project Setup
Replace the placeholders in `src/authConfig.ts` with your registration details:
```typescript
// src/authConfig.ts
export const msalConfig: Configuration = {
  auth: {
    clientId: "YOUR_CLIENT_ID",
    authority: "https://login.microsoftonline.com/YOUR_TENANT_ID",
    redirectUri: "http://localhost:5173",
  },
  // ...
};
```

## 📂 Implementation Details

### `src/authConfig.ts`
Contains the MSAL configuration, authentication requests, and Graph API endpoints. 
> [!NOTE]
> Uses `import type` for MSAL types to avoid runtime export errors.

### `src/main.tsx`
Initializes the `PublicClientApplication` instance and wraps the root component with `MsalProvider`. This ensures the auth state is accessible throughout the app.

### `src/App.tsx`
The core component managing:
- **Authentication Flow**: Uses `instance.loginRedirect()` and `instance.logoutRedirect()` to handle the login process seamlessly across all browsers (avoiding popup blockers).
- **Token Acquisition**: Uses `instance.acquireTokenSilent()` to get fresh access tokens for API calls.
- **Graph API Calls**: 
  - `GET /me`: Fetches username and email.
  - `GET /me/drive/root/children`: Lists filenames from the root of the user's OneDrive.

## 🏃 How to Run

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the app**:
   ```bash
   npm run dev
   ```
3. **Open browser**: Visit `http://localhost:5173`.
4. **Login**: Click "Login with Microsoft" and follow the redirect prompt.

## 💡 Key Learnings & Fixes

### 1. Redirect vs. Popup Flow
Popups are often blocked when triggered from within a webview or another popup (e.g., inside Intranet dashboards). This project uses the **Redirect Flow** to ensure reliability across all environments.

### 2. MSAL v3 Type Imports
Standard imports like `import { Configuration } from "@azure/msal-browser"` can cause runtime errors since `Configuration` is a TypeScript-only type. This is fixed by using `import type`.

### 3. Silent Token Acquisition
Access tokens in MSAL are short-lived. The app always attempts `acquireTokenSilent` before calling the Graph API to ensure the token is fresh or automatically renewed.
