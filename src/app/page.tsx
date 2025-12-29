'use client';

import { useAppContext } from '@/lib/context';
import { useData } from '@/lib/data-context';
import { ShieldCheck, LogOut, Settings, HelpCircle, Bell, Lock, PlusCircle, Trash2, Edit3, X, CheckCircle, Eye, MapPin, Heart, Phone, MessageCircle, Loader2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import AuthScreen from '@/components/AuthScreen';

const AdminLink = ({ role }: { role: string }) => (
  role === 'admin' ? (
    <Link href="/admin" className="block mb-6 bg-gray-900 text-white p-4 rounded-2xl shadow-lg shadow-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="font-bold">Admin Dashboard</div>
            <div className="text-[10px] text-white/60 uppercase font-black tracking-widest">System Control</div>
          </div>
        </div>
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
          <Edit3 size={16} />
        </div>
      </div>
    </Link>
  ) : null
);

export default function Home() {
  const { user, role, logout, isLoading: authLoading } = useAppContext();
  const { lodges, requests, deleteLodge, updateLodgeStatus, updateUnitAvailability, toggleFavorite, favorites, isLoading: dataLoading } = useData();
  const router = useRouter();
  const [loadingCallId, setLoadingCallId] = useState<string | null>(null);
  const [loadingMsgId, setLoadingMsgId] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (confirm('Are you sure you want to delete this lodge?')) {
      await deleteLodge(id);
    }
  };

  const handleCall = async (lodge: any) => {
    setLoadingCallId(lodge.id);
    if (user) {
      try {
        await supabase.from('notifications').insert({
          user_id: lodge.landlord_id,
          title: 'New Lead! 📞',
          message: `A student clicked to call you about "${lodge.title}" (Dashboard).`,
          type: 'info',
          link: `/lodge/${lodge.id}`
        });
      } catch (e) { console.error(e); }
    }
    // Artificial delay for visual feedback
    await new Promise(r => setTimeout(r, 600));
    window.location.href = `tel:${lodge.profiles?.phone_number}`;
    setTimeout(() => setLoadingCallId(null), 2000);
  };

  const handleWhatsApp = async (lodge: any) => {
    setLoadingMsgId(lodge.id);
    if (user) {
      try {
        await supabase.from('notifications').insert({
          user_id: lodge.landlord_id,
          title: 'WhatsApp Inquiry! 💬',
          message: `A student clicked to message you about "${lodge.title}" (Dashboard).`,
          type: 'info',
          link: `/lodge/${lodge.id}`
        });
      } catch (e) { console.error(e); }
    }
    await new Promise(r => setTimeout(r, 600));
    window.open(`https://wa.me/234${lodge.profiles?.phone_number?.substring(1)}?text=Hello, I am interested in ${lodge.title}`);
    setTimeout(() => setLoadingMsgId(null), 2000);
  };

  if (role === 'landlord') {
    const landlordLodges = lodges.filter(l => l.landlord_id === user.id);
    const totalViews = landlordLodges.reduce((acc, curr) => acc + (curr.views || 0), 0);

    return (
      <div className="px-4 py-6">
          <AdminLink role={role} />
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lodge Activity</h1>
            <p className="text-sm text-gray-500">Manage your listings</p>
          </div>
          <Link href="/profile" className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center border-2 border-white shadow-sm active:scale-90 transition-transform overflow-hidden">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name || 'User'} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-blue-600">{(user.name || 'L')[0]}</span>
            )}
          </Link>
        </header>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
              <Eye size={20} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalViews.toLocaleString()}</div>
            <div className="text-xs text-gray-500 font-medium">Total Views</div>
          </div>
          <Link href="/profile/notifications" className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm active:scale-95 transition-transform block">
            <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-3">
              <Users size={20} />
            </div>
            <div className="text-2xl font-bold text-gray-900">Activity</div>
            <div className="text-xs text-gray-500 font-medium">Check Notifications</div>
          </Link>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Your Listings</h2>
          <Link href="/post" className="text-blue-600 flex items-center gap-1 text-sm font-bold">
            <PlusCircle size={18} /> Add New
          </Link>
        </div>

        {landlordLodges.length > 0 ? (
          <div className="space-y-4">
            {landlordLodges.map((lodge) => (
              <div key={lodge.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex gap-4 mb-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
                    <img src={lodge.image_urls[0]} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-gray-900 truncate pr-2">{lodge.title}</div>
                      <button 
                        onClick={(e) => handleDelete(e, lodge.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="text-sm text-blue-600 font-black mb-1">
                      {lodge.units && lodge.units.length > 0 ? (
                        (() => {
                          const prices = lodge.units.map(u => u.price);
                          const min = Math.min(...prices);
                          const max = Math.max(...prices);
                          return min === max 
                            ? `₦${min.toLocaleString()}`
                            : `From ₦${min.toLocaleString()}`;
                        })()
                      ) : (
                        `₦${lodge.price.toLocaleString()}`
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        lodge.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {lodge.status === 'available' ? 'Visible' : 'Offline'}
                      </span>
                      <div className="flex items-center gap-1 text-gray-400">
                        <Eye size={12} />
                        <span className="text-[10px] font-bold">{lodge.views?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Unit Inventory Management */}
                {lodge.units && lodge.units.length > 0 && (
                  <div className="bg-gray-50 rounded-2xl p-3 mb-4 space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Unit Inventory</h4>
                      <span className="text-[10px] font-bold text-gray-400">Available / Total</span>
                    </div>
                    {lodge.units.map((unit) => (
                      <div key={unit.id} className="flex justify-between items-center bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                        <div>
                          <p className="text-xs font-bold text-gray-700">{unit.name}</p>
                          <p className="text-[10px] text-blue-600 font-bold">₦{unit.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => updateUnitAvailability(unit.id, Math.max(0, unit.available_units - 1))}
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 active:bg-red-100 active:text-red-600"
                          >
                            -
                          </button>
                          <div className="text-center min-w-[40px]">
                            <span className={`text-xs font-black ${unit.available_units === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                              {unit.available_units}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold"> / {unit.total_units}</span>
                          </div>
                          <button 
                            onClick={() => updateUnitAvailability(unit.id, Math.min(unit.total_units, unit.available_units + 1))}
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-lg text-gray-600 active:bg-green-100 active:text-green-600"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 border-t border-gray-50 pt-4">
                  <Link 
                    href={`/edit-lodge/${lodge.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-700 rounded-xl text-sm font-bold active:scale-95 transition-transform"
                  >
                    <Edit3 size={16} /> Edit
                  </Link>
                  <button 
                    onClick={() => updateLodgeStatus(lodge.id, lodge.status === 'available' ? 'taken' : 'available')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all ${
                      lodge.status === 'available' 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                        : 'bg-green-600 text-white shadow-lg shadow-green-100 hover:bg-green-700'
                    }`}
                  >
                    {lodge.status === 'available' ? (
                      <><X size={16} /> Set Offline</>
                    ) : (
                      <><CheckCircle size={16} /> Set Online</>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <p className="text-gray-500 mb-4">You haven't posted any lodges yet.</p>
            <Link href="/post" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm">Post your first Lodge</Link>
          </div>
        )}
      </div>
    );
  }

  // Student/General View
  return (
    <div className="px-4 py-6">
        <AdminLink role={role} />
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Find your Lodge</h1>
          <p className="text-sm text-gray-500">Awka, Anambra State</p>
        </div>
        <Link href="/profile" className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center border-2 border-white shadow-sm active:scale-90 transition-transform overflow-hidden">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name || 'User'} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-gray-600">{(user.name || 'S')[0]}</span>
          )}
        </Link>
      </header>

      <div className="mb-6">
        <Link href="/search" className="block relative">
          <input
            type="text"
            placeholder="Search Ifite, Amansea..."
            readOnly
            className="w-full p-4 pl-12 bg-white border border-gray-100 rounded-2xl shadow-sm focus:outline-none pointer-events-none"
          />
          <MapPin className="absolute left-4 top-4 text-gray-400" size={20} />
          <div className="absolute right-4 top-4 text-blue-600 font-bold text-xs uppercase tracking-wider">Search</div>
        </Link>
      </div>

      <div className="space-y-6">
        {lodges.map((lodge) => {
          const isFavorite = favorites.includes(lodge.id);
          const isVerified = lodge.profiles?.is_verified === true;
          const hasPhone = !!lodge.profiles?.phone_number;
          
          return (
            <div key={lodge.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 relative group">
              <Link href={`/lodge/${lodge.id}`}>
                <div className="relative h-56 w-full bg-gray-100">
                  <img 
                    src={lodge.image_urls[0]} 
                    alt={lodge.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-active:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-4 left-4 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <div className="px-3 py-1 bg-blue-600/90 backdrop-blur text-white text-[10px] font-bold rounded-lg uppercase tracking-wider">
                        {lodge.location}
                      </div>
                      {isVerified && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-500/90 backdrop-blur text-white text-[10px] font-bold rounded-lg uppercase tracking-wider shadow-sm">
                          <CheckCircle size={12} /> Verified
                        </div>
                      )}
                    </div>
                    
                    {/* Low Occupancy Alert */}
                    {(() => {
                      const totalAvailable = lodge.units?.reduce((acc, u) => acc + u.available_units, 0) || 0;
                      if (totalAvailable > 0 && totalAvailable <= 2) {
                        return (
                          <div className="px-3 py-1 bg-red-600/90 backdrop-blur text-white text-[10px] font-black rounded-lg uppercase tracking-wider animate-pulse">
                            Only {totalAvailable} room{totalAvailable > 1 ? 's' : ''} left!
                          </div>
                        );
                      }
                      if (totalAvailable === 0 && lodge.units && lodge.units.length > 0) {
                        return (
                          <div className="px-3 py-1 bg-gray-900/90 backdrop-blur text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                            Fully Booked
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </Link>
              
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  toggleFavorite(lodge.id);
                }}
                className={`absolute top-4 right-4 p-2 rounded-full shadow-lg active:scale-75 transition-all ${
                  isFavorite ? 'bg-red-500 text-white' : 'bg-white/80 backdrop-blur-md text-gray-900'
                }`}
              >
                <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
              </button>
              
              <div className="p-5">
                <Link href={`/lodge/${lodge.id}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-gray-900 leading-tight">{lodge.title}</h3>
                    <div className="text-right">
                      <div className="text-blue-600 font-black text-sm">
                        {lodge.units && lodge.units.length > 0 ? (
                          (() => {
                            const prices = lodge.units.map(u => u.price);
                            const min = Math.min(...prices);
                            const max = Math.max(...prices);
                            return min === max 
                              ? `₦${min.toLocaleString()}`
                              : `From ₦${min.toLocaleString()}`;
                          })()
                        ) : (
                          `₦${lodge.price.toLocaleString()}`
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{lodge.description}</p>
                </Link>
                
                {/* Room Type Badges */}
                {lodge.units && lodge.units.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {Array.from(new Set(lodge.units.map(u => u.name))).slice(0, 3).map(name => (
                      <span key={name} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[9px] font-black uppercase tracking-tighter rounded-md border border-gray-200/50">
                        {name}
                      </span>
                    ))}
                    {new Set(lodge.units.map(u => u.name)).size > 3 && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-tighter rounded-md border border-blue-100">
                        +{new Set(lodge.units.map(u => u.name)).size - 3} More
                      </span>
                    )}
                  </div>
                )}
                
                {hasPhone ? (
                  <div className="flex gap-2">
                    <button 
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium active:scale-95 transition-all ${
                        loadingCallId === lodge.id ? 'bg-gray-100 text-gray-600' : 'bg-gray-900 text-white shadow-lg shadow-gray-200'
                      }`}
                      disabled={loadingCallId === lodge.id}
                      onClick={() => handleCall(lodge)}
                    >
                      {loadingCallId === lodge.id ? (
                        <><Loader2 className="animate-spin" size={18} /> Connecting...</>
                      ) : (
                        <><Phone size={18} /> Call</>
                      )}
                    </button>
                    <button 
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium active:scale-95 transition-all ${
                        loadingMsgId === lodge.id ? 'bg-green-100 text-green-600' : 'bg-green-600 text-white shadow-lg shadow-green-100'
                      }`}
                      disabled={loadingMsgId === lodge.id}
                      onClick={() => handleWhatsApp(lodge)}
                    >
                      {loadingMsgId === lodge.id ? (
                        <><Loader2 className="animate-spin" size={18} /> Opening...</>
                      ) : (
                        <><MessageCircle size={18} /> WhatsApp</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="py-2 px-4 bg-gray-50 rounded-xl text-center text-xs text-gray-400 font-medium italic">
                    Contact details not provided
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {lodges.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-300">
              <MapPin size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No lodges available</h3>
            <p className="text-gray-500 text-sm max-w-[200px] mt-2">We couldn't find any lodges at the moment. Please check back later.</p>
          </div>
        )}
      </div>
    </div>
  );
}
