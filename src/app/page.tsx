"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Copy, MapPin, Navigation, User, Phone, Mail, AlertTriangle, CheckCircle2, Search, Camera, FileText } from "lucide-react";

// Dynamically import Map to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import("./components/Map"), { ssr: false });

export default function Home() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Mobile Tab State
  const [activeMobileTab, setActiveMobileTab] = useState<'search' | 'gps' | 'none'>('search');

  // New Geocoding State
  const [addressSearch, setAddressSearch] = useState("");
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (addressSearch.length > 2) {
        try {
          const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(addressSearch)}&bbox=74.45,27.65,77.55,30.9&limit=5`);
          const data = await res.json();
          if (data && data.features) {
            setAddressSuggestions(data.features);
            setShowSuggestions(true);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [addressSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // New Ticketing State
  const [showReportForm, setShowReportForm] = useState(false);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(false);

  const handleAddressSearch = async () => {
    if (!addressSearch) return;
    setSearchingAddress(true);
    setError(null);
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(addressSearch)}&bbox=74.45,27.65,77.55,30.9&limit=1`);
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const foundLat = parseFloat(data.features[0].geometry.coordinates[1]).toFixed(6);
        const foundLng = parseFloat(data.features[0].geometry.coordinates[0]).toFixed(6);
        setLat(foundLat);
        setLng(foundLng);
        handleResolveForCoords(foundLat, foundLng);
      } else {
        setError("Could not find that address in Haryana.");
      }
    } catch (err) {
      setError("Failed to search address.");
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleResolveForCoords = async (latitude: string, longitude: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setTicketSuccess(false);

    try {
      const res = await fetch("/api/resolve-road", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: parseFloat(latitude), longitude: parseFloat(longitude) }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.status === "OUTSIDE_HARYANA") throw new Error("Location is outside Haryana borders.");
        if (data.status === "ROAD_NOT_FOUND") throw new Error("No road found within 100 meters of this location.");
        throw new Error(data.error || data.message || "Failed to resolve road.");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = () => handleResolveForCoords(lat, lng);

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!result || !lat || !lng) return;
    
    setSubmittingTicket(true);
    try {
      const formData = new FormData();
      formData.append("latitude", lat);
      formData.append("longitude", lng);
      formData.append("description", description);
      formData.append("road_id", result.road.road_id || "UNKNOWN");
      if (photo) {
        formData.append("photo", photo);
      }

      const res = await fetch("/api/tickets", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit ticket");
      
      setTicketSuccess(true);
      setShowReportForm(false);
      
      // Phase 2: Generate Email to Officer
      const officerEmail = result.officers?.L1?.email;
      if (officerEmail) {
        const ticketId = data.ticket?.id || "N/A";
        const roadName = result.road?.name || result.road?.road_name || "Unnamed Road";
        const photoLink = data.ticket?.photo_url ? `\\n\\nPhoto Evidence: ${data.ticket.photo_url}` : "";
        
        const subject = encodeURIComponent(`URGENT: Road Issue Reported on ${roadName} (Ticket #${ticketId})`);
        const body = encodeURIComponent(
          `Dear ${result.officers.L1.name},\\n\\n` +
          `A citizen has reported a road issue on ${roadName} (Road ID: ${result.road.road_id || "Unknown"}).\\n\\n` +
          `Location Coordinates: ${lat}, ${lng}\\n` +
          `Google Maps: https://www.google.com/maps?q=${lat},${lng}\\n\\n` +
          `Citizen Description:\\n"${description}"` +
          photoLink +
          `\\n\\nPlease investigate this issue at your earliest convenience.\\n\\nThank you,\\nHaryana Road Resolver`
        );
        
        window.location.href = `mailto:${officerEmail}?subject=${subject}&body=${body}`;
      }

      setDescription("");
      setPhoto(null);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmittingTicket(false);
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

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-3 gap-6 pb-24 md:pb-8">
        
        {/* Left Column: Map & Inputs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Geocoding Search Bar */}
          <div className={`${activeMobileTab === 'search' ? 'flex' : 'hidden'} md:flex bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-col sm:flex-row gap-3 sm:gap-4`} ref={searchRef}>
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
              <input 
                type="text" 
                value={addressSearch}
                onChange={(e) => {
                  setAddressSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                className="w-full pl-10 p-2 bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Search for an address (e.g. Sector 14, Kurukshetra)"
              />
              
              {/* Autocomplete Dropdown */}
              {showSuggestions && addressSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
                  {addressSuggestions.map((suggestion: any, index: number) => {
                    const name = suggestion.properties.name;
                    const details = [suggestion.properties.street, suggestion.properties.city, suggestion.properties.county, suggestion.properties.state].filter(Boolean).join(", ");
                    return (
                      <button
                        key={index}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b last:border-b-0 border-gray-100"
                        onClick={() => {
                          const foundLat = parseFloat(suggestion.geometry.coordinates[1]).toFixed(6);
                          const foundLng = parseFloat(suggestion.geometry.coordinates[0]).toFixed(6);
                          setAddressSearch(name);
                          setShowSuggestions(false);
                          setLat(foundLat);
                          setLng(foundLng);
                          handleResolveForCoords(foundLat, foundLng);
                        }}
                      >
                        <div className="font-medium text-gray-900">{name}</div>
                        <div className="text-xs text-gray-500 truncate">{details}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button 
              onClick={handleAddressSearch}
              disabled={searchingAddress || !addressSearch}
              className="w-full sm:w-auto px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {searchingAddress ? "Searching..." : "Search"}
            </button>
          </div>

          {/* GPS Coordinate Inputs */}
          <div className={`${activeMobileTab === 'gps' ? 'flex' : 'hidden'} md:flex bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-col sm:flex-row gap-3 sm:gap-4`}>
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
                disabled={loading || (!lat && !lng)}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 h-10 flex items-center justify-center"
              >
                {loading ? "Resolving..." : "Resolve"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-[350px] sm:h-[400px] lg:h-[500px] overflow-hidden relative">
            <MapComponent 
              position={lat && lng ? [parseFloat(lat), parseFloat(lng)] : null} 
              onLocationSelect={(lat: number, lng: number) => {
                const newLat = lat.toFixed(6);
                const newLng = lng.toFixed(6);
                setLat(newLat);
                setLng(newLng);
                handleResolveForCoords(newLat, newLng);
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
          
          {ticketSuccess && (
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-lg flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-sm text-emerald-800 font-bold">Issue Reported Successfully!</p>
                <p className="text-xs text-emerald-700 mt-1">Your ticket has been logged and assigned to the local officer.</p>
              </div>
            </div>
          )}

          {!result && !error && !loading && (
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center h-full flex flex-col items-center justify-center text-gray-400">
              <MapPin className="w-12 h-12 mb-4 opacity-20" />
              <p>Enter an address or drop a pin to identify the road and authority.</p>
            </div>
          )}

          {result && (
            <>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 mb-3 gap-3 sm:gap-0">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-600" /> 
                    Road Information
                  </h3>
                  <button 
                    onClick={() => setShowReportForm(!showReportForm)}
                    className="w-full sm:w-auto text-xs font-bold px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors border border-red-200"
                  >
                    Report Issue
                  </button>
                </div>

                {showReportForm ? (
                  <form onSubmit={handleReportIssue} className="space-y-4 mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-2 mb-1">
                        <FileText className="w-3 h-3" /> Issue Description
                      </label>
                      <textarea 
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full text-sm p-2 border border-gray-300 rounded-md focus:ring-blue-500 outline-none h-20"
                        placeholder="Describe the pothole, damaged road, etc."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-2 mb-1">
                        <Camera className="w-3 h-3" /> Upload Photo (Optional)
                      </label>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                        className="w-full text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => setShowReportForm(false)}
                        className="flex-1 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 rounded-md"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={submittingTicket || !description}
                        className="flex-1 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                      >
                        {submittingTicket ? "Submitting..." : "Submit Ticket"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-500 block text-xs">Road Name</span>
                      <span className="font-medium text-gray-900">{result.road.name || result.road.road_name || "Unnamed Road"}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      <div>
                        <span className="text-gray-500 block text-xs">Road ID</span>
                        <span className="font-medium">{result.road.road_id}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs">Category</span>
                        <span className="font-medium">{result.road.category || result.road.road_category}</span>
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
                )}
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" /> 
                  Officer Escalation Hierarchy
                </h3>
                
                <div className="relative border-l-2 border-gray-200 ml-3 space-y-6 pb-2">
                  {['L1', 'L2', 'L3', 'L4'].map((level) => {
                    const officer = result.officers?.[level];
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

              {result.debug && (
                <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono">
                  <div className="flex items-center gap-2 mb-2 text-slate-400 border-b border-slate-700 pb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>System Diagnostics</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <span>Match Distance:</span>
                    <span className="text-white text-right">{result.debug.match_distance_meters}m</span>
                    <span>Spatial Query:</span>
                    <span className="text-white text-right">{result.debug.road_lookup_ms || 5}ms</span>
                    <span>Officer Query:</span>
                    <span className="text-white text-right">{result.debug.officer_lookup_ms || 3}ms</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-[2000] pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setActiveMobileTab(activeMobileTab === 'search' ? 'none' : 'search')}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeMobileTab === 'search' ? 'text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Search className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">Search</span>
        </button>
        <button 
          onClick={() => setActiveMobileTab(activeMobileTab === 'gps' ? 'none' : 'gps')}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeMobileTab === 'gps' ? 'text-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <MapPin className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">GPS</span>
        </button>
      </div>
    </div>
  );
}