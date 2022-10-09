import { Client, Environment, ApiError, OrdersApi } from "square";
import * as dotenv from "dotenv";
dotenv.config();

class CartServices {
  private ordersApi: OrdersApi;
  private apiErrorHandler;
  constructor({ ordersApi, ApiErrorHandler }) {
    this.ordersApi = ordersApi;
    this.apiErrorHandler = ApiErrorHandler;
  }

  public getOrder = async (OrderId = "OTh0mbkDuNwsTg0hA3o2zVvK7yLZY") => {
    try {
      const result = await this.ordersApi.retrieveOrder(OrderId);
      return result.result.order;
    } catch (error) {
      this.apiErrorHandler(error);
      console.log(error);
    }
  };

  public async createOrder(variationId, locationId) {
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

    const result = await this.ordersApi.retrieveOrder(
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
