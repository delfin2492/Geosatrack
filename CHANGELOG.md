# Changelog - GeoMesh Platform

All notable changes and updates to the GeoMesh Industrial Asset Tracking Platform are documented below.

---

## [1.1.0] - 2026-08-13

### Added
- **Global System Settings (`/system-settings`):**
  - Added a centralized configuration panel (accessible only to Superadmin) to manage platform-wide integration credentials securely.
  - Supported integrations: **Global SMTP Configuration** (Host, Port, User, Password) and **Telegram Bot Integration** (Bot Token).
- **Live Debug Logs Console (`/logs`):**
  - Fully redesigned the Live Logs screen into a modern macOS-inspired terminal console window.
  - Added an **Auto-scroll** toggle switch to pause and resume automatic scrolling.
  - Added an **All Assets** filter dropdown dynamically populated from active tenant assets.
  - Integrated a **JSON Payload Viewer** (`+ Show Payload` / `- Hide Payload`) with syntax formatting for incoming MQTT packets, Wirepas messages, telemetry payload, rules triggers, and geofence events.
- **Notifications History Page (`/notifications`):**
  - A new full history page with calendar date filters (`startDate` to `endDate`).
  - Replaced the status column (Resolved/Unresolved) with a **Type** column displaying descriptive badges:
    - 🚨 `Alert Alarm` (emergency alarms, geofence violations)
    - ✉️ `Email` (SMTP notification events)
    - ✈️ `Telegram` (Telegram Bot notifications)
    - ⚠️ `Fall Detected` / `Tilt Warning` / `Sensor Alert` (sensor telemetry triggers)
- **ConfirmModal Component (`/components/ConfirmModal.tsx`):**
  - Created a sleek, custom confirmation modal featuring a dark/light responsive layout, backdrop blur, smooth animated entry/exit, and clear action button variants (`danger`, `warning`, `info`).

### Changed
- **Automation Rules Engine (`/rules`):**
  - **Node Simplification:** Removed redundant authentication inputs from `action_email` (SMTP Host/Port) and `action_telegram` (Bot Token) nodes. The engine now dynamically fetches credentials from the Global System Settings.
  - **Email Template:** Upgraded the raw-text outbound email to a professional HTML format featuring the "GeoMesh Alarm Alert" layout with bold styling for dynamic variables.
  - **Helper Tooltips:** Added a smart helper box on messaging nodes detailing exactly which text-interpolation variables are supported by the backend payload (e.g. `{assetName}`, `{geofenceName}`, `{time}`) along with formatting instructions and clickable bot integration links.
- **Header Notification Dropdown (`NotificationDropdown.tsx`):**
  - Simplified dropdown design: removed date filter and merged "New Alerts" and "History" into a single, unified feed showing the **10 latest notifications**.
  - Local Dismissal Logic: deleting or clearing items from the dropdown dismisses them locally from the dropdown view only (saved in `localStorage`), preserving the raw history in the database so it remains fully readable on the main history page.
- **Rules Engine Service Integration:**
  - Automated alerts to write historical events with specific types (`email`, `telegram`, `alert_alarm`) upon execution of rule action nodes.

### Fixed
- **WebSocket Lifecycle & Auth Hook (`SocketContext.tsx`):**
  - Fixed socket connection logic to successfully connect and emit `joinTenant` when using standard credentials authentication (where `token` is null and `tenantId` is used).
  - Standardized WebSocket transport parameters to include fallback polling.
- **TypeScript & Build Errors:**
  - Fixed missing `Loader2` imports in layout components.
  - Fixed type mismatches on `socketStatus` state machine.
  - Cleaned up duplicate state declarations in the Automation Rules screen.
  - Removed all native browser popups (`window.confirm` and `window.alert`) across Planner, Tenants, Settings, 3D Floorplan, and Rules pages, replacing them with the custom `ConfirmModal`.
