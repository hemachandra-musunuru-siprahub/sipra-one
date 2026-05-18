import { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Settings, Save, AlertTriangle, Play, HelpCircle } from "lucide-react";
import { getTimesheetReminderSettings, updateTimesheetReminderSettings, triggerTimesheetReminder } from "../../api/admin";
import toast from "react-hot-toast";

interface Props {
  internalUser: any;
}

export const AdminSettingsPage = ({ internalUser }: Props) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);

  const [fridayEnabled, setFridayEnabled] = useState(true);
  const [fridayTime, setFridayTime] = useState("15:00");
  const [mondayEnabled, setMondayEnabled] = useState(true);
  const [mondayTime, setMondayTime] = useState("09:00");

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getTimesheetReminderSettings();
      if (data.settings) {
        setFridayEnabled(data.settings.friday_enabled);
        setFridayTime(data.settings.friday_time);
        setMondayEnabled(data.settings.monday_enabled);
        setMondayTime(data.settings.monday_time);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load reminder settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateTimesheetReminderSettings({
        friday_enabled: fridayEnabled,
        friday_time: fridayTime,
        monday_enabled: mondayEnabled,
        monday_time: mondayTime,
      });
      toast.success("Timesheet reminder settings saved successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTrigger = async (type: "friday" | "monday") => {
    if (!window.confirm(`Are you sure you want to trigger the ${type} reminder notifications immediately?`)) {
      return;
    }
    setTriggering(type);
    try {
      await triggerTimesheetReminder(type);
      toast.success(`Successfully dispatched ${type} reminder notifications`);
    } catch (e: any) {
      toast.error(e.message || `Failed to trigger ${type} reminders`);
    } finally {
      setTriggering(null);
    }
  };

  return (
    <DashboardLayout internalUser={internalUser} role="Admin">
      <header className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: "2rem", fontWeight: 800 }}>Admin Settings</h1>
          <p className="page-subtitle" style={{ color: "var(--neutral-500)", marginTop: 4 }}>
            Configure global system-wide policies, automations, and scheduled reminders.
          </p>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--neutral-500)", padding: "var(--space-12)" }}>
          <div style={{
            width: 40, height: 40, border: "3px solid var(--primary-600)",
            borderTopColor: "transparent", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", margin: "0 auto var(--space-4)"
          }} />
          <p>Retrieving configurations...</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)", alignItems: "start" }}>
          
          {/* Timesheet Reminders Settings Card */}
          <form onSubmit={handleSave} className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card__header" style={{ borderBottom: "1px solid var(--neutral-100)", paddingBottom: "var(--space-4)" }}>
              <h3 className="card__title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "1.25rem", fontWeight: 700 }}>
                <Settings size={20} style={{ color: "var(--primary-600)" }} /> Timesheet Reminder Policies
              </h3>
            </div>

            <div style={{ padding: "var(--space-6)", display: "grid", gap: "var(--space-6)" }}>
              
              {/* Friday Settings */}
              <div style={{ background: "var(--neutral-50)", padding: "var(--space-4)", borderRadius: "var(--rounded-lg)", border: "1px solid var(--neutral-200)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                  <div>
                    <h4 style={{ fontWeight: 600, color: "var(--neutral-800)", marginBottom: 4 }}>Friday Afternoon Reminder</h4>
                    <p style={{ fontSize: "0.8125rem", color: "var(--neutral-500)" }}>
                      Sends a reminder to employees who have not yet submitted their timesheets for the current week.
                    </p>
                  </div>
                  <label className="toggle-switch" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={fridayEnabled} 
                      onChange={e => setFridayEnabled(e.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{fridayEnabled ? "Enabled" : "Disabled"}</span>
                  </label>
                </div>
                
                {fridayEnabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--neutral-600)" }}>Reminder Time (Friday):</label>
                    <input 
                      type="time" 
                      className="input" 
                      style={{ width: 140 }}
                      value={fridayTime} 
                      onChange={e => setFridayTime(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Monday Settings */}
              <div style={{ background: "var(--neutral-50)", padding: "var(--space-4)", borderRadius: "var(--rounded-lg)", border: "1px solid var(--neutral-200)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                  <div>
                    <h4 style={{ fontWeight: 600, color: "var(--neutral-800)", marginBottom: 4 }}>Monday Morning Reminder & Summary</h4>
                    <p style={{ fontSize: "0.8125rem", color: "var(--neutral-500)" }}>
                      Sends an overdue notification for the previous week's missing timesheet, and sends managers a summary of overdue sheets from their team.
                    </p>
                  </div>
                  <label className="toggle-switch" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={mondayEnabled} 
                      onChange={e => setMondayEnabled(e.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{mondayEnabled ? "Enabled" : "Disabled"}</span>
                  </label>
                </div>

                {mondayEnabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--neutral-600)" }}>Reminder Time (Monday):</label>
                    <input 
                      type="time" 
                      className="input" 
                      style={{ width: 140 }}
                      value={mondayTime} 
                      onChange={e => setMondayTime(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

            </div>

            <div className="card__footer" style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
              <button type="submit" className="btn btn--primary" disabled={saving}>
                <Save size={16} /> {saving ? "Saving..." : "Save Policies"}
              </button>
            </div>
          </form>

          {/* Test & Trigger Panel Card */}
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card__header" style={{ borderBottom: "1px solid var(--neutral-100)", paddingBottom: "var(--space-4)" }}>
              <h3 className="card__title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "1.25rem", fontWeight: 700 }}>
                <AlertTriangle size={20} style={{ color: "var(--error-500)" }} /> Trigger Testing Panel
              </h3>
            </div>
            
            <div style={{ padding: "var(--space-6)" }}>
              <div style={{
                display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
                padding: "var(--space-3)", background: "#FFFBEB", border: "1px solid #FDE68A",
                borderRadius: "var(--rounded-lg)", color: "#B45309", marginBottom: "var(--space-6)",
                fontSize: "0.875rem"
              }}>
                <HelpCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ fontWeight: 600, marginBottom: 2 }}>Developer & Verification Tools</h4>
                  <p>Use these buttons to instantly trigger the reminder logic. The system will scan the database for missing timesheets relative to the current local time, and generate in-app notifications immediately. Great for visual verification!</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--space-4)" }}>
                <button 
                  className="btn btn--secondary" 
                  onClick={() => handleTrigger("friday")} 
                  disabled={triggering !== null}
                  style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "var(--space-4)" }}
                >
                  <Play size={16} /> 
                  {triggering === "friday" ? "Dispatching Friday..." : "Trigger Friday Reminders Now"}
                </button>
                
                <button 
                  className="btn btn--secondary" 
                  onClick={() => handleTrigger("monday")} 
                  disabled={triggering !== null}
                  style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "var(--space-4)" }}
                >
                  <Play size={16} /> 
                  {triggering === "monday" ? "Dispatching Monday..." : "Trigger Monday & Manager Summary"}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </DashboardLayout>
  );
};
