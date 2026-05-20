import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Phone, Mail, MessageSquare, MapPin, Globe, Linkedin, Twitter, Github, 
  Instagram, ArrowLeft, Download, Share2, Clipboard, Check, QrCode, Building, ServerCrash
} from 'lucide-react';
import { Contact } from '../types';

export default function PublicCard() {
  const { id } = useParams<{ id: string }>();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    fetchContact();
  }, [id]);

  const fetchContact = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${id}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned code ${res.status}`);
      }
      const data = await res.json();
      setContact(data);
    } catch (err: any) {
      console.error("Failed to load public contact card:", err);
      setError(err.message || "Failed to load card information. It might have been deleted or the server is offline.");
    } finally {
      setLoading(false);
    }
  };

  // Generate and Download vCard v3.0 file
  const handleDownloadVCard = () => {
    if (!contact) return;

    const { firstName, lastName, organization, title, phone, email, website, address, avatar, socials } = contact;
    
    let vcardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${lastName};${firstName};;;`,
      `FN:${firstName} ${lastName}`,
    ];

    if (organization) vcardLines.push(`ORG:${organization}`);
    if (title) vcardLines.push(`TITLE:${title}`);
    if (phone) vcardLines.push(`TEL;TYPE=CELL,VOICE:${phone}`);
    if (email) vcardLines.push(`EMAIL;TYPE=PREF,INTERNET:${email}`);
    if (address) {
      // Escape commas for ADR vCard format
      const escapedAddress = address.replace(/,/g, '\\,');
      vcardLines.push(`ADR;TYPE=WORK,PREF:;;${escapedAddress};;;;`);
    }
    if (website) vcardLines.push(`URL:${website}`);

    // Social fields
    if (socials?.linkedin) vcardLines.push(`X-SOCIALPROFILE;TYPE=linkedin:https://linkedin.com/in/${socials.linkedin}`);
    if (socials?.twitter) vcardLines.push(`X-SOCIALPROFILE;TYPE=twitter:https://twitter.com/${socials.twitter}`);
    if (socials?.github) vcardLines.push(`X-SOCIALPROFILE;TYPE=github:https://github.com/${socials.github}`);
    if (socials?.instagram) vcardLines.push(`X-SOCIALPROFILE;TYPE=instagram:https://instagram.com/${socials.instagram}`);

    // Embed base64 PHOTO if valid
    if (avatar && avatar.includes(';base64,')) {
      try {
        const parts = avatar.split(';base64,');
        if (parts.length === 2) {
          const header = parts[0];
          const rawBase64 = parts[1].replace(/\s/g, ''); // strip spaces
          
          // Try to detect MIME type
          let mime = 'JPEG';
          if (header.includes('png')) mime = 'PNG';
          else if (header.includes('gif')) mime = 'GIF';
          else if (header.includes('webp')) mime = 'WEBP';

          // Inject PHOTO line conforming to specification
          vcardLines.push(`PHOTO;TYPE=${mime};ENCODING=b:${rawBase64}`);
        }
      } catch (e) {
        console.error("VCard image embedding failed:", e);
      }
    }

    vcardLines.push('END:VCARD');

    const vcardContent = vcardLines.join('\n');
    const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${firstName}_${lastName}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Device context sharing
  const handleShare = async () => {
    const currentUrl = window.location.href;
    const title = contact ? `${contact.firstName} ${contact.lastName} — Digital Card` : 'Digital Business Card';

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Scan or save my CARDNET digital business card:`,
          url: currentUrl,
        });
      } catch (err) {
        console.log("Device share dismissed or failed, falling back to copy", err);
        copyToClipboard(currentUrl);
      }
    } else {
      copyToClipboard(currentUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Generate initials visual label
  const getInitials = () => {
    if (!contact) return '';
    const f = contact.firstName ? contact.firstName[0] : '';
    const l = contact.lastName ? contact.lastName[0] : '';
    return (f + l).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Background Decorative Ambient Flares */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-[140px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-violet-500/10 blur-[130px] animate-pulse-slow delay-700" />
        
        <div className="flex flex-col items-center gap-4 relative z-10 select-none">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs font-mono tracking-wider">Retrieving smart key index...</p>
        </div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        {/* Background Decorative Ambient Flares */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-rose-500/10 blur-[140px] animate-pulse-slow" />
        
        <div className="max-w-md w-full glass-card border border-white/10 rounded-3xl p-8 text-center space-y-6 relative z-10">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/20 shadow-lg">
            <ServerCrash className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Unable to Fetch vCard</h2>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              {error || "The digital card you are looking for does not exist on our servers."}
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={fetchContact}
              className="w-full bg-indigo-650 hover:bg-indigo-600 border border-white/10 text-white font-bold py-3 rounded-xl transition duration-200 text-xs select-none cursor-pointer outline-none shadow-lg shadow-indigo-650/15"
              id="public-card-retry-btn"
            >
              Retry Connection
            </button>
            <Link
              to="/"
              className="w-full bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 hover:text-white font-bold py-3 rounded-xl transition duration-200 text-xs flex items-center justify-center gap-2 outline-none select-none"
              id="public-card-home-btn"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Hub Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 select-none font-sans flex flex-col relative overflow-hidden">
      {/* Background Decorative Ambient Flares */}
      <div className="absolute top-1/4 left-1/4 w-[450px] h-[450px] rounded-full bg-indigo-500/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-650/5 blur-[140px] pointer-events-none" />

      {/* Top Floating App Action Link for Admin Users */}
      <div className="w-full max-w-md mx-auto px-4 pt-6 flex justify-between items-center relative z-10">
        <Link 
          to="/" 
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-white/10 transition outline-none"
          id="public-card-dashboard-link"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </Link>
        <button
          onClick={() => setShowQR(!showQR)}
          className={`flex items-center justify-center p-2.5 rounded-full border transition cursor-pointer outline-none ${
            showQR 
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-650/30' 
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
          }`}
          title="Toggle QR Code display"
          id="toggle-qr-code"
        >
          <QrCode className="w-4 h-4" />
        </button>
      </div>

      <main className="flex-1 w-full max-w-md mx-auto px-4 pb-12 flex flex-col justify-center relative z-10 animate-[slideUp_0.35s_ease-out]">
        <div className="relative mt-6 glass-card border border-white/10 rounded-[2.5rem] p-6 shadow-2xl backdrop-blur-2xl">
          
          {/* Card Top Banner Decoration */}
          <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-indigo-500/10 to-transparent rounded-t-[2.5rem] -z-10" />

          {/* QR Code Overlay screen */}
          {showQR ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-6 animate-[fadeIn_0.21s_ease-out]">
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-100">Scan to Connect</h3>
                <p className="text-xs text-slate-450 mt-1">Open camera to capture contacts link</p>
              </div>
              <div className="p-4 bg-white rounded-[2rem] shadow-2xl inline-block border-4 border-indigo-500/20">
                <QRCodeSVG 
                  value={window.location.href} 
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="text-center font-mono text-[10px] text-slate-300 bg-slate-950/60 px-3 py-1.5 rounded-full border border-white/5">
                {contact.firstName.toLowerCase()}_{contact.lastName.toLowerCase()}.vcard
              </div>
              <button
                onClick={() => setShowQR(false)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline underline-offset-4 pt-2 cursor-pointer outline-none"
                id="close-qr-view"
              >
                Back to Details
              </button>
            </div>
          ) : (
            <>
              {/* Profile Header Block */}
              <div className="flex flex-col items-center text-center pt-4">
                <div className="relative">
                  {contact.avatar ? (
                    <img 
                      src={contact.avatar} 
                      alt={`${contact.firstName} ${contact.lastName}`}
                      className="w-28 h-28 rounded-[2.2rem] object-cover border-4 border-slate-900 shadow-2xl referrer-policy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-[2.2rem] bg-gradient-to-tr from-indigo-550 to-indigo-750 border-4 border-slate-900 shadow-2xl flex items-center justify-center text-white text-3xl font-extrabold tracking-tight">
                      {getInitials()}
                    </div>
                  )}
                  {/* Active Status Badge Decoration */}
                  <span className="absolute bottom-1 right-1 flex h-4 w-4 rounded-full border-2 border-slate-950 bg-emerald-500" />
                </div>

                <h1 className="mt-5 text-2xl font-bold tracking-tight text-white leading-tight">
                  {contact.firstName} {contact.lastName}
                </h1>
                
                {contact.title && (
                  <p className="text-slate-300 text-sm font-semibold mt-1.5">{contact.title}</p>
                )}
                
                {contact.organization && (
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1.5 font-bold bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{contact.organization}</span>
                  </div>
                )}

                {contact.address && (
                  <div className="flex items-center gap-1 text-slate-450 text-xs mt-2.5 max-w-[280px]">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <span className="truncate" title={contact.address}>{contact.address}</span>
                  </div>
                )}
              </div>

              {/* Middle Section: 4 Action Rings */}
              <div className="grid grid-cols-4 gap-4 mt-8 px-2">
                {/* 1. Call Dial */}
                <a
                  href={contact.phone ? `tel:${contact.phone}` : '#'}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl transition duration-205 group ${
                    contact.phone 
                      ? 'bg-white/5 hover:bg-white/10 text-indigo-400 border border-white/5 cursor-pointer' 
                      : 'bg-white/5 opacity-30 text-slate-600 cursor-not-allowed pointer-events-none border border-white/5'
                  }`}
                  title={contact.phone ? `Dial ${contact.phone}` : 'No phone number'}
                  id="action-ring-call"
                >
                  <div className="w-11 h-11 rounded-full bg-slate-950/40 border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-150">
                    <Phone className="w-4.5 h-4.5 text-indigo-400" />
                  </div>
                  <span className="text-[10px] text-slate-450 font-bold mt-2">Call</span>
                </a>

                {/* 2. Email Address */}
                <a
                  href={contact.email ? `mailto:${contact.email}` : '#'}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl transition duration-205 group ${
                    contact.email 
                      ? 'bg-white/5 hover:bg-white/10 text-emerald-400 border border-white/5 cursor-pointer' 
                      : 'bg-white/5 opacity-30 text-slate-600 cursor-not-allowed pointer-events-none border border-white/5'
                  }`}
                  title={contact.email ? `Mail ${contact.email}` : 'No email address'}
                  id="action-ring-email"
                >
                  <div className="w-11 h-11 rounded-full bg-slate-950/40 border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-150">
                    <Mail className="w-4.5 h-4.5 text-emerald-400" />
                  </div>
                  <span className="text-[10px] text-slate-450 font-bold mt-2">Email</span>
                </a>

                {/* 3. Text SMS */}
                <a
                  href={contact.phone ? `sms:${contact.phone}` : '#'}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl transition duration-205 group ${
                    contact.phone 
                      ? 'bg-white/5 hover:bg-white/10 text-amber-400 border border-white/5 cursor-pointer' 
                      : 'bg-white/5 opacity-30 text-slate-600 cursor-not-allowed pointer-events-none border border-white/5'
                  }`}
                  title={contact.phone ? `SMS ${contact.phone}` : 'No phone for SMS'}
                  id="action-ring-sms"
                >
                  <div className="w-11 h-11 rounded-full bg-slate-950/40 border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-150">
                    <MessageSquare className="w-4.5 h-4.5 text-amber-400" />
                  </div>
                  <span className="text-[10px] text-slate-450 font-bold mt-2">SMS</span>
                </a>

                {/* 4. Map Navigation */}
                <a
                  href={contact.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}` : '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl transition duration-205 group ${
                    contact.address 
                      ? 'bg-white/5 hover:bg-white/10 text-rose-400 border border-white/5 cursor-pointer' 
                      : 'bg-white/5 opacity-30 text-slate-600 cursor-not-allowed pointer-events-none border border-white/5'
                  }`}
                  title={contact.address ? `Open "${contact.address}" in Google Maps` : 'No address set'}
                  id="action-ring-map"
                >
                  <div className="w-11 h-11 rounded-full bg-slate-950/40 border border-white/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-150">
                    <MapPin className="w-4.5 h-4.5 text-rose-400" />
                  </div>
                  <span className="text-[10px] text-slate-450 font-bold mt-2">Map</span>
                </a>
              </div>

              {/* Lower Section: Social Links in Frosted Glass Design */}
              <div className="mt-8 space-y-2.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pl-2 block">
                  Connections & Links
                </span>

                {/* Website Link Card */}
                {contact.website && (
                  <a
                    href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition duration-150 group cursor-pointer outline-none"
                    id="public-web-tile"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-950/40 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-indigo-400 transition-colors">
                        <Globe className="w-4.5 h-4.5" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-slate-250">Personal Website</h4>
                        <p className="text-[10px] text-slate-450 truncate max-w-[200px] font-medium">{contact.website}</p>
                      </div>
                    </div>
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-500 rotate-180 group-hover:translate-x-0.5 transition-all group-hover:text-slate-350" />
                  </a>
                )}

                {/* LinkedIn Link Card */}
                {contact.socials?.linkedin && (
                  <a
                    href={`https://linkedin.com/in/${contact.socials.linkedin}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition duration-150 group cursor-pointer outline-none"
                    id="public-linkedin-tile"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-950/40 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-[#0a66c2] transition-colors">
                        <Linkedin className="w-4.5 h-4.5" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-slate-250">LinkedIn</h4>
                        <p className="text-[10px] text-slate-450 font-medium">in/{contact.socials.linkedin}</p>
                      </div>
                    </div>
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-500 rotate-180 group-hover:translate-x-0.5 transition-all group-hover:text-slate-350" />
                  </a>
                )}

                {/* Twitter Link Card */}
                {contact.socials?.twitter && (
                  <a
                    href={`https://twitter.com/${contact.socials.twitter}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition duration-150 group cursor-pointer outline-none"
                    id="public-twitter-tile"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-950/40 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-sky-400 transition-colors">
                        <Twitter className="w-4.5 h-4.5" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-slate-250">Twitter / X</h4>
                        <p className="text-[10px] text-slate-450 font-medium">@{contact.socials.twitter}</p>
                      </div>
                    </div>
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-500 rotate-180 group-hover:translate-x-0.5 transition-all group-hover:text-slate-350" />
                  </a>
                )}

                {/* GitHub Link Card */}
                {contact.socials?.github && (
                  <a
                    href={`https://github.com/${contact.socials.github}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition duration-150 group cursor-pointer outline-none"
                    id="public-github-tile"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-950/40 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                        <Github className="w-4.5 h-4.5" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-slate-250">GitHub</h4>
                        <p className="text-[10px] text-slate-450 font-medium">{contact.socials.github}</p>
                      </div>
                    </div>
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-500 rotate-180 group-hover:translate-x-0.5 transition-all group-hover:text-slate-350" />
                  </a>
                )}

                {/* Instagram Link Card */}
                {contact.socials?.instagram && (
                  <a
                    href={`https://instagram.com/${contact.socials.instagram}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition duration-150 group cursor-pointer outline-none"
                    id="public-instagram-tile"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-950/40 border border-white/5 flex items-center justify-center text-slate-400 group-hover:text-rose-400 transition-colors">
                        <Instagram className="w-4.5 h-4.5" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-slate-250">Instagram</h4>
                        <p className="text-[10px] text-slate-450 font-medium">@{contact.socials.instagram}</p>
                      </div>
                    </div>
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-500 rotate-180 group-hover:translate-x-0.5 transition-all group-hover:text-slate-350" />
                  </a>
                )}

                {!contact.website && !contact.socials?.linkedin && !contact.socials?.twitter && !contact.socials?.github && !contact.socials?.instagram && (
                  <div className="p-4 bg-slate-950/40 text-center rounded-2xl text-xs text-slate-500 border border-dashed border-white/10">
                    No connected links shared on this card
                  </div>
                )}
              </div>
            </>
          )}

          {/* Action Footer Buttons */}
          <div className="grid grid-cols-2 gap-3.5 mt-8 border-t border-white/10 pt-6">
            <button
              onClick={handleDownloadVCard}
              className="flex items-center justify-center gap-2 bg-gradient-to-tr from-indigo-550 to-indigo-750 hover:from-indigo-500 hover:to-indigo-700 text-white font-bold py-3.5 rounded-2xl text-xs transition duration-150 shadow-xl shadow-indigo-650/10 border border-indigo-400/20 cursor-pointer outline-none"
              id="vcard-download-btn"
            >
              <Download className="w-4 h-4" />
              <span>Add to Contact</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white transition duration-150 py-3.5 rounded-2xl text-xs font-bold shadow-xl cursor-pointer outline-none"
              id="vcard-share-btn"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-slate-400" />
                  <span>Share vCard</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Footer branding */}
        <p className="text-center font-mono text-[9px] text-slate-600 mt-6 tracking-widest uppercase">
          Powered by CARDNET Hub Security
        </p>
      </main>
    </div>
  );
}
