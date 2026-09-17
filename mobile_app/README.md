# Enterprise Multi-Tenant HRMS Mobile App (React Native Expo)

Dedicated mobile application for Enterprise HRMS (`ravi_hrms`), built with **React Native**, **Expo**, and **TypeScript**.

## 🚀 Features Included
- **Authentication**: JWT Token / Keycloak login flow (`src/context/AuthContext.tsx`).
- **Dashboard**: Employee overview, status widgets, and quick action cards (`src/screens/DashboardScreen.tsx`).
- **Attendance & Geolocation**: Punch In / Punch Out with GPS tracking (`src/screens/AttendanceScreen.tsx`).
- **WorkBridge Tasks**: Mobile view for assigned tasks, status badges, and due dates (`src/screens/TasksScreen.tsx`).
- **Employee Profile**: Profile details and department overview (`src/screens/ProfileScreen.tsx`).

## 🛠️ How to Run Mobile App

1. Navigate to the `mobile_app/` directory:
   ```bash
   cd enterprise_hrms/mobile_app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Expo Dev Server on dedicated port **8088**:
   ```bash
   npm start
   ```

4. Open on device:
   - Scan the QR code using the **Expo Go** app on Android or iOS.
