"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, Lock, Clock, MapPin, Search } from "lucide-react";

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "admin123") {
      setIsAuthenticated(true);
      fetchTickets();
    } else {
      alert("Invalid admin password");
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tickets", {
        headers: { "Authorization": "Bearer haryana_admin_2024" }
      });
      const data = await res.json();
      if (data.tickets) {
        setTickets(data.tickets);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { 
          "Authorization": "Bearer haryana_admin_2024",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (res.ok) {
        fetchTickets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-sm w-full">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-center text-gray-900 mb-6">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password (admin123)"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button className="w-full p-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            <h1 className="text-xl font-bold tracking-tight">Executive Dashboard</h1>
          </div>
          <div className="text-sm bg-slate-800 px-3 py-1.5 rounded-md font-medium">
            Total Tickets: {tickets.length}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">ID / Date</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Escalation</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">#{ticket.id}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{ticket.road_id}</div>
                      <a 
                        href={`https://www.google.com/maps?q=${ticket.latitude},${ticket.longitude}`} 
                        target="_blank" rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        <MapPin className="w-3 h-3" />
                        View Map
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        ticket.escalation_level === 'L3' ? 'bg-red-100 text-red-700' :
                        ticket.escalation_level === 'L2' ? 'bg-orange-100 text-orange-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {ticket.escalation_level}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1.5 font-medium text-xs ${
                        ticket.status === 'open' ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {ticket.status === 'open' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        {ticket.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {ticket.status === 'open' ? (
                        <button 
                          onClick={() => updateStatus(ticket.id, 'resolved')}
                          className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded transition-colors"
                        >
                          Mark Resolved
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">No Actions</span>
                      )}
                    </td>
                  </tr>
                ))}
                
                {tickets.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-gray-300 mb-3" />
                      No complaints found in the system.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
