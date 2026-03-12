import { useState } from "react";
import Head from "next/head";
import Link from "next/link";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "What is Klaviyo Spam Profile Cleaner?",
    answer:
      "Klaviyo Spam Profile Cleaner is a web tool that automatically identifies and removes spam, bot, and disposable-email profiles from your Klaviyo account. You set up rules based on email prefixes and suffixes, preview the matched profiles, and delete them on demand — no coding required.",
  },
  {
    question: "How does it identify spam profiles in Klaviyo?",
    answer:
      "You define deletion rules using email prefixes (e.g., 'noreply', 'test', 'bounce') and email suffixes/domains (e.g., '@tempmail.com', '@mailinator.com'). The tool scans your Klaviyo profiles and flags any that match your configured patterns, showing you a preview before any deletion occurs.",
  },
  {
    question: "Does it connect securely to my Klaviyo account?",
    answer:
      "Yes. The tool connects via Klaviyo's official OAuth 2.0 flow. Your OAuth tokens are encrypted before storage. No API keys are stored in plaintext, and you can revoke access from your Klaviyo account settings at any time.",
  },
  {
    question: "Will it delete profiles automatically on a schedule?",
    answer:
      "No — all cleanup runs are manual and on-demand. You choose when to run a cleanup, which gives you full control and lets you review the preview before committing to any deletions. There is no automated scheduling.",
  },
  {
    question: "Can I preview which profiles will be deleted before they're removed?",
    answer:
      "Yes. After your rules are configured and you trigger a cleanup run, the tool shows you a list of all matching profiles. You review the preview first and then confirm deletion. Nothing is deleted without your explicit approval.",
  },
  {
    question: "What's the difference between email prefix and suffix matching?",
    answer:
      "Prefix matching targets the part of an email before the @ symbol (e.g., a prefix of 'noreply' would match 'noreply@example.com'). Suffix matching targets the domain part — the part after the @ symbol (e.g., a suffix of '@tempmail.com' would match 'user@tempmail.com'). You can combine both types of rules to catch a wide range of spam patterns.",
  },
  {
    question: "How many deletion rules can I create?",
    answer:
      "The Free plan supports 1 deletion rule. The Basic plan ($5/month) supports up to 5 rules. The Pro plan ($7/month) supports up to 100 rules. All paid plans include unlimited profiles per deletion and unlimited manual cleanup runs.",
  },
  {
    question: "What is the Free plan limit?",
    answer:
      "The Free plan allows 1 deletion rule and deletes up to 3 matching profiles per cleanup run. It supports unlimited manual runs. It's useful for testing the tool before upgrading to a paid plan.",
  },
  {
    question: "How much does it cost?",
    answer:
      "There are three plans: Free ($0/month, 1 rule, 3 profiles per run), Basic ($5/month, up to 5 rules, unlimited profiles), and Pro ($7/month, up to 100 rules, unlimited profiles). All plans include unlimited manual cleanup runs.",
  },
  {
    question: "Why should I clean spam profiles from Klaviyo?",
    answer:
      "Spam profiles inflate your Klaviyo contact count, which directly affects your billing. They also lower your engagement metrics (open rates, click rates), which can hurt your sender reputation and email deliverability. Removing them keeps your list accurate, reduces costs, and improves campaign performance.",
  },
  {
    question: "What types of spam profiles can it remove?",
    answer:
      "It can remove profiles with disposable/temporary email addresses (e.g., mailinator, tempmail, guerrillamail), bot-generated emails with common prefixes (e.g., test@, noreply@, bounce@, admin@), and any pattern you define — such as fake emails from giveaway entries or promotional form abuse.",
  },
  {
    question: "Does it work with all Klaviyo accounts?",
    answer:
      "Yes. It uses Klaviyo's official REST API and works with any Klaviyo account that can authorize third-party OAuth applications. You'll need to have the appropriate permissions in your Klaviyo account (profile management access) to use the deletion features.",
  },
  {
    question: "How do I get started?",
    answer:
      "Click 'Sign in with Google' on the homepage, then authorize the Klaviyo OAuth connection when prompted. Once connected, you'll be taken to your dashboard where you can create your first deletion rule and run your first cleanup.",
  },
  {
    question: "Can I cancel my subscription at any time?",
    answer:
      "Yes. You can cancel your subscription at any time from your account settings. Your access will continue until the end of the current billing period.",
  },
  {
    question: "Is my Klaviyo data safe?",
    answer:
      "Your Klaviyo profile data is only accessed transiently during a cleanup run — it is not stored on our servers. OAuth tokens are encrypted at rest. We do not sell or share your data with third parties. See our Privacy Policy for full details.",
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-indigo-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-gray-200">
      {items.map((item, index) => (
        <div key={index} className="py-5">
          <button
            className="flex w-full items-start justify-between text-left"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            aria-expanded={openIndex === index}
          >
            <span className="text-base font-semibold text-gray-900 pr-6">
              {item.question}
            </span>
            <span className="ml-6 flex-shrink-0">
              <ChevronIcon open={openIndex === index} />
            </span>
          </button>
          {openIndex === index && (
            <div className="mt-3 pr-12">
              <p className="text-gray-600 leading-relaxed">{item.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FAQPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <Head>
        <title>FAQ - Klaviyo Spam Profile Cleaner | Common Questions Answered</title>
        <meta
          name="description"
          content="Answers to common questions about Klaviyo Spam Profile Cleaner — how it works, pricing, security, what spam profiles it removes, and how to get started."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/SpamProfileCleanerIcon.png" />
        <link rel="canonical" href="https://klaviyocleaner.com/faq" />

        {/* Open Graph */}
        <meta property="og:title" content="FAQ - Klaviyo Spam Profile Cleaner" />
        <meta
          property="og:description"
          content="Frequently asked questions about Klaviyo Spam Profile Cleaner — how it works, pricing, security, and getting started."
        />
        <meta property="og:url" content="https://klaviyocleaner.com/faq" />

        {/* Twitter Card */}
        <meta name="twitter:title" content="Klaviyo Spam Profile Cleaner — FAQ" />
        <meta
          name="twitter:description"
          content="Everything you need to know about removing spam profiles from Klaviyo."
        />

        {/* JSON-LD: FAQPage — critical for Google rich results and AI answer engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span>Back to Home</span>
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-gray-600 hover:text-indigo-600"
              >
                View Pricing →
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Page Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to know about Klaviyo Spam Profile Cleaner —
              how it works, what it costs, and how it keeps your list clean.
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12">
            <FAQAccordion items={faqs} />
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-xl p-10 text-center text-white">
            <h2 className="text-2xl font-bold mb-3">
              Ready to clean your Klaviyo list?
            </h2>
            <p className="text-indigo-100 mb-6">
              Start for free — no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-gray-100 transition-all"
              >
                Get Started Free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center px-6 py-3 bg-indigo-700 text-white font-semibold rounded-lg hover:bg-indigo-800 transition-all"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-600">
              <p className="mb-2">Klaviyo Spam Profile Cleaner</p>
              <div className="flex justify-center gap-4 text-sm">
                <Link
                  href="/privacy"
                  className="text-indigo-600 hover:text-indigo-700 underline"
                >
                  Privacy Policy
                </Link>
                <span className="text-gray-400">·</span>
                <Link
                  href="/pricing"
                  className="text-indigo-600 hover:text-indigo-700 underline"
                >
                  Pricing
                </Link>
                <span className="text-gray-400">·</span>
                <Link
                  href="/faq"
                  className="text-indigo-600 hover:text-indigo-700 underline"
                >
                  FAQ
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
