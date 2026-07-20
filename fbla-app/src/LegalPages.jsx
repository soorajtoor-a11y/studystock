import appMark from './assets/vye-mark.png'
import './LegalPages.css'

function LegalShell({ title, updated, children }) {
  return (
    <div className="legal-page">
      <header className="legal-nav">
        <a className="legal-brand" href="/">
          <img className="legal-mark" src={appMark} alt="" />
          Vye
        </a>
        <a className="legal-back" href="/">Back to home</a>
      </header>

      <main className="legal-body">
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        {children}
      </main>

      <footer className="legal-footer">
        <span>© {new Date().getFullYear()} Vye. All rights reserved.</span>
        <span className="legal-footer-links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
        </span>
        <a className="legal-contact" href="mailto:support@usevye.study">support@usevye.study</a>
      </footer>
    </div>
  )
}

// Numbered section wrapper — same "circle badge + title" visual language as
// the landing page's "How it works" steps, so a legal page still reads as
// part of the same designed site instead of a plain text dump.
function Section({ n, title, children }) {
  return (
    <section className="legal-section">
      <h2><span className="legal-section-num">{n}</span>{title}</h2>
      {children}
    </section>
  )
}

function Callout({ children }) {
  return <p className="legal-callout">{children}</p>
}

export function PrivacyPolicy() {
  return (
    <LegalShell title="Privacy Policy" updated="July 16, 2026">
      <p className="legal-intro">
        This Privacy Policy explains how Vye ("Vye," "we," "us," or "our") collects, uses, and
        protects your information when you use our website and study tools (the "Service"). By
        using the Service, you agree to the practices described here.
      </p>

      <Section n="1" title="Information We Collect">
        <p>We collect only the information needed to run the Service:</p>
        <ul>
          <li>
            <strong>Account information.</strong> When you create an account, we collect your
            email address and a password that you choose. Authentication and password storage are
            handled securely by our authentication provider, Supabase. Your password is stored in
            an encrypted (hashed) form, and we never see or store it in plain text.
          </li>
          <li>
            <strong>Google sign-in.</strong> If you choose to sign in with Google, Google shares
            basic profile information with us, such as your name and email address, through Google
            OAuth (managed via Supabase). We do not receive your Google password.
          </li>
          <li>
            <strong>Usage and activity data.</strong> In our own database, we store:
            <ul>
              <li>The events you have pinned (which competitive events you follow).</li>
              <li>Your AI explanation history for those pinned events (the explanations generated for you).</li>
              <li>Usage information, specifically the days you use the Service and the number of minutes used.</li>
            </ul>
          </li>
        </ul>
        <Callout><strong>What we do not collect.</strong> We do not track or store your test scores or quiz results.</Callout>
      </Section>

      <Section n="2" title="How We Use Your Information">
        <p>We use the information above to:</p>
        <ul>
          <li>Create and secure your account and log you in.</li>
          <li>Save your pinned events and your AI explanation history so you can return to them.</li>
          <li>Understand general usage (days and minutes) to improve the Service.</li>
          <li>Communicate with you about your account or support requests.</li>
        </ul>
        <Callout><strong>We do not sell your personal information.</strong></Callout>
      </Section>

      <Section n="3" title="Third-Party Services">
        <p>We rely on a small number of trusted providers to operate the Service:</p>
        <ul>
          <li><strong>Supabase</strong> provides our authentication and database hosting. Your account and stored data are held in Supabase's infrastructure.</li>
          <li><strong>Anthropic (Claude API).</strong> When you request an AI explanation, the relevant request content is sent to Anthropic's Claude API to generate the response. This third-party processing is what powers the explanations you receive. We send only what is needed to generate your response.</li>
          <li><strong>Google</strong> provides optional sign-in through Google OAuth.</li>
        </ul>
        <p>Each of these providers processes data under its own privacy terms.</p>
      </Section>

      <Section n="4" title="Data Storage and Security">
        <p>
          Your data is stored with our providers named above. We use industry-standard measures,
          including encrypted password storage and secure connections, to protect your
          information. No method of transmission or storage is completely secure, so we cannot
          guarantee absolute security.
        </p>
      </Section>

      <Section n="5" title="Data Retention">
        <p>
          We keep your account and activity data for as long as your account is active. If you
          delete your account or ask us to remove your data, we will delete it from our systems
          within a reasonable period, except where we must keep it to meet legal obligations.
        </p>
      </Section>

      <Section n="6" title="Your Rights and Choices">
        <p>You can:</p>
        <ul>
          <li>Access the personal information we hold about you.</li>
          <li>Correct inaccurate information.</li>
          <li>Request deletion of your account and associated data.</li>
        </ul>
        <p>
          To make any of these requests, email us at <a href="mailto:support@usevye.study">support@usevye.study</a>.
          Depending on where you live, you may have additional rights under laws such as the GDPR
          or the CCPA.
        </p>
      </Section>

      <Section n="7" title="Children's Privacy">
        <p>
          The Service is intended for users who are 13 years of age or older. Users aged 13 and
          above are welcome to use Vye. The Service is not directed to children under 13, and we
          do not knowingly collect personal information from children under 13. If you believe a
          child under 13 has provided us with personal information, please contact us at{' '}
          <a href="mailto:support@usevye.study">support@usevye.study</a> and we will delete it.
        </p>
      </Section>

      <Section n="8" title="Cookies and Sessions">
        <p>
          We use cookies and similar technologies that are necessary to keep you signed in and to
          operate the Service (for example, session tokens from Supabase). We do not use them to
          sell your data.
        </p>
      </Section>

      <Section n="9" title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will change the
          "Last updated" date above. Significant changes may be communicated through the Service.
        </p>
      </Section>

      <Section n="10" title="Contact Us">
        <p>
          If you have questions or requests regarding this Privacy Policy or your data, contact us
          at: <a href="mailto:support@usevye.study">support@usevye.study</a>
        </p>
      </Section>
    </LegalShell>
  )
}

export function TermsOfService() {
  return (
    <LegalShell title="Terms of Service" updated="pending, this page is placeholder text for now">
      <p>
        This is placeholder text. The final Terms of Service will be supplied and will replace
        everything on this page. Nothing here should be treated as Vye's actual terms until that
        replacement happens.
      </p>

      <Section n="1" title="Using Vye">
        <p>
          Placeholder: this section will describe who may use the service and any account
          requirements.
        </p>
      </Section>

      <Section n="2" title="Content and Accuracy">
        <p>
          Placeholder: this section will describe that quiz questions, flashcards, and
          explanations are AI-generated study aids, not official materials from FBLA-PBL, DECA
          Inc., or HOSA-Future Health Professionals, and should be used alongside, not instead of,
          official competitive event guidelines.
        </p>
      </Section>

      <Section n="3" title="Accounts">
        <p>
          Placeholder: this section will describe account creation, responsibility for account
          security, and acceptable use.
        </p>
      </Section>

      <Section n="4" title="Limitation of Liability">
        <p>
          Placeholder: this section will describe the service being provided as-is, without
          warranties of any kind.
        </p>
      </Section>

      <Section n="5" title="Changes to These Terms">
        <p>
          Placeholder: this section will describe how Vye may update these terms and how users
          will be notified.
        </p>
      </Section>

      <Section n="6" title="Contact">
        <p>
          Questions about these terms can be sent to <a href="mailto:support@usevye.study">support@usevye.study</a> in
          the meantime.
        </p>
      </Section>
    </LegalShell>
  )
}
