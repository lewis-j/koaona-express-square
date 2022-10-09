import { Client, Environment, ApiError } from "square";
import * as dotenv from "dotenv";
dotenv.config();

class CartServices {
  private client: Client;
  constructor() {
    this.client = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: Environment.Production,
    });
  }

  private ApiErrorHandler(error) {
    if (error instanceof ApiError) {
      error.result.errors.forEach(function (e) {
        console.log(e.category);
        console.log(e.code);
        console.log(e.detail);
      });
    }
  }

  public async createOrder(variationId, locationId) {
    const { ordersApi } = this.client;

    // const order = {
    //   order: {
    //     locationId: locationId,
    //     lineItems: [
    //       {
    //         catalogObjectId: variationId,
    //         quantity: "1",
    //       },
    //     ],
    //   },
    // };

    const result = await ordersApi.retrieveOrder(
      "OTh0mbkDuNwsTg0hA3o2zVvK7yLZY"
    );

    console.log("result in api", result.result.order.version);

    const orderUpdate = {
      order: {
        version: result.result.order.version,
        locationId: locationId,
        lineItems: [
          {
            catalogObjectId: "JHO2HWQBYCLDSAZDP5ZH7TPL",
            quantity: "1",
          },
        ],
      },
    };

    // const updatedOrder = await ordersApi.updateOrder(
    //   "OTh0mbkDuNwsTg0hA3o2zVvK7yLZY",
    //   orderUpdate
    // );

    // console.log("update result", updatedOrder);

    return result;
  }

  public async updateOrder(variationId) {
    console.log("updating order", variationId);
  }
}

export default CartServices;
