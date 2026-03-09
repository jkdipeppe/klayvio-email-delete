import Head from "next/head";
import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - Klaviyo Spam Profile Cleaner</title>
        <meta
          name="description"
          content="Privacy Policy for Klaviyo Spam Profile Cleaner"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/SpamProfileCleanerIcon.png" />
      </Head>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              href="/"
              className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700"
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
          </div>
        </header>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-8">
              Privacy Policy
            </h1>
            <p className="text-sm text-gray-500 mb-8">
              Last updated:{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>

            <div className="prose prose-indigo max-w-none">
              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  1. Introduction
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Klaviyo Spam Profile Cleaner ("we", "our", or "us") is
                  committed to protecting your privacy. This Privacy Policy
                  explains how we collect, use, disclose, and safeguard your
                  information when you use our service to clean spam profiles
                  from your Klaviyo account.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  2. Information We Collect
                </h2>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  2.1 Account Information
                </h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  When you connect your Klaviyo account, we collect and store:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Klaviyo account ID and basic account information</li>
                  <li>OAuth access tokens and refresh tokens (encrypted)</li>
                  <li>Token expiration information</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  2.2 Usage Information
                </h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  We collect information about how you use our service:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Cleanup rules and patterns you configure</li>
                  <li>Deletion history and logs</li>
                  <li>
                    Subscription and billing information (processed securely
                    through Stripe)
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  3. How We Use Your Information
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  We use the information we collect to:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>
                    Provide and maintain our spam profile cleaning service
                  </li>
                  <li>
                    Execute cleanup operations according to your configured
                    rules
                  </li>
                  <li>Schedule and run automatic cleanup tasks</li>
                  <li>Process payments and manage subscriptions</li>
                  <li>Improve our service and develop new features</li>
                  <li>
                    Respond to your inquiries and provide customer support
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  4. Data Security
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  We implement appropriate technical and organizational security
                  measures to protect your information:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>
                    All OAuth tokens are encrypted before storage using
                    industry-standard encryption
                  </li>
                  <li>
                    Database access is protected with Row Level Security (RLS)
                    policies
                  </li>
                  <li>Secure HTTPS connections for all data transmission</li>
                  <li>Access controls and authentication requirements</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  5. Data Sharing and Disclosure
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  We do not sell, trade, or rent your personal information to
                  third parties. We may share your information only in the
                  following circumstances:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>
                    <strong>Klaviyo API:</strong> We use your OAuth tokens to
                    interact with Klaviyo's API on your behalf, as authorized by
                    you
                  </li>
                  <li>
                    <strong>Payment Processing:</strong> We use Stripe to
                    process payments. Stripe's use of your information is
                    governed by their privacy policy
                  </li>
                  <li>
                    <strong>Service Providers:</strong> We may use third-party
                    service providers (e.g., hosting, database) who are
                    contractually obligated to protect your information
                  </li>
                  <li>
                    <strong>Legal Requirements:</strong> We may disclose
                    information if required by law or to protect our rights and
                    safety
                  </li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  6. Your Rights and Choices
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  You have the right to:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Access, update, or delete your account information</li>
                  <li>Disconnect your Klaviyo account at any time</li>
                  <li>Modify or delete your cleanup rules</li>
                  <li>Cancel your subscription</li>
                  <li>Request a copy of your data</li>
                  <li>Opt out of certain data collection practices</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  7. Data Retention
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  We retain your information for as long as necessary to provide
                  our services and comply with legal obligations. When you
                  disconnect your account, we will delete your OAuth tokens and
                  may retain anonymized usage data for analytical purposes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  8. Children's Privacy
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Our service is not intended for individuals under the age of
                  18. We do not knowingly collect personal information from
                  children.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  9. Changes to This Privacy Policy
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  We may update this Privacy Policy from time to time. We will
                  notify you of any changes by posting the new Privacy Policy on
                  this page and updating the "Last updated" date. You are
                  advised to review this Privacy Policy periodically for any
                  changes.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  10. Contact Us
                </h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  If you have any questions about this Privacy Policy, please
                  contact us at antibotbuilders@gmail.com.
                </p>
              </section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-600">
              <p className="mb-2">Klaviyo Spam Profile Cleaner</p>
              <p className="text-sm">
                <Link
                  href="/privacy"
                  className="text-indigo-600 hover:text-indigo-700 underline"
                >
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
