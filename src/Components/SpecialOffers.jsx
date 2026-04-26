import { Link } from "react-router-dom";

const Offers = () => {
  const offers = [
    {
      title: "Early Bird Discount",
      description: "Register this month and get ",
      highlight: "10% off",
    },
    {
      title: "Referral Rewards",
      description: "Bring a friend and both receive ",
      highlight: "exclusive bonuses",
    },
    {
      title: "Limited-Time Bundle",
      description: "Sign up for 2 courses and get ",
      highlight: "50% off the 3rd",
    },
  ];

  return (
    <section
      id="offers"
      aria-labelledby="offers-title"
      className="bg-purple-50 px-6 py-16 md:px-12"
    >
      <div className="container mx-auto text-center">
        <h3
          id="offers-title"
          className="section-title mb-12 text-4xl font-extrabold text-gray-800 md:text-5xl"
        >
          Special Offers
        </h3>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <div
              key={offer.title}
              className="flex flex-col items-center rounded-2xl bg-white p-8 text-center shadow-lg transition-transform duration-300 hover:scale-105 hover:shadow-2xl"
            >
              <h4 className="mb-3 text-2xl font-bold text-purple-600">{offer.title}</h4>
              <p className="text-lg text-gray-700">
                {offer.description}
                <span className="font-semibold text-purple-700">{offer.highlight}</span>
              </p>
              <Link
                to="/signup"
                className="mt-6 rounded-full bg-purple-600 px-6 py-3 font-semibold text-white transition-colors duration-300 hover:bg-purple-700"
              >
                Claim Offer
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Offers;
