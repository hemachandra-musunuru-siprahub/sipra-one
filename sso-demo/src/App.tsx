import { useMsal } from "@azure/msal-react";
import { useState, useEffect } from "react";
import { loginRequest, graphConfig } from "./authConfig";
import { ProtectedRoute } from "./components/ProtectedRoute";

const Dashboard = ({ internalUser }: { internalUser: any }) => {
  const { instance, accounts } = useMsal();
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  const handleLogout = () => {
    // First logout from our backend to clear the cookie
    fetch("http://localhost:3000/api/auth/logout", {
      method: "POST",
      credentials: "include"
    }).finally(() => {
      // Then logout from MSAL
      instance.logoutRedirect({
        postLogoutRedirectUri: "/",
      }).catch((e) => {
        console.error(e);
      });
    });
  };

  const handleExternalLink = (baseUrl: string) => {
    const account = instance.getAllAccounts()[0];

    if (account) {
      const email = encodeURIComponent(account.username);
      const separator = baseUrl.includes("?") ? "&" : "?";
      window.open(`${baseUrl}${separator}login_hint=${email}`, "_blank");
    } else {
      instance.loginRedirect(loginRequest).catch((e) => {
        console.error("Login redirect failed:", e);
      });
    }
  };

  const fetchWithToken = async (endpoint: string) => {
    const resp = await instance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });
    
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${resp.accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Graph API returned ${response.status}`);
    }
    
    return response.json();
  };

  const wrapLoading = async (key: string, task: () => Promise<void>) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    setError(null);
    try {
      await task();
    } catch (e: any) {
      setError(`Error in ${key}: ` + (e.message || "Unknown error"));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const fetchOneDriveFiles = () => wrapLoading("OneDriveFiles", async () => {
    const data = await fetchWithToken(graphConfig.graphOneDriveEndpoint);
    if (data.value) {
      setDriveFiles(data.value);
    } else {
      setError("No files found or unexpected response structure.");
    }
  });

  const sendConfirmationEmail = () => wrapLoading("Email", async () => {
    const resp = await instance.acquireTokenSilent({
      ...loginRequest,
      account: accounts[0],
    });

    const emailPayload = {
      message: {
        subject: "SSO Auto-Login Successful",
        body: {
          contentType: "Text",
          content: `You logged in automatically using SSO at ${new Date().toLocaleString()}`,
        },
        toRecipients: [
          {
            emailAddress: {
              address: accounts[0].username,
            },
          },
        ],
      },
      saveToSentItems: "true",
    };

    const response = await fetch(graphConfig.graphSendMailEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resp.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (response.ok) {
      alert("Confirmation email sent successfully!");
    } else {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Failed to send email: ${response.status}`);
    }
  });

  const userRoles = internalUser?.app_roles || [];
  
  const isHR = userRoles.includes("SipraHub-HR");
  const isManager = userRoles.includes("SipraHub-Manager");
  const isSystemAdmin = userRoles.includes("SipraHub-SystemAdmin");
  const isEmployee = userRoles.includes("SipraHub-Employee") || (!isHR && !isManager && !isSystemAdmin);

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#1e293b" }}>SipraHub Intranet</h1>
          <p style={{ margin: 0, color: "#64748b" }}>Welcome back, {internalUser?.name || accounts[0]?.name}</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {internalUser && (
            <span style={{ padding: "4px 8px", backgroundColor: "#e2e8f0", borderRadius: "4px", fontSize: "0.8rem", color: "#475569" }}>
              {internalUser.job_title || "Employee"} • {internalUser.department || "Organization"}
            </span>
          )}
          <button 
            onClick={() => window.location.href = "/hr-page"} 
            style={{ 
              padding: "8px 16px", 
              backgroundColor: "#86198f", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              cursor: "pointer",
              fontWeight: 500
            }}>
            Test HR Access
          </button>
          <button 
            onClick={() => window.location.href = "/employee-page"} 
            style={{ 
              padding: "8px 16px", 
              backgroundColor: "#059669", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              cursor: "pointer",
              fontWeight: 500
            }}>
            Test Employee Access
          </button>
          <button 
            onClick={() => window.location.href = "/manager-page"} 
            style={{ 
              padding: "8px 16px", 
              backgroundColor: "#ea580c", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              cursor: "pointer",
              fontWeight: 500
            }}>
            Test Manager Access
          </button>
          <button 
            onClick={() => window.location.href = "/admin-check"} 
            style={{ 
              padding: "8px 16px", 
              backgroundColor: "#2563eb", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              cursor: "pointer",
              fontWeight: 500
            }}>
            Test Admin Access
          </button>
          <button 
            onClick={handleLogout} 
            style={{ 
              padding: "8px 16px", 
              backgroundColor: "#ef4444", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              cursor: "pointer",
              fontWeight: 500
            }}>
            Logout
          </button>
        </div>
      </header>

      {error && (
        <div style={{ 
          padding: "12px 16px", 
          backgroundColor: "#fef2f2", 
          color: "#b91c1c", 
          marginBottom: "20px",
          border: "1px solid #fee2e2",
          borderRadius: "8px"
        }}>
          {error}
        </div>
      )}

      {/* Role-based navigation / rendering */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "40px" }}>
        {isHR && (
          <div style={{ flex: 1, padding: "20px", backgroundColor: "#fdf4ff", border: "1px solid #f0abfc", borderRadius: "12px" }}>
            <h3 style={{ marginTop: 0, color: "#86198f" }}>HR Dashboard</h3>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#701a75" }}>
              <li>Announcements Management</li>
              <li>HR Documents</li>
              <li>Leave Balance Management</li>
            </ul>
          </div>
        )}
        
        {isManager && (
          <div style={{ flex: 1, padding: "20px", backgroundColor: "#eff6ff", border: "1px solid #93c5fd", borderRadius: "12px" }}>
            <h3 style={{ marginTop: 0, color: "#1e40af" }}>Manager Dashboard</h3>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#1d4ed8" }}>
              <li>Approvals Page</li>
              <li>Team Timesheets</li>
              <li>Leave Approvals</li>
            </ul>
          </div>
        )}

        {isSystemAdmin && (
          <div style={{ flex: 1, padding: "20px", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "12px" }}>
            <h3 style={{ marginTop: 0, color: "#92400e" }}>System Admin Dashboard</h3>
            <ul style={{ margin: 0, paddingLeft: "20px", color: "#b45309" }}>
              <li>User Management</li>
              <li>Activation / Deactivation</li>
              <li>Technical Controls</li>
            </ul>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "40px" }}>
        {/* Common Employee Views */}
        <div style={{ border: "1px solid #e2e8f0", padding: "24px", borderRadius: "12px", backgroundColor: "white" }}>
          <h3 style={{ marginTop: 0 }}>Employee Tools</h3>
          <ul style={{ margin: 0, paddingLeft: "20px", color: "#475569", marginBottom: "20px" }}>
            <li>Dashboard</li>
            <li>Timesheets</li>
            <li>Leave Request</li>
            <li>Announcements View</li>
          </ul>
        </div>

        <div style={{ border: "1px solid #e2e8f0", padding: "24px", borderRadius: "12px", backgroundColor: "white" }}>
          <h3 style={{ marginTop: 0 }}>Files & OneDrive</h3>
          <button 
            disabled={loading["OneDriveFiles"]}
            onClick={fetchOneDriveFiles} 
            style={{ 
              width: "100%", 
              padding: "10px", 
              backgroundColor: "#2563eb", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              cursor: "pointer" 
            }}>
            {loading["OneDriveFiles"] ? "Loading..." : "Fetch OneDrive Files"}
          </button>
          
          <button 
            onClick={() => handleExternalLink("https://www.office.com/launch/onedrive")} 
            style={{ 
              width: "100%", 
              marginTop: "10px",
              padding: "10px", 
              backgroundColor: "#f8fafc", 
              color: "#475569", 
              border: "1px solid #e2e8f0", 
              borderRadius: "6px", 
              cursor: "pointer",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}>
            <span>🌐</span> Open OneDrive
          </button>
          
          {driveFiles.length > 0 && (
            <ul style={{ marginTop: "20px", padding: 0, listStyle: "none", maxHeight: "200px", overflowY: "auto", fontSize: "0.9rem" }}>
              {driveFiles.map((file: any) => (
                <li key={file.id} style={{ padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>📄 {file.name}</li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ border: "1px solid #e2e8f0", padding: "24px", borderRadius: "12px", backgroundColor: "white" }}>
          <h3 style={{ marginTop: 0 }}>Communication</h3>
          <button 
            disabled={loading["Email"]}
            onClick={sendConfirmationEmail} 
            style={{ 
              width: "100%", 
              padding: "10px", 
              backgroundColor: "#059669", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              cursor: "pointer" 
            }}>
            {loading["Email"] ? "Sending..." : "Send SSO Confirm"}
          </button>

          <button 
            onClick={() => handleExternalLink("https://outlook.office.com/mail/")}
            style={{ 
              width: "100%", 
              marginTop: "10px",
              padding: "10px", 
              backgroundColor: "#f8fafc", 
              color: "#475569", 
              border: "1px solid #e2e8f0", 
              borderRadius: "6px", 
              cursor: "pointer",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}>
            <span>📧</span> Open Outlook
          </button>

          <button
            onClick={() => handleExternalLink("https://teams.microsoft.com/")}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#f8fafc",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}>
            <span>💬</span> Open Teams
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminCheck = ({ internalUser }: { internalUser: any }) => {
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  
  useEffect(() => {
    fetch("http://localhost:3000/api/admin-check", { credentials: "include" })
      .then(res => {
        if (res.status === 403 || res.status === 401) {
          setApiResponse("Access Denied");
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.message) {
          setApiResponse(data.message);
        }
      })
      .catch(console.error);
  }, []);

  const userRoles = internalUser?.app_roles || [];
  const isAdmin = userRoles.includes("Admin") || userRoles.includes("SipraHub-SystemAdmin");

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      <h2>Admin Role Check</h2>
      
      <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px", marginBottom: "20px" }}>
        <h3>Frontend Role Check:</h3>
        {isAdmin ? (
          <p style={{ color: "green", fontWeight: "bold" }}>Admin Access Success</p>
        ) : (
          <p style={{ color: "red", fontWeight: "bold" }}>Access Denied – You are not an Admin</p>
        )}
      </div>

      <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
        <h3>Backend API Check (/api/admin-check):</h3>
        {apiResponse === "Admin Access Success" ? (
          <p style={{ color: "green", fontWeight: "bold" }}>{apiResponse}</p>
        ) : apiResponse ? (
          <p style={{ color: "red", fontWeight: "bold" }}>{apiResponse}</p>
        ) : (
          <p>Loading...</p>
        )}
      </div>

      <button 
        onClick={() => window.location.href = "/"}
        style={{ marginTop: "20px", padding: "10px 15px", cursor: "pointer" }}
      >
        Back to Dashboard
      </button>
    </div>
  );
};

const HrCheck = ({ internalUser }: { internalUser: any }) => {
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  
  useEffect(() => {
    fetch("http://localhost:3000/api/hr-check", { credentials: "include" })
      .then(res => {
        if (res.status === 403 || res.status === 401) {
          setApiResponse("Access Denied");
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.message) {
          setApiResponse(data.message);
        }
      })
      .catch(console.error);
  }, []);

  const userRoles = internalUser?.app_roles || [];
  const isHR = userRoles.includes("HR") || userRoles.includes("SipraHub-HR");

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      <h2>HR Role Check</h2>
      
      <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px", marginBottom: "20px" }}>
        <h3>Frontend Role Check:</h3>
        {isHR ? (
          <p style={{ color: "green", fontWeight: "bold" }}>HR Access Success</p>
        ) : (
          <p style={{ color: "red", fontWeight: "bold" }}>Access Denied – You are not HR</p>
        )}
      </div>

      <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
        <h3>Backend API Check (/api/hr-check):</h3>
        {apiResponse === "HR Access Success" ? (
          <p style={{ color: "green", fontWeight: "bold" }}>{apiResponse}</p>
        ) : apiResponse ? (
          <p style={{ color: "red", fontWeight: "bold" }}>{apiResponse}</p>
        ) : (
          <p>Loading...</p>
        )}
      </div>

      <button 
        onClick={() => window.location.href = "/"}
        style={{ marginTop: "20px", padding: "10px 15px", cursor: "pointer" }}
      >
        Back to Dashboard
      </button>
    </div>
  );
};

const EmployeeCheck = ({ internalUser }: { internalUser: any }) => {
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  
  useEffect(() => {
    fetch("http://localhost:3000/api/employee-check", { credentials: "include" })
      .then(res => {
        if (res.status === 403 || res.status === 401) {
          setApiResponse("Access Denied");
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.message) {
          setApiResponse(data.message);
        }
      })
      .catch(console.error);
  }, []);

  const userRoles = internalUser?.app_roles || [];
  const isEmployee = userRoles.includes("Employee") || userRoles.includes("SipraHub-Employee");

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      <h2>Employee Role Check</h2>
      
      <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px", marginBottom: "20px" }}>
        <h3>Frontend Role Check:</h3>
        {isEmployee ? (
          <p style={{ color: "green", fontWeight: "bold" }}>Employee Access Success</p>
        ) : (
          <p style={{ color: "red", fontWeight: "bold" }}>Access Denied – You are not an Employee</p>
        )}
      </div>

      <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
        <h3>Backend API Check (/api/employee-check):</h3>
        {apiResponse === "Employee Access Success" ? (
          <p style={{ color: "green", fontWeight: "bold" }}>{apiResponse}</p>
        ) : apiResponse ? (
          <p style={{ color: "red", fontWeight: "bold" }}>{apiResponse}</p>
        ) : (
          <p>Loading...</p>
        )}
      </div>

      <button 
        onClick={() => window.location.href = "/"}
        style={{ marginTop: "20px", padding: "10px 15px", cursor: "pointer" }}
      >
        Back to Dashboard
      </button>
    </div>
  );
};

const ManagerCheck = ({ internalUser }: { internalUser: any }) => {
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  
  useEffect(() => {
    fetch("http://localhost:3000/api/manager-check", { credentials: "include" })
      .then(res => {
        if (res.status === 403 || res.status === 401) {
          setApiResponse("Access Denied");
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.message) {
          setApiResponse(data.message);
        }
      })
      .catch(console.error);
  }, []);

  const userRoles = internalUser?.app_roles || [];
  const isManager = userRoles.includes("Manager") || userRoles.includes("SipraHub-Manager");

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
      <h2>Manager Role Check</h2>
      
      <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px", marginBottom: "20px" }}>
        <h3>Frontend Role Check:</h3>
        {isManager ? (
          <p style={{ color: "green", fontWeight: "bold" }}>Manager Access Success</p>
        ) : (
          <p style={{ color: "red", fontWeight: "bold" }}>Access Denied – You are not a Manager</p>
        )}
      </div>

      <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
        <h3>Backend API Check (/api/manager-check):</h3>
        {apiResponse === "Manager Access Success" ? (
          <p style={{ color: "green", fontWeight: "bold" }}>{apiResponse}</p>
        ) : apiResponse ? (
          <p style={{ color: "red", fontWeight: "bold" }}>{apiResponse}</p>
        ) : (
          <p>Loading...</p>
        )}
      </div>

      <button 
        onClick={() => window.location.href = "/"}
        style={{ marginTop: "20px", padding: "10px 15px", cursor: "pointer" }}
      >
        Back to Dashboard
      </button>
    </div>
  );
};

const App = () => {
  const currentPath = window.location.pathname;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <ProtectedRoute>
        {currentPath === "/admin-check" ? (
          <DashboardRenderer isCheckPage={true} pageType="admin" />
        ) : currentPath === "/hr-page" ? (
          <DashboardRenderer isCheckPage={true} pageType="hr" />
        ) : currentPath === "/employee-page" ? (
          <DashboardRenderer isCheckPage={true} pageType="employee" />
        ) : currentPath === "/manager-page" ? (
          <DashboardRenderer isCheckPage={true} pageType="manager" />
        ) : (
          <DashboardRenderer isCheckPage={false} />
        )}
      </ProtectedRoute>
    </div>
  );
};

const DashboardRenderer = ({ isCheckPage, pageType }: { isCheckPage: boolean, pageType?: string }) => {
  const [internalUser, setInternalUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetch("http://localhost:3000/api/auth/me", {credentials: "include"})
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load session: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.user) {
          setInternalUser(data.user);
        } else {
          setError("User data missing from session response.");
        }
      })
      .catch((err) => {
        console.error("Session load error:", err);
        setError(err.message || "Failed to communicate with backend");
      });
  }, []);

  if (error) {
    return (
      <div style={{ padding: "40px", color: "#b91c1c", textAlign: "center" }}>
        <h3>Session Error</h3>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{ padding: "8px 16px", marginTop: "10px", cursor: "pointer" }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!internalUser) {
    return <div style={{ padding: "40px" }}>Loading user session...</div>;
  }

  if (isCheckPage) {
    if (pageType === "hr") {
      return <HrCheck internalUser={internalUser} />;
    }
    if (pageType === "employee") {
      return <EmployeeCheck internalUser={internalUser} />;
    }
    if (pageType === "manager") {
      return <ManagerCheck internalUser={internalUser} />;
    }
    return <AdminCheck internalUser={internalUser} />;
  }

  return <Dashboard internalUser={internalUser} />;
};

export default App;
