import { PageHero, SiteLayout } from "../Components/SiteLayout";

export default function ContactUs() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Contact us"
        title="Reach out without leaving the calmer tone behind."
        description="Whether you are a student, a parent, or a future team member, reach out and we will get back to you as soon as we can."
      />

      <section className="px-6 pb-20 md:px-12">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="surface-card p-8">
            <h2 className="mb-4 text-2xl font-bold text-primary">Get in touch</h2>
            <div className="space-y-4 text-gray-700">
              <p><strong>Email:</strong> support@edukai.com</p>
              <p><strong>Phone:</strong> +20 100 000 0000</p>
              <p><strong>Address:</strong> Cairo, Egypt</p>
            </div>
          </div>

          <div className="surface-card p-8">
            <h2 className="mb-4 text-2xl font-bold text-primary">Send a message</h2>
            <form className="grid gap-4">
              <input type="text" placeholder="Your name" className="w-full px-4 py-3" />
              <input type="email" placeholder="Your email" className="w-full px-4 py-3" />
              <textarea rows="5" placeholder="Your message" className="w-full px-4 py-3" />
              <button type="button" className="primary-btn w-fit">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
