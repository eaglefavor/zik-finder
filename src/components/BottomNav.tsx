'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Globe, User, Heart } from 'lucide-react';
import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';

export default function BottomNav() {
  const pathname = usePathname();
  const { role, user } = useAppContext();
  const { unreadCount } = useData();

  if (!user) return null;

  const studentTabs = [
    { label: 'Explore', icon: Search, path: '/' },
    { label: 'Saved', icon: Heart, path: '/favorites' },
    { label: 'Market', icon: Globe, path: '/market' },
    { label: 'Profile', icon: User, path: '/profile' },
  ];

  const landlordTabs = [
    { label: 'Lodges', icon: Home, path: '/' },
    { label: 'Market', icon: Globe, path: '/market' },
    { label: 'Profile', icon: User, path: '/profile' },
  ];

  const tabs = role === 'student' ? studentTabs : landlordTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 pb-6 flex justify-between items-center z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.path;
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`flex flex-col items-center gap-1 relative ${
              isActive ? 'text-blue-600' : 'text-gray-500'
            }`}
          >
            <div className="relative">
              <Icon size={24} />
              {tab.label === 'Profile' && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              )}
            </div>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
