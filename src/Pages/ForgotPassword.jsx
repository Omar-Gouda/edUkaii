import { PageHero, SiteLayout } from "../Components/SiteLayout";

export default function ForgotPassword() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Recovery"
        title="Password reset stays inside the same calmer UI."
        description="This recovery surface is ready for backend email-link integration and already matches the updated platform design."
      />
      <section className="px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-xl shell-card p-8">
          <label className="text-sm font-semibold text-slate-700">
            Account email
            <input type="email" className="mt-2 w-full px-4 py-3" placeholder="yourname@edukai.com" />
          </label>
          <button type="button" className="primary-btn mt-5">
            Send reset link
          </button>
        </div>
      </section>
    </SiteLayout>
  );
}
