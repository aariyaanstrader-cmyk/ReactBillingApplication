import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import RateHeader from '../components/RateHeader';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [taxConfig, setTaxConfig] = useState(null);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('tax');
  const [msg, setMsg] = useState({ text: '', ok: false });
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'salesperson' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [creating, setCreating] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    api.get('/taxes/active').then(r => setTaxConfig(r.data.config)).catch(() => {});
    if (user?.role === 'admin') {
      api.get('/auth/users').then(r => setUsers(r.data.users)).catch(() => {});
    }
  }, []);

  const showMsg = (text, ok = false) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg({ text: '', ok: false }), 4000);
  };

  const createUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/auth/users', newUser);
      showMsg('User created successfully!', true);
      setNewUser({ name: '', username: '', password: '', role: 'salesperson' });
      api.get('/auth/users').then(r => setUsers(r.data.users));
    } catch (err) {
      showMsg(err.response?.data?.message || 'Failed to create user');
    } finally { setCreating(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setChangingPw(true);
    try {
      await api.post('/auth/change-password', pwForm);
      showMsg('Password changed successfully!', true);
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      showMsg(err.response?.data?.message || 'Failed to change password');
    } finally { setChangingPw(false); }
  };

  const tabs = [
    { id: 'tax', label: 'Tax Config' },
    ...(user?.role === 'admin' ? [{ id: 'users', label: 'Users' }] : []),
    { id: 'password', label: 'Change Password' },
  ];

  const inputClass = 'w-full bg-[#faf7f2] border border-[#d4c5b0] rounded-xl px-3 py-2.5 text-sm text-[#3d2b1f] placeholder-[#b0a090] focus:outline-none focus:ring-2 focus:ring-[#8b6914]/30';

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <Navbar />
      <RateHeader />
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <h2 className="text-lg sm:text-xl font-semibold text-[#3d2b1f] mb-4 sm:mb-5">Settings</h2>

        {msg.text && (
          <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 border ${
            msg.ok
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}>{msg.text}</div>
        )}

        <div className="bg-white border border-[#e0d5c5] rounded-xl shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex bg-[#faf7f2] border-b border-[#e0d5c5] px-4 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-[#8b6914] text-[#8b6914]'
                    : 'border-transparent text-[#7a6652] hover:text-[#3d2b1f]'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6">

            {/* Tax Config tab */}
            {tab === 'tax' && (
              <div>
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h3 className="text-sm font-semibold text-[#3d2b1f]">Active Tax Configuration</h3>
                  {taxConfig && (
                    <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-medium shrink-0">
                      FY {taxConfig.fy}
                    </span>
                  )}
                </div>
                {taxConfig ? (
                  <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="border-b border-[#e8dfd4]">
                          <th className="text-left py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wide">Name</th>
                          <th className="text-right py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wide">Rate</th>
                          <th className="text-left py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wide pl-4">Apply On</th>
                          <th className="text-center py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wide">Default</th>
                          <th className="text-center py-2 text-[10px] font-bold text-[#7a6652] uppercase tracking-wide">Optional</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e8dfd4]">
                        {taxConfig.taxes.map((t, i) => (
                          <tr key={i} className="hover:bg-[#faf7f2] transition-colors">
                            <td className="py-2.5 font-medium text-[#3d2b1f]">{t.name}</td>
                            <td className="py-2.5 text-right text-[#7a6652]">{t.rate}%</td>
                            <td className="py-2.5 text-[#7a6652] text-xs pl-4">{t.applyOn}</td>
                            <td className="py-2.5 text-center">
                              {t.isDefault
                                ? <span className="w-5 h-5 bg-emerald-50 text-emerald-700 rounded-full inline-flex items-center justify-center text-xs">✓</span>
                                : <span className="text-[#d4c5b0]">—</span>}
                            </td>
                            <td className="py-2.5 text-center">
                              {t.isOptional
                                ? <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full inline-flex items-center justify-center text-xs">✓</span>
                                : <span className="text-[#d4c5b0]">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-[#7a6652] text-sm">No active tax configuration found.</p>
                    <p className="text-[#b0a090] text-xs mt-1">Contact your system administrator.</p>
                  </div>
                )}
              </div>
            )}

            {/* Users tab */}
            {tab === 'users' && user?.role === 'admin' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-[#3d2b1f] mb-3">Users</h3>
                  <div className="space-y-2">
                    {users.map(u => (
                      <div key={u._id}
                        className="flex items-center justify-between gap-2 bg-[#faf7f2] border border-[#e0d5c5] rounded-xl px-3 sm:px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#3d2b1f] truncate">{u.name}</p>
                          <p className="text-xs text-[#7a6652] truncate">{u.username} · <span className="capitalize">{u.role}</span></p>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${
                          u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#3d2b1f] mb-3">Create New User</h3>
                  <form onSubmit={createUser} className="space-y-3">
                    <input required placeholder="Full Name" value={newUser.name}
                      onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                      className={inputClass} />
                    <input required placeholder="Username" value={newUser.username}
                      onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                      className={inputClass} />
                    <input required type="password" placeholder="Password" value={newUser.password}
                      onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                      className={inputClass} />
                    <select value={newUser.role}
                      onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                      className={inputClass}>
                      <option value="salesperson">Salesperson</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="submit" disabled={creating}
                      className="w-full bg-[#8b6914] hover:bg-[#a07a1a] text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                      {creating ? 'Creating…' : 'Create User'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Change Password tab */}
            {tab === 'password' && (
              <div className="w-full sm:max-w-sm">
                <h3 className="text-sm font-semibold text-[#3d2b1f] mb-4">Change Your Password</h3>
                <form onSubmit={changePassword} className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#7a6652] font-semibold mb-1">Current Password</label>
                    <input required type="password" value={pwForm.currentPassword}
                      onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-[#7a6652] font-semibold mb-1">New Password</label>
                    <input required type="password" value={pwForm.newPassword}
                      onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      className={inputClass} />
                  </div>
                  <button type="submit" disabled={changingPw}
                    className="w-full bg-[#8b6914] hover:bg-[#a07a1a] text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 mt-1">
                    {changingPw ? 'Changing…' : 'Change Password'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
