import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Meta Automation",
  description: "Official Privacy Policy for Meta Automation by BirruLabs.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-300 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 bg-[#111113] p-8 sm:p-12 rounded-2xl border border-white/10 shadow-2xl">
        <div className="border-b border-white/10 pb-6">
          <Link href="/" className="text-xs font-semibold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition">
            ← Back to Meta Automation
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-zinc-400 mt-1">Last Updated: September 10, 2026</p>
        </div>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">1. Introduction</h2>
          <p>
            Welcome to <strong>Meta Automation</strong> (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), operated by <strong>BirruLabs</strong>. 
            We provide social media scheduling, syndication, and analytics management across connected platforms including Meta (Instagram, Facebook, Threads) and TikTok.
          </p>
          <p>
            This Privacy Policy explains how we collect, use, store, and protect your information when you connect your accounts and use Meta Automation via 
            our web platform at <code className="text-indigo-400">https://meta-automation-saas.vercel.app</code>.
          </p>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">2. Information We Collect</h2>
          <p>When you authenticate and authorize Meta Automation, we collect:</p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-300">
            <li><strong>Account Identifiers:</strong> Your platform User ID, username, display name, and avatar URL.</li>
            <li><strong>OAuth Access Tokens:</strong> Securely encrypted API tokens provided by Meta and TikTok to perform authorized actions on your behalf.</li>
            <li><strong>Content & Media:</strong> Videos, captions, thumbnails, and metadata scheduled for publication.</li>
            <li><strong>Performance Metrics:</strong> Public post metrics (views, likes, comments, impressions) necessary to display analytics in your dashboard.</li>
          </ul>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">3. How We Use TikTok API Data</h2>
          <p>
            Meta Automation integrates with the <strong>TikTok for Developers API</strong>. Specifically, our application utilizes the following scopes:
          </p>
          <div className="space-y-3 bg-white/[0.03] p-4 rounded-xl border border-white/5">
            <div>
              <span className="font-semibold text-white">user.info.stats:</span>
              <p className="text-xs text-zinc-400 mt-0.5">Used strictly to retrieve and display creator performance metrics (e.g. video views and follower engagement) within the creator&apos;s private analytics dashboard.</p>
            </div>
            <div>
              <span className="font-semibold text-white">video.list:</span>
              <p className="text-xs text-zinc-400 mt-0.5">Used strictly to audit previously published videos, monitor upload status, and prevent duplicate postings.</p>
            </div>
            <div>
              <span className="font-semibold text-white">video.upload & video.publish:</span>
              <p className="text-xs text-zinc-400 mt-0.5">Used solely to initiate and complete scheduled video uploads explicitly created and scheduled by the user.</p>
            </div>
          </div>
          <p>
            We do <strong>not</strong> sell, rent, or trade your personal data or TikTok API data to third-party brokers, advertisers, or data aggregators under any circumstances.
          </p>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">4. Data Storage and Security</h2>
          <p>
            All access tokens and sensitive credentials are encrypted at rest using industry-standard AES-256 encryption. Our databases and cloud services 
            are secured behind strict VPC firewalls and role-based access control.
          </p>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">5. User Data Deletion & Revocation</h2>
          <p>
            You have full control over your data. You may revoke access or delete your stored data at any time:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-300">
            <li><strong>Revoke Access:</strong> Disconnect Meta Automation directly within your TikTok or Meta Account Settings &gt; Security &gt; Connected Apps.</li>
            <li><strong>Data Deletion Request:</strong> You can delete all your stored accounts, tokens, and content queue directly from the <em>Dashboard &gt; Accounts</em> page, or contact our support team at <span className="text-indigo-400 font-mono">littledyrashop@gmail.com</span> with the subject &quot;Data Deletion Request&quot;. Upon receipt, all associated data will be permanently wiped within 48 hours.</li>
          </ul>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">6. Contact Us</h2>
          <p>
            If you have any questions, concerns, or requests regarding this Privacy Policy, please reach out to:
          </p>
          <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 text-sm space-y-1">
            <p><strong>Service:</strong> Meta Automation</p>
            <p><strong>Organization:</strong> BirruLabs</p>
            <p><strong>Email:</strong> littledyrashop@gmail.com</p>
            <p><strong>Official Website:</strong> https://meta-automation-saas.vercel.app</p>
          </div>
        </section>
      </div>
    </main>
  );
}
