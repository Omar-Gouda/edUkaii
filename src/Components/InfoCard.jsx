import { motion } from "framer-motion";

const InfoCards = ({ title, data, bgColor = "bg-white", textColor = "text-primary" }) => {
  return (
    <section className={`py-20 ${bgColor} px-6`}>
      <div className="max-w-6xl mx-auto text-center">
        <h2
          className={`text-3xl md:text-4xl font-extrabold ${textColor} mb-12`}
        >
          {title}
        </h2>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {data.map((item, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow duration-300 cursor-pointer"
            >
              <motion.i
                whileHover={{ rotate: 10, scale: 1.2 }}
                className={`${item.icon} text-4xl text-primary mb-4`}
              ></motion.i>

              <h3 className="text-xl font-semibold mb-3 text-gray-900">
                {item.title}
              </h3>
              <p className="text-mutedText">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InfoCards;
