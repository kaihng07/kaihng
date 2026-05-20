import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit3, Trash2, ExternalLink, Copy, Check, Search, Building, Phone, 
  Mail, Globe, MapPin, User, X, Image, AlertCircle, Loader2, RefreshCw, QrCode, Clipboard
} from 'lucide-react';
import { Contact, SystemConfig } from '../types';
import Sidebar from './Sidebar';
import { QRCodeSVG } from 'qrcode.react';

interface DashboardProps {
  config: SystemConfig | null;
  loadingConfig: boolean;
  onRefreshConfig: () => void;
}

export default function Dashboard({ config, loadingConfig, onRefreshConfig }: DashboardProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState('contacts');

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active QR Code state
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);

  // Form State
  const initialFormState = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    title: '',
    organization: '',
    website: '',
    address: '',
    avatar: '',
    socials: {
      linkedin: '',
      twitter: '',
      github: '',
      instagram: ''
    }
  };
  const [form, setForm] = useState(initialFormState);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/contacts');
      if (!res.ok) {
        let msg = '';
        try {
          msg = await res.text();
        } catch(e) {}
        throw new Error(`Failed to retrieve contacts (${res.status}): ${msg}`);
      }
      const data = await res.json();
      setContacts(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Could not synchronize with Server. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualRetry = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/config?reconnect=true');
    } catch (e) {
      console.warn("Pre-reconnect hand-shake failed", e);
    }
    await fetchContacts();
  };

  // Delete Action
  const handleDelete = async (id: string) => {
    if (!id) return;
    if (!confirm("Are you sure you want to permanently delete this digital business card?")) return;

    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        throw new Error("Could not delete contact from system");
      }
      setContacts(contacts.filter(c => c._id !== id));
      if (activeQrUrl?.includes(id)) {
        setActiveQrUrl(null);
      }
    } catch (err: any) {
      alert("Error deleting contact: " + err.message);
    }
  };

  // Open Edit Modal Form
  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || '',
      phone: contact.phone || '',
      title: contact.title || '',
      organization: contact.organization || '',
      website: contact.website || '',
      address: contact.address || '',
      avatar: contact.avatar || '',
      socials: {
        linkedin: contact.socials?.linkedin || '',
        twitter: contact.socials?.twitter || '',
        github: contact.socials?.github || '',
        instagram: contact.socials?.instagram || ''
      }
    });
    setFormError(null);
    setIsOpen(true);
  };

  // Open Create Modal Form
  const openCreateModal = () => {
    setEditingContact(null);
    setForm(initialFormState);
    setFormError(null);
    setIsOpen(true);
  };

  // Base64 file reader validation
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject larger than 1.5MB to stay below limits
    if (file.size > 1.5 * 1024 * 1024) {
      setFormError("The selected thumbnail is too large. Choose an image under 1.5 Megabytes.");
      return;
    }

    setFormError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, avatar: reader.result as string }));
    };
    reader.onerror = () => {
      setFormError("Failed to convert image schema.");
    };
    reader.readAsDataURL(file);
  };

  // Handle Form Submission Save / Update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName) {
      setFormError("Please enter both First Name and Last Name.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const targetUrl = editingContact?._id 
      ? `/api/contacts/${editingContact._id}`
      : '/api/contacts';
    const method = editingContact?._id ? 'PUT' : 'POST';

    try {
      const res = await fetch(targetUrl, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${res.status}`);
      }

      await fetchContacts(); // reload recent state
      setIsOpen(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || "An unexpected error occurred while saving the card.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Clipboard Copy
  const copyExternalLink = (id: string) => {
    const cardUrl = `${window.location.origin}/card/${id}`;
    navigator.clipboard.writeText(cardUrl).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Search filter
  const filteredContacts = contacts.filter(c => {
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    const matchesName = fullName.includes(searchQuery.toLowerCase());
    const matchesOrg = (c.organization || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTitle = (c.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesName || matchesOrg || matchesTitle;
  });

  // Calculate initials helper
  const getInitials = (contact: Contact) => {
    const f = contact.firstName ? contact.firstName[0] : '';
    const l = contact.lastName ? contact.lastName[0] : '';
    return (f + l).toUpperCase();
  };

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden relative">
      {/* Immersive Frosted Ambient Glow Shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none z-0" />
      <div className="absolute top-[40%] right-[10%] w-[400px] h-[400px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none z-0" />

      {/* Dynamic Sidebar Nav */}
      <Sidebar 
        config={config} 
        loadingConfig={loadingConfig} 
        onRefreshConfig={onRefreshConfig} 
        activeView={activeView}
        setActiveView={setActiveView}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        
        {/* Top bar header */}
        <header className="h-16 border-b border-white/5 bg-slate-900/30 backdrop-blur-md px-8 flex items-center justify-between select-none shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-200 animate-slide-up">Card Registry Dashboard</h2>
            <span className="text-[10px] text-slate-300 bg-white/5 font-mono py-1 px-2.5 rounded-full border border-white/5">
              {contacts.length} cards total
            </span>
          </div>
          
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-650/15 duration-200 transition-all outline-none border border-white/10 cursor-pointer"
            id="create-card-btn"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Create Digital Card</span>
          </button>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-8 relative z-10">
          
          {error ? (
            <div className="max-w-2xl mx-auto mt-12 border border-rose-500/20 bg-rose-950/10 backdrop-blur-md rounded-2xl p-6 text-center shadow-lg animate-fade-in" id="dashboard-error-card">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-rose-400">Connection Sync Interrupted</h3>
              <p className="text-xs text-rose-300 mt-1.5 leading-relaxed">{error}</p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  onClick={handleManualRetry}
                  className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-rose-600/15 cursor-pointer"
                  id="dashboard-retry-btn"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Server Sync</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between xl:w-full select-none">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by name, organization, or job title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all shadow-sm backdrop-blur-md"
                    id="search-input"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400 font-mono text-xs">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                  <span>Syncing card indexes...</span>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="bg-white/5 border border-white/5 rounded-[2rem] p-16 text-center shadow-sm backdrop-blur-md select-none">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-slate-400 mb-4 border border-white/5">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="text-slate-200 font-bold text-base">No Cards Present</h3>
                  <p className="text-slate-400 text-xs mt-1.5 leading-relaxed max-w-sm mx-auto">
                    {searchQuery ? "No matches found for your filter query. Try another keyword!" : "Begin by creating a brand-new high-fidelity digital business card."}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={openCreateModal}
                      className="mt-5 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-lg shadow-indigo-600/15 outline-none border border-white/10 cursor-pointer"
                      id="empty-state-create-btn"
                    >
                      Add New Contact
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 select-none animate-[slideUp_0.3s_ease-out]">
                  {filteredContacts.map(contact => {
                    const localCardUrl = `/card/${contact._id}`;
                    return (
                      <div 
                        key={contact._id} 
                        className="glass-card glass-card-hover rounded-[2rem] p-5 transition duration-300 flex flex-col justify-between group relative"
                        id={`contact-card-${contact._id}`}
                      >
                        <div>
                          {/* Card top details */}
                          <div className="flex items-start gap-4">
                            {contact.avatar ? (
                              <img 
                                src={contact.avatar} 
                                alt={`${contact.firstName}`}
                                className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-inner shrink-0 referrer-policy"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-750 text-white flex items-center justify-center font-bold text-base shadow-inner shrink-0 leading-none">
                                {getInitials(contact)}
                              </div>
                            )}
                            
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-slate-100 leading-snug truncate group-hover:text-indigo-300 transition-colors">
                                {contact.firstName} {contact.lastName}
                              </h3>
                              {contact.title && (
                                <p className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">{contact.title}</p>
                              )}
                              {contact.organization && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1 truncate">
                                  <Building className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>{contact.organization}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Quick details section */}
                          <div className="mt-5 space-y-1.5 border-t border-white/5 pt-4 text-[11px] text-slate-400">
                            {contact.phone && (
                              <div className="flex items-center gap-2 truncate">
                                <Phone className="w-3.5 h-3.5 text-slate-500" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                            {contact.email && (
                              <div className="flex items-center gap-2 truncate">
                                <Mail className="w-3.5 h-3.5 text-slate-500" />
                                <span>{contact.email}</span>
                              </div>
                            )}
                            {contact.website && (
                              <div className="flex items-center gap-2 truncate">
                                <Globe className="w-3.5 h-3.5 text-slate-500" />
                                <span>{contact.website}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interactive operations bar */}
                        <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {/* Copy Hub Link */}
                            <button
                              onClick={() => contact._id && copyExternalLink(contact._id)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-450 hover:text-white transition relative outline-none cursor-pointer"
                              title="Copy portfolio access link"
                              id={`copy-url-${contact._id}`}
                            >
                              {copiedId === contact._id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* View Live vCard */}
                            <a
                              href={localCardUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl bg-white/5 hover:bg-indigo-950/40 border border-white/5 text-slate-450 hover:text-indigo-450 transition"
                              title="Open public digital card page"
                              id={`open-public-${contact._id}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>

                            {/* Toggle Quick Scan QR */}
                            <button
                              onClick={() => {
                                const cardUrl = `${window.location.origin}/card/${contact._id}`;
                                setActiveQrUrl(activeQrUrl === cardUrl ? null : cardUrl);
                              }}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-455 hover:text-white transition outline-none cursor-pointer"
                              title="Instant scan setup"
                              id={`qrcode-scan-${contact._id}`}
                            >
                              <QrCode className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Edit vCard */}
                            <button
                              onClick={() => openEditModal(contact)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition border border-white/5 text-xs font-bold flex items-center gap-1 outline-none cursor-pointer"
                              title="Configure attributes"
                              id={`edit-${contact._id}`}
                            >
                              <Edit3 className="w-3 h-3 text-indigo-450" />
                              <span>Edit</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => contact._id && handleDelete(contact._id)}
                              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-350 border border-rose-500/5 transition outline-none cursor-pointer"
                              title="Revoke completely"
                              id={`delete-${contact._id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Interactive floating inline QR Code display */}
                        {activeQrUrl === `${window.location.origin}/card/${contact._id}` && (
                          <div className="mt-3 p-3 bg-white border border-white/10 rounded-2xl flex flex-col items-center justify-center animate-[fadeIn_0.15s_ease-out]">
                            <QRCodeSVG 
                              value={activeQrUrl} 
                              size={120}
                              level="L"
                              includeMargin={true}
                            />
                            <span className="text-[9px] text-slate-700 font-mono mt-2 truncate max-w-full">
                              Scan QR for {contact.firstName}
                            </span>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Slide overlay Modal Editor */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md select-none overflow-y-auto">
          <div 
            className="bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-auto max-h-[90vh] overflow-hidden flex flex-col animate-[fadeIn_0.21s_ease-out] backdrop-blur-2xl"
            id="vcard-editor-modal"
          >
            
            {/* Modal Title Banner */}
            <div className="h-16 border-b border-white/5 px-8 flex items-center justify-between shrink-0 bg-slate-950/40">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">
                  {editingContact ? 'Edit Card Parameters' : 'Register New Business Card'}
                </h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 transition text-slate-400 hover:text-white outline-none cursor-pointer"
                id="modal-close-icon"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Form Content Screen */}
            <div className="flex-1 overflow-y-auto flex">
              
              {/* Form Input Container Left */}
              <form 
                onSubmit={handleSubmit}
                className="w-full lg:w-3/5 p-8 space-y-6 overflow-y-auto"
                id="modal-card-form"
              >
                
                {formError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl flex items-start gap-2.5 text-xs">
                    <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Section A: Photo / Avatar Upload */}
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Profile Identity ThumbnailImage</label>
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      {form.avatar ? (
                        <img 
                          src={form.avatar} 
                          alt="Avatar form" 
                          className="w-16 h-16 rounded-2xl object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-slate-400 border border-white/5">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                      {form.avatar && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, avatar: '' })}
                          className="absolute -top-1.5 -right-1.5 bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/40 text-rose-300 p-0.5 rounded-full cursor-pointer"
                          title="Purge photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="relative animate-pulse-slow">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarSelect}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          id="avatar-file-input"
                        />
                        <div className="border border-dashed border-white/10 rounded-xl px-4 py-2.5 text-center text-xs text-slate-300 hover:bg-white/5 hover:border-white/20 transition cursor-pointer">
                          <Image className="w-4 h-4 text-slate-450 inline-block mr-1.5" />
                          <span>Upload Thumbnail File (&lt;1.5MB)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section B: Personal Particulars */}
                <div className="space-y-4">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block border-b border-white/5 pb-1.5">
                    Basic Info
                  </span>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">First Name *</label>
                      <input
                        type="text"
                        required
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-first-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-last-name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">Email Address</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-email"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">Phone Number</label>
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-phone"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">Job Title</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-title"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">Organization / Company</label>
                      <input
                        type="text"
                        value={form.organization}
                        onChange={(e) => setForm({ ...form, organization: e.target.value })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-org"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">Address Location</label>
                      <input
                        type="text"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="Street, City, Postcode, Country"
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-address"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">Digital Website Profile URL</label>
                      <input
                        type="text"
                        value={form.website}
                        onChange={(e) => setForm({ ...form, website: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-website"
                      />
                    </div>
                  </div>
                </div>

                {/* Section C: Social handles */}
                <div className="space-y-4">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block border-b border-white/5 pb-1.5">
                    Connections Links (Enter Handles Only)
                  </span>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">LinkedIn Username</label>
                      <input
                        type="text"
                        placeholder="username"
                        value={form.socials.linkedin}
                        onChange={(e) => setForm({
                          ...form,
                          socials: { ...form.socials, linkedin: e.target.value }
                        })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-linkedin"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">Twitter (X) handle</label>
                      <input
                        type="text"
                        placeholder="username"
                        value={form.socials.twitter}
                        onChange={(e) => setForm({
                          ...form,
                          socials: { ...form.socials, twitter: e.target.value }
                        })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-twitter"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">GitHub handle</label>
                      <input
                        type="text"
                        placeholder="username"
                        value={form.socials.github}
                        onChange={(e) => setForm({
                          ...form,
                          socials: { ...form.socials, github: e.target.value }
                        })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-github"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400">Instagram handle</label>
                      <input
                        type="text"
                        placeholder="username"
                        value={form.socials.instagram}
                        onChange={(e) => setForm({
                          ...form,
                          socials: { ...form.socials, instagram: e.target.value }
                        })}
                        className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 duration-150 transition-all font-medium"
                        id="form-instagram"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3.5">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-400 hover:text-slate-100 text-xs font-bold transition outline-none cursor-pointer"
                    id="form-cancel-btn"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-indigo-500/40 disabled:to-indigo-500/30 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-650/15 outline-none border border-white/10 cursor-pointer"
                    id="form-submit-btn"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                    <span>{editingContact ? 'Save Changes' : 'Publish Business Card'}</span>
                  </button>
                </div>

              </form>

              {/* LIVE PREVIEW CONTAINER RIGHT (ONLY desktop view, lg:w-2/5) */}
              <div 
                className="hidden lg:flex lg:w-2/5 bg-slate-950/40 border-l border-white/5 flex-col items-center justify-center p-8 relative overflow-hidden select-none"
                id="live-preview-panel"
              >
                
                {/* Background lighting flare */}
                <div className="absolute top-1/4 -right-1/4 w-[350px] h-[350px] rounded-full bg-indigo-500/15 blur-[120px]" />
                
                <span className="absolute top-6 left-6 text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">
                  Live View Screen
                </span>

                {/* Simulated Digital Card mock container */}
                <div className="w-full max-w-[325px] glass-card rounded-[2rem] p-5 shadow-2xl relative z-10 flex flex-col justify-between aspect-[3/4] border border-white/10 overflow-hidden">
                  
                  {/* Outer design flare */}
                  <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-indigo-500/10 to-transparent rounded-t-[2rem]" />
                  
                  <div className="text-center pt-2 relative z-10">
                    {form.avatar ? (
                      <img 
                        src={form.avatar} 
                        alt="Preview" 
                        className="w-16 h-16 rounded-2xl mx-auto object-cover border border-white/10 shadow-md referrer-policy animate-[fadeIn_0.15s_ease-out]"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-550 to-indigo-750 flex items-center justify-center text-white text-base font-bold mx-auto border border-white/5 shadow-md">
                        {form.firstName || form.lastName ? (
                          ((form.firstName ? form.firstName[0] : '') + (form.lastName ? form.lastName[0] : '')).toUpperCase()
                        ) : 'CN'}
                      </div>
                    )}

                    <h4 className="mt-3.5 text-sm font-bold text-slate-100 tracking-wide truncate">
                      {form.firstName || 'First'} {form.lastName || 'Last'}
                    </h4>
                    
                    <p className="text-[11px] text-slate-400 mt-1 font-semibold select-text truncate">
                      {form.title || 'Job Title Placeholder'}
                    </p>

                    {form.organization && (
                      <span className="inline-block mt-1 font-mono text-[9px] text-indigo-300 bg-indigo-950/40 px-2.5 py-0.5 rounded-full border border-indigo-500/20 truncate max-w-full">
                        {form.organization}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 text-[10px] text-slate-400 space-y-1.5 select-text relative z-10">
                    {form.phone && (
                      <div className="flex items-center gap-2 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{form.phone}</span>
                      </div>
                    )}
                    {form.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{form.email}</span>
                      </div>
                    )}
                    {form.website && (
                      <div className="flex items-center gap-2 truncate whitespace-nowrap">
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        <span>{form.website}</span>
                      </div>
                    )}
                  </div>

                  {/* Social indicators on card preview */}
                  <div className="mt-4 flex items-center justify-center gap-2 relative z-10">
                    {form.socials.linkedin && <span className="p-1 h-6 w-6 rounded bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 text-[9px] font-mono hover:text-white transition">in</span>}
                    {form.socials.twitter && <span className="p-1 h-6 w-6 rounded bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 text-[9px] font-mono hover:text-white transition">X</span>}
                    {form.socials.github && <span className="p-1 h-6 w-6 rounded bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 text-[9px] font-mono hover:text-white transition">Git</span>}
                    {form.socials.instagram && <span className="p-1 h-6 w-6 rounded bg-white/5 border border-white/5 flex items-center justify-center text-slate-400 text-[9px] font-mono hover:text-white transition">ig</span>}
                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
