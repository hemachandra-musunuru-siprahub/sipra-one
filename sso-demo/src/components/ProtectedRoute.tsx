import { AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import { LoginHandler } from "./LoginHandler";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  return (
    <LoginHandler>
      <AuthenticatedTemplate>
        {children}
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        {/* UnauthenticatedTemplate can show something brief during the split second of redirection */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontFamily: "sans-serif",
          color: "#4b5563"
        }}>
          Redirecting to Microsoft...
        </div>
      </UnauthenticatedTemplate>
    </LoginHandler>
  );
};
