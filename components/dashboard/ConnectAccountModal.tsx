"use client";

import { useState } from "react";

type Platform = "instagram" | "facebook" | "threads";

const platforms: { id: Platform; label: string; color: string }[] = [
  { id: "instagram", label: "Instagram", color: "bg-pink-600" },
  { id: "facebook", label: "Facebook", color: "bg-blue-600" },
  { id: "threads", label: "Threads", color: "bg-gray-600" },
];

interface ConnectAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (platform: Platform) => void;
}

export default function ConnectAccountModal({
  isOpen,
  onClose,
  onConnect,
}: ConnectAccountModalProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  if (!isOpen) return null;

  const handleConnect = () => {
    if (selectedPlatform) {
      onConnect(selectedPlatform);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-[#0f0f0f] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold tracking-tight">Connect Account</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect a social media platform to start managing your accounts
        </p>

        {/* Platform Selector */}
        <div className="mt-6 space-y-3">
          {platforms.map((platform) => (
            <button
              key={platform.id}
              type="button"
              onClick={() => setSelectedPlatform(platform.id)}
              className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 transition-all hover:bg-accent ${
                selectedPlatform === platform.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className={`h-10 w-10 rounded-full ${platform.color} flex items-center justify-center text-white`}>
                {platform.label[0]}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">{platform.label}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedPlatform === platform.id ? "Selected" : "Connect"}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Connect Button */}
        <button
          type="button"
          onClick={handleConnect}
          disabled={!selectedPlatform}
          className={`mt-6 w-full rounded-lg px-4 py-2.5 font-medium transition-colors ${
            selectedPlatform
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          Connect with OAuth
        </button>

        <p className="mt-4 text-xs text-muted-foreground">
          By connecting your account, you agree to our Terms of Service and Privacy
          Policy. We'll use OAuth to securely authenticate your platform.
        </p>
      </div>
    </div>
  );
}
