import cors from "cors";

var corsOptions = {
  origin: function (origin, callback) {
    const whitelist = ["http://localhost:3000", "https://localhost:3443"];

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
