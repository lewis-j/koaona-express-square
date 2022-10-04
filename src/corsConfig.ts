import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

var corsOptions = {
  origin: function (origin, callback) {
    const whitelist = [process.env.WHITELIST_URL];

    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("error");
      callback({
        message: "Not Allowed by Cors in Square Koana Api",
        status: 401,
      });
    }
  },
};

export default cors(corsOptions);
