# Jira Source of Truth - SipraOne

This document serves as the official reference for the Jira board integration for the IntranetMVP project.

## 1. Board Information
- **Project Name:** SipraOne
- **Project Key:** SIP
- **Project ID:** 10165
- **Cloud ID:** `a527f1de-2581-47cf-80ae-e3993a3a8b94`
- **URL:** [https://siprahub.atlassian.net](https://siprahub.atlassian.net)

## 2. Codebase Association
- **Codebase:** IntranetMVP (Root)
- **Primary Board:** SipraOne (Jira)
- **Always associate Intranet Project with SipraOne Jira Board.**

## 3. Data Source
- **Primary Source:** `D:\IntranetMVP\stories.csv` (Mapped from Phase 1 All Stories CSV)

## 4. Field Mappings (CSV to Jira)
| CSV Column | Jira Field | Jira Type | Notes |
| :--- | :--- | :--- | :--- |
| **Epic/Module** | Summary | Epic | Created first if not exists. |
| **Title** | Summary | Task | Represents the Feature Name. |
| **User Story** | Description | Text | The "As a user..." context. |
| **Implementation Details** | Summary | Subtask | Split into multiple subtasks per line/bullet. |
| **Priority** | Priority | ID | Mapped to standard Jira priorities. |
| **Estimate** | Story Points | Number | Mapped to `customfield_10016` (Best effort). |
| **Acceptance Criteria** | Description | Text | Added to the main Task description. |

## 5. Hierarchy
1. **Epic** (Module)
2. **Task** (Feature)
3. **Subtask** (Implementation Step)

---
*Last Updated: 2026-05-14*
