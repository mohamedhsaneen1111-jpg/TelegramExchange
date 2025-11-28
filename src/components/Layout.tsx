import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, PlusCircle, PlayCircle, Users, User, LogOut, ListTodo } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/earn', icon: PlayCircle, label: 'Earn' },
    { to: '/add-channel', icon: PlusCircle, label: 'Add' },
    { to: '/my-tasks', icon: ListTodo, label: 'My Tasks' }, // Added My Tasks
    { to: '/ads', icon: PlayCircle, label: 'Ads' },
    { to: '/referrals', icon: Users, label: 'Invite' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 md:pl-64">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 bg-white border-r border-gray-200 px-4 py-6">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            TE
          </div>
          <span className="text-xl font-bold text-gray-900">TelegramEx</span>
        </div>
        
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg mt-auto"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 h-16 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            TE
          </div>
          <span className="text-lg font-bold text-gray-900">TelegramEx</span>
        </div>
        <button onClick={handleLogout} className="p-2 text-gray-500">
            <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="pt-20 md:pt-8 px-4 max-w-5xl mx-auto">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around h-16 z-20 pb-safe">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full gap-1 ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
