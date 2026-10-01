import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import AllPayments from './page/allPayments';
import Home from './page/home';
import UserDetail from './page/userDetail';
import Users from './page/users';

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'flex flex-1 items-center justify-center py-3 transition',
    isActive ? 'text-gray-900' : 'text-gray-400 hover:text-gray-700',
  ].join(' ');
}

function App() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-2xl px-5 py-8 pb-24">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/users" element={<Users />} />
          <Route path="/payments" element={<AllPayments />} />
          <Route path="/user/:id" element={<UserDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-2xl items-stretch px-5">
          <NavLink
            to="/"
            end
            className={navClass}
            aria-label="Search"
            title="Search"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m12.5 12.5 4 4" />
            </svg>
          </NavLink>

          <NavLink
            to="/users"
            className={navClass}
            aria-label="Users"
            title="Users"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <circle cx="7" cy="7" r="2.5" />
              <path d="M2 16c.8-2.7 2.6-4 5-4s4.2 1.3 5 4" />
              <path d="M13 4.7a2.5 2.5 0 0 1 0 4.6" />
              <path d="M14.5 12.3c1.7.5 2.9 1.7 3.5 3.7" />
            </svg>
          </NavLink>

          <NavLink
            to="/payments"
            className={navClass}
            aria-label="All payments"
            title="All payments"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <rect x="2.5" y="5" width="15" height="10" rx="1.5" />
              <circle cx="10" cy="10" r="2" />
              <path d="M5.5 7.5h.01M14.5 12.5h.01" />
            </svg>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

export default App;
