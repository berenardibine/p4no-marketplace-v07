// The Enterprise Traffic Dashboard has been MERGED into the Unified Traffic &
// Cache Monitor (/admin/cache). There is now exactly one monitoring
// architecture, one telemetry pipeline and one set of metric definitions.
//
// This module only preserves the old route so existing links keep working.

import { Navigate } from 'react-router-dom';

export default function AdminTrafficDashboard() {
  return <Navigate to="/admin/cache" replace />;
}
