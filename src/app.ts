import express from "express";
import bodyParser from "body-parser";
import Controller from "intereface/controller.interface";
import cookieParser from "cookie-parser";
import errorMiddleware from "./middleware/error.middleware";
import * as dotenv from "dotenv";
dotenv.config();

class App {
  public app: express.Application;
  public port: number;
  // public whitelist: string[];

  constructor(controllers, port) {
    this.app = express();
    this.port = port;
    // this.whitelist = ["http://localhost:3000", "https://localhost:3443"];

    this.initializeMiddlewares();
    this.initializeControllers(controllers);
    this.initializeErrorHandling();
  }

  private initializeMiddlewares() {
    this.app.use(bodyParser.json());
    this.app.use(function (rex, res, next) {
      res.setHeader("Access-Control-Allow-Origin", process.env.WHITELIST_URL);
      next();
    });
    this.app.use(cookieParser(process.env.COOKIE_SECRET));

    // this.app.use(cors(corsOptions));
  }

  private initializeControllers(controllers: Controller[]) {
    controllers.forEach((controller) => {
      this.app.use("/", controller.router);
    });
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }
  public listen() {
    this.app.listen(this.port, () => {
      console.log(`App listening on the port ${this.port}`);
    });
  }
}

export default App;
