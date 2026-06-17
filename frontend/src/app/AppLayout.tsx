import { Outlet } from 'react-router-dom';
import AppHeader from '../shared/components/AppHeader';
import BottomNav from '../shared/components/BottomNav';

// App shell for the in-app (post-onboarding) pages: a viewport-height column of
// a header, a scrollable content region, and (on mobile) the floating bottom tab
// bar. On desktop the nav lives in the header; the content region owns the
// scroll so the header and bar stay put.
export default function AppLayout() {
  return (
    <div className="flex h-screen-safe flex-col bg-background">
      <AppHeader />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
