import { Client, Environment, ApiError } from "square";
import * as dotenv from "dotenv";
dotenv.config();

class SquareClient {
  public client: Client;
  constructor() {
    this.client = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: Environment.Production,
    });
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
}
export default SquareClient;
