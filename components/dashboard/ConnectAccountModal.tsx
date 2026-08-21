"use client";

import { useState } from "react";

type Platform = "instagram" | "facebook" | "threads";

const platforms: { id: Platform; label: string; color: string; desc: string }[] = [
  { id: "instagram", label: "Instagram Professional", color: "bg-gradient-to-tr from-yellow-500 via-pink-600 to-purple-600", desc: "Publish reels, photos & stories" },
  { id: "facebook", label: "Facebook Page", color: "bg-blue-600", desc: "Manage organic posts on Facebook Pages" },
  { id: "threads", label: "Threads Account", color: "bg-zinc-800", desc: "Automate posts, replies & conversation" },
];

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (platform: Platform) => void;
}

export default function ConnectAccountModal({
  isOpen,
  onClose,
  onConnect,
}: ConnectAccountModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [connecting, setConnecting] = useState(false);

  if (!isOpen) return null;

  const handleConnect = () => {
    if (!selectedPlatform) return;
    setConnecting(true);

    if (onConnect) {
      onConnect(selectedPlatform);
    } else {
      window.location.href = `/api/oauth/${selectedPlatform}/start`;
    }
  };

  const handleDirectConnect = (platform: Platform) => {
    setSelectedPlatform(platform);
    setConnecting(true);
    window.location.href = `/api/oauth/${platform}/start`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-bold text-white tracking-tight">Connect Meta Account</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Authorize your Meta account via official OAuth2 to start automated publishing
        </p>

        {/* Platform Selector */}
        <div className="mt-6 space-y-3">
          {platforms.map((platform) => {
            const isSelected = selectedPlatform === platform.id;
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => setSelectedPlatform(platform.id)}
                className={`flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-indigo-500/80 bg-indigo-500/10 ring-1 ring-indigo-500/40"
                    : "border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                <div className={`h-10 w-10 rounded-xl ${platform.color} flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0`}>
                  {platform.label[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm">{platform.label}</div>
                  <div className="text-[11px] text-zinc-400 truncate mt-0.5">{platform.desc}</div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                  isSelected ? 'bg-indigo-500 text-white' : 'bg-white/5 text-zinc-400 group-hover:text-white'
                }`}>
                  {isSelected ? "Ready" : "Select"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Connect Button */}
        <button
          type="button"
          onClick={handleConnect}
          disabled={!selectedPlatform || connecting}
          className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            selectedPlatform && !connecting
              ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:opacity-95 cursor-pointer"
              : "bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5"
          }`}
        >
          {connecting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Redirecting to Meta OAuth...
            </>
          ) : (
            `Authenticate with ${selectedPlatform ? platforms.find(p => p.id === selectedPlatform)?.label : 'Meta'}`
          )}
        </button>

        <p className="mt-4 text-[11px] text-zinc-500 text-center leading-relaxed">
          Tokens are encrypted with AES-256-GCM and stored safely in your isolated Supabase vault.
        </p>
      </div>
    </div>
  );
}
