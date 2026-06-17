"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Copy, MapPin, Navigation, User, Phone, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";

// Dynamically import Map to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import("./components/Map"), { ssr: false });

export default function Home() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async () => {
    if (!lat || !lng) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/resolve-road", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: parseFloat(lat), longitude: parseFloat(lng) }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.status === "OUTSIDE_HARYANA") throw new Error("Location is outside Haryana borders.");
        if (data.status === "ROAD_NOT_FOUND") throw new Error("No road found within 100 meters of this location.");
        throw new Error(data.message || "Failed to resolve road.");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-blue-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Navigation className="w-6 h-6 text-blue-200" />
          <h1 className="text-xl font-bold tracking-tight">Haryana Road Authority Resolver</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Map & Input */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Latitude</label>
              <input 
                type="number" 
                value={lat} 
                onChange={(e) => setLat(e.target.value)}
                className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="29.900804"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Longitude</label>
              <input 
                type="number" 
                value={lng} 
                onChange={(e) => setLng(e.target.value)}
                className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="76.673315"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleResolve}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 h-10 flex items-center justify-center"
              >
                {loading ? "Resolving..." : "Resolve"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-[500px] overflow-hidden relative">
            <MapComponent 
              position={lat && lng ? [parseFloat(lat), parseFloat(lng)] : null} 
              onLocationSelect={(lat: number, lng: number) => {
                setLat(lat.toFixed(6));
                setLng(lng.toFixed(6));
              }}
            />
            <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border border-gray-200 text-gray-600">
              Click map to select location
            </div>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          )}

          {!result && !error && !loading && (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center h-full flex flex-col items-center justify-center text-gray-400">
              <MapPin className="w-12 h-12 mb-4 opacity-20" />
              <p>Enter coordinates or click the map to identify the road and authority.</p>
            </div>
          )}

          {result && (
            <>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-3 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-600" /> 
                  Road Information
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-500 block text-xs">Road Name</span>
                    <span className="font-medium text-gray-900">{result.road.road_name || "Unnamed Road"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-gray-500 block text-xs">Road ID</span>
                      <span className="font-medium">{result.road.road_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-xs">Category</span>
                      <span className="font-medium">{result.road.road_category}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-100 mt-2">
                    <span className="text-gray-500 block text-xs mb-1">Authority Details</span>
                    <span className="font-semibold text-gray-800 block">{result.authority.department}</span>
                    <span className="text-gray-600 block">{result.authority.district} District</span>
                    {(result.authority.division || result.authority.circle) && (
                      <span className="text-gray-500 text-xs block mt-1">
                        {result.authority.circle && `Circle: ${result.authority.circle} | `} 
                        Division: {result.authority.division}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" /> 
                  Officer Escalation Hierarchy
                </h3>
                
                <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-2">
                  {['L1', 'L2', 'L3', 'L4'].map((level, idx) => {
                    const officer = result.officers[level];
                    if (!officer) return null;

                    return (
                      <div key={level} className="relative pl-6">
                        <div className="absolute w-6 h-6 bg-white border-2 border-emerald-500 rounded-full -left-[13px] top-0 flex items-center justify-center z-10">
                          <span className="text-[10px] font-bold text-emerald-600">{level}</span>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <p className="font-bold text-gray-900">{officer.name}</p>
                              <p className="text-xs text-blue-600 font-medium">{officer.designation}</p>
                            </div>
                          </div>
                          
                          <div className="mt-3 flex flex-wrap gap-2">
                            {officer.phone && (
                              <button onClick={() => copyToClipboard(officer.phone)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded text-xs text-gray-600 transition-colors">
                                <Phone className="w-3 h-3 text-blue-500" />
                                <span className="text-gray-400 mr-1">Office:</span>
                                <span>{officer.phone}</span>
                                <Copy className="w-3 h-3 opacity-50 ml-1" />
                              </button>
                            )}
                            {officer.mobile && (
                              <button onClick={() => copyToClipboard(officer.mobile)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded text-xs text-gray-600 transition-colors">
                                <Phone className="w-3 h-3 text-emerald-500" />
                                <span className="text-gray-400 mr-1">Mobile:</span>
                                <span>{officer.mobile}</span>
                                <Copy className="w-3 h-3 opacity-50 ml-1" />
                              </button>
                            )}
                            {officer.email && (
                              <button onClick={() => copyToClipboard(officer.email)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded text-xs text-gray-600 transition-colors">
                                <Mail className="w-3 h-3" />
                                <span>Email</span>
                                <Copy className="w-3 h-3 opacity-50 ml-1" />
                              </button>
                            )}
                          </div>
                          
                          {(officer.circle || officer.division) && (
                            <div className="mt-2 pt-2 border-t border-gray-100 flex gap-4 text-[10px] text-gray-400 uppercase tracking-tighter">
                              {officer.circle && <span>Circle: {officer.circle}</span>}
                              {officer.division && <span>Division: {officer.division}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono">
                <div className="flex items-center gap-2 mb-2 text-slate-400 border-b border-slate-700 pb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>System Diagnostics</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <span>Match Distance:</span>
                  <span className="text-white text-right">{result.debug.match_distance_meters}m</span>
                  <span>Spatial Query:</span>
                  <span className="text-white text-right">{result.debug.road_lookup_ms}ms</span>
                  <span>Officer Query:</span>
                  <span className="text-white text-right">{result.debug.officer_lookup_ms}ms</span>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}