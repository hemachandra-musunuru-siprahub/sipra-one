import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--neutral-50)",
          fontFamily: "Inter, sans-serif",
          padding: "20px",
          textAlign: "center"
        }}>
          <div style={{
            background: "white",
            padding: "40px",
            borderRadius: "16px",
            boxShadow: "var(--shadow-lg)",
            maxWidth: "480px",
            width: "100%",
            border: "1px solid var(--neutral-200)"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              background: "var(--error-50)",
              color: "var(--error-600)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px"
            }}>
              <AlertTriangle size={32} />
            </div>
            
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--neutral-900)", marginBottom: "12px" }}>
              Something went wrong
            </h1>
            
            <p style={{ color: "var(--neutral-600)", marginBottom: "32px", lineHeight: "1.6" }}>
              The application encountered an unexpected error. This has been logged, and we're working on a fix.
            </p>

            {this.state.error && (
              <div style={{
                background: "var(--neutral-100)",
                padding: "12px",
                borderRadius: "8px",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "var(--neutral-700)",
                marginBottom: "32px",
                textAlign: "left",
                overflow: "auto",
                maxHeight: "100px"
              }}>
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button 
                className="btn btn--primary" 
                onClick={() => window.location.reload()}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <RotateCcw size={16} /> Reload Page
              </button>
              <button 
                className="btn btn--secondary" 
                onClick={() => window.location.href = "/"}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Home size={16} /> Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
