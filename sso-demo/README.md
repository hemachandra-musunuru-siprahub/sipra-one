# Microsoft SSO & Graph API Demo: Project Report

## Section 1: Project Overview

This project is a **minimal Microsoft SSO (Single Sign-On) demo application** built to explore and validate authentication patterns and data fetching capabilities within the Microsoft ecosystem. 

The primary focus is on **engineering-grade authentication** and **secure API integration** using Microsoft Entra ID (formerly Azure AD) and Microsoft Graph API. Adhering to project requirements, the UI/UX is intentionally kept minimal to prioritize technical robustness over visual design.

---

## Section 2: Tech Stack Used

The following technologies were employed to build and verify the solution:

- **Frontend**: [React 19](https://react.dev/) (Functional Components, Hooks)
- **Tooling**: [Vite](https://vitejs.dev/) for ultra-fast build and development
- **Language**: [TypeScript](https://www.typescriptlang.org/) for type safety and better developer experience
- **Identity Provider**: [Microsoft Entra ID](https://www.microsoft.com/en-us/security/business/identity-access/microsoft-entra-id) (Azure AD)
- **Authentication Libraries**: 
  - [@azure/msal-browser](https://www.npmjs.com/package/@azure/msal-browser) (Core logic)
  - [@azure/msal-react](https://www.npmjs.com/package/@azure/msal-react) (React integration)
- **APIs**: [Microsoft Graph API](https://developer.microsoft.com/en-us/graph) (v1.0)
- **Testing Tools**: [Postman](https://www.postman.com/) (For independent OAuth 2.0 flow verification and API testing)
- **Environment**: Node.js (v20+)

---

## Section 3: What Has Been Implemented

### 3.1 Azure Setup
- **App Registration**: Configured `SSO-Demo-App` in the Microsoft Entra ID portal.
- **Tenant Configuration**: Set up for **Single-tenant** access to ensure enterprise security boundaries.
- **Redirect URIs**:
  - **SPA (Single Page Application)**: `http://localhost:5173` for the React application.
  - **Web/Postman**: Configured Postman callback URIs for independent token generation.
- **Identifiers**: Generated and configured `Client ID` and `Tenant ID`.

### 3.2 Authentication (SSO)
- **OAuth 2.0 Flow**: Implemented a secure redirect-based authentication flow.
- **MSAL Integration**: Leveraged the MSAL library to manage the authentication handshake.
- **Flow Choice**: Switched from `loginPopup` to `loginRedirect` to ensure compatibility with all browser environments (specifically avoiding "block_nested_popups" errors).
- **Callback Handling**: Used `handleRedirectPromise` to process authentication results cleanly after the redirect back to the app.

### 3.3 Token Management
- **Silent Acquisition**: Implemented `acquireTokenSilent` to retrieve fresh access tokens without user interaction.
- **Bearer Tokens**: Processed and attached tokens to the `Authorization` header for all Graph API requests.

### 3.4 Microsoft Graph API Integration
- **a. User Data**: `GET /me` – Successfully fetches and displays the authenticated user's display name and email address.
- **b. OneDrive Files**: `GET /me/drive/root/children` – Fetches and lists filenames from the root directory of the user's OneDrive.
- **c. Email Sending (Advanced Feature)**: `POST /me/sendMail` – Implemented functionality to send a confirmation email directly through the user's Outlook account upon login.

### 3.5 Postman Testing
- **OAuth 2.0 Config**: Verified the authentication flow in Postman using the Authorization Code flow.
- **Endpoint Validation**: Independently tested `/me` and `/drive` endpoints to verify scope permissions and token validity before UI implementation.

---

## Section 4: Issues Faced & Fixes

| Issue | Root Cause | Fix |
| :--- | :--- | :--- |
| **`package.json` Error** | Running commands in the wrong directory level. | Navigated directly to the `sso-demo` project folder. |
| **MSAL Import Error** | Attempting to import `Configuration` as a runtime object. | Changed to `import type` as it is a TypeScript definition. |
| **`block_nested_popups`** | Using popups within a restricted browser environment. | Switched authentication flow to `loginRedirect`. |
| **Permission Denied** | Missing scopes for Mail and Files. | Added `Files.Read` and `Mail.Send` to `loginRequest` and updated Azure Portal. |

---

## Section 5: Final Working Flow

1. **User Initiation**: User clicks the "Login with Microsoft" button.
2. **Microsoft Redirect**: App redirects to the Microsoft Entra login page.
3. **Authentication**: User signs in; Microsoft redirects back to the app with an auth code.
4. **Token Exchange**: App exchanges the code for an Access Token and ID Token.
5. **Session Established**: `AuthenticatedTemplate` renders, showing the user's name.
6. **Data Fetching**:
   - User clicks **"Fetch User Info"** -> Graph API returns profile data.
   - User clicks **"Fetch OneDrive Files"** -> Graph API returns file list.
   - User clicks **"Send Confirmation Email"** -> Graph API sends an automated email.

---

## Section 6: Mapping to Discussion Requirements

| Requirement | Implementation Status |
| :--- | :--- |
| **1. Focus on SSO and Auth** | ✅ Fully implemented using Microsoft Entra ID and OAuth 2.0 protocols. |
| **2. No UI Focus** | ✅ Maintained a clean, minimal UI with basic buttons and text outputs. |
| **3. Working in Postman** | ✅ OAuth/OIDC flow and API endpoints verified independently in Postman. |
| **4. Fetch data after login** | ✅ Demonstrated successful retrieval of Profile, OneDrive, and Outlook data. |
| **5. Engineering-focused** | ✅ Prioritized token handling, silent renewal, and secure API headers. |
| **6. R&D on SSO** | ✅ Explored best practices for MSAL integration in React SPAs. |

---

## Section 7: Best SSO Approach (Conclusion)

Based on the implementation and R&D phase, the **Microsoft Entra ID + OAuth 2.0 + MSAL** stack is the most recommended approach for enterprise SSO. It offers:
- **Security**: Industry-standard protocols with built-in token management.
- **Scalability**: Seamlessly handles multi-tenant scenarios and integrates with the entire Microsoft 365 ecosystem.
- **Maintenance**: The MSAL library abstracts complex OAuth logic, reducing the risk of security vulnerabilities in custom code.

---

## Section 8: Conclusion

The project has successfully demonstrated a robust, end-to-end Microsoft SSO implementation. By focusing on the core engineering challenges—token lifecycle, scope management, and redirect flows—we have created a solid foundation that can be easily extended into a full-scale enterprise application. All requirements from the initial project call have been met or exceeded.
