"use client";

import { useState } from "react";
import ConnectAccountModal from "@/components/dashboard/ConnectAccountModal";

interface Account {
  id: string;
  platform: "instagram" | "facebook" | "threads";
  username: string;
  followerCount: number;
  lastPost: string;
  isConnected: boolean;
}

// Mock accounts data
const mockAccounts: Account[] = [
  {
    id: "1",
    platform: "instagram",
    username: "@brand",
    followerCount: 25000,
    lastPost: "2 days ago",
    isConnected: true,
  },
  {
    id: "2",
    platform: "facebook",
    username: "@company",
    followerCount: 15000,
    lastPost: "5 hours ago",
    isConnected: true,
  },
];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleConnectAccount = (platform: "instagram" | "facebook" | "threads") => {
    const newAccount: Account = {
      id: String(accounts.length + 1),
      platform,
      username: `@new_${platform}`,
      followerCount: 0,
      lastPost: "Never",
      isConnected: true,
    };
    setAccounts([...accounts, newAccount]);
    setIsModalOpen(false);
  };

  const formatFollowerCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground">Manage your connected social media accounts</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Account
        </button>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center text-white ${
                    account.platform === "instagram"
                      ? "bg-pink-600"
                      : account.platform === "facebook"
                        ? "bg-blue-600"
                        : "bg-gray-600"
                  }`}
                >
                  {account.platform[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-medium">{account.username}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{account.platform}</p>
                </div>
              </div>
              <div className="rounded-full bg-emerald-500/10 px-2.5 py-1">
                <span className="text-xs font-medium text-emerald-500">Active</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Followers</p>
                <p className="text-lg font-semibold">{formatFollowerCount(account.followerCount)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Last Post</p>
                <p className="text-lg font-semibold">{account.lastPost}</p>
              </div>
            </div>
          </div>
        ))}

        {/* Empty state placeholder - show if no accounts */}
        {accounts.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">No accounts connected yet</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Connect your first account
            </button>
          </div>
        )}
      </div>

      {/* Connect Account Modal */}
      <ConnectAccountModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnect={handleConnectAccount}
      />
    </div>
  );
}
