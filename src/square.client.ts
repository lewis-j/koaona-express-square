import { Client, Environment, ApiError } from "square";
import * as dotenv from "dotenv";
dotenv.config();

class SquareClient {
  public client: Client;
  constructor() {
    const config = this.getClientConfig();
    this.client = new Client(config);
  }

  public ApiErrorHandler(error) {
    if (error instanceof ApiError) {
      error.result.errors.forEach(function (e) {
        console.log(e.category);
        console.log(e.code);
        console.log(e.detail);
      });
    }
  }

  private getClientConfig() {
    if (process.env.ENVIRONMENT === "PRODUCTION") {
      return {
        accessToken: process.env.SQUARE_ACCESS_TOKEN,
        environment: Environment.Production,
      };
    } else if (process.env.ENVIRONMENT === "SANDBOX") {
      return {
        accessToken: process.env.SQUARE_ACCESS_TOKEN_SANDBOX,
        environment: Environment.Sandbox,
      };
    }
  }
}
export default SquareClient;
