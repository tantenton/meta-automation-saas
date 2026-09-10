import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Meta Automation",
  description: "Official Terms of Service for Meta Automation by BirruLabs.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-300 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 bg-[#111113] p-8 sm:p-12 rounded-2xl border border-white/10 shadow-2xl">
        <div className="border-b border-white/10 pb-6">
          <Link href="/" className="text-xs font-semibold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition">
            ← Back to Meta Automation
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 tracking-tight">Terms of Service</h1>
          <p className="text-sm text-zinc-400 mt-1">Last Updated: September 10, 2026</p>
        </div>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">1. Acceptance of Terms</h2>
          <p>
            By accessing or using <strong>Meta Automation</strong> (&quot;the Service&quot;), provided by <strong>BirruLabs</strong> at{" "}
            <code className="text-indigo-400">https://meta-automation-saas.vercel.app</code>, you agree to be bound by these Terms of Service. 
            If you do not agree to these terms, do not access or use the Service.
          </p>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">2. Description of Service</h2>
          <p>
            Meta Automation is an autonomous social media workflow and content syndication platform designed for creators, publishers, and brands. 
            The platform enables users to schedule, manage, audit, and analyze content across authorized third-party platforms including Meta (Instagram, Facebook, Threads) and TikTok.
          </p>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">3. Third-Party Platform Policies</h2>
          <p>
            Your use of Meta Automation in connection with third-party social media platforms is subject to their respective terms and developer policies:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-300">
            <li><strong>TikTok:</strong> You agree to comply with TikTok&apos;s Developer Terms of Service and Community Guidelines.</li>
            <li><strong>Meta:</strong> You agree to comply with Meta&apos;s Platform Terms and Developer Policies.</li>
          </ul>
          <p>
            Meta Automation is not responsible for any enforcement action, account suspension, or content removal initiated by third-party platforms for violations of their policies.
          </p>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">4. User Obligations & Permitted Use</h2>
          <p>You agree that:</p>
          <ul className="list-disc pl-6 space-y-2 text-zinc-300">
            <li>You own or hold the necessary intellectual property rights and licenses for all videos, media, and captions you schedule or syndicate through the Service.</li>
            <li>You will not use the Service to publish unlawful, defamatory, infringing, or abusive content.</li>
            <li>You will not attempt to reverse-engineer, exploit rate limits, or disrupt the infrastructure of Meta Automation or connected third-party APIs.</li>
          </ul>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">5. Intellectual Property</h2>
          <p>
            All rights, title, and interest in and to Meta Automation (excluding user-submitted media) are and will remain the exclusive property of BirruLabs. 
            Users retain 100% ownership of their uploaded and syndicated media assets.
          </p>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">6. Termination</h2>
          <p>
            You may terminate your use of the Service at any time by disconnecting your accounts and ceasing use. 
            BirruLabs reserves the right to suspend or terminate access to the Service for any user who violates these Terms or third-party platform guidelines.
          </p>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">7. Disclaimer & Limitation of Liability</h2>
          <p>
            The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind. 
            In no event shall BirruLabs be liable for any indirect, incidental, special, or consequential damages resulting from your use of or inability to use the Service.
          </p>
        </section>

        <section className="space-y-4 text-sm sm:text-base leading-relaxed">
          <h2 className="text-xl font-bold text-white">8. Contact Information</h2>
          <div className="bg-white/[0.03] p-4 rounded-xl border border-white/5 text-sm space-y-1">
            <p><strong>Platform:</strong> Meta Automation</p>
            <p><strong>Entity:</strong> BirruLabs</p>
            <p><strong>Support Email:</strong> littledyrashop@gmail.com</p>
            <p><strong>Website:</strong> https://meta-automation-saas.vercel.app</p>
          </div>
        </section>
      </div>
    </main>
  );
}
