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

  public mapCartReducer = (lineItems) => {
    return lineItems.map((item) => ({
      id: item.catalogObjectId,
      uid: item.uid,
      quantity: +item.quantity,
    }));
  };

  public getOrder = async (orderId) => {
    try {
      const result = await this.ordersApi.retrieveOrder(orderId);
      console.log("result in get order", result.result.order.version);

      const cart = this.mapCartReducer(result.result.order.lineItems);
      return cart;
    } catch (error) {
      this.apiErrorHandler(error);
      console.log(error);
    }
  };

  public async createOrder(lineItems, locationId) {
    const order = {
      order: {
        locationId: locationId,
        lineItems,
        state: "DRAFT",
      },
    };

    const result = await this.ordersApi.createOrder(order);

    console.log("result in create order api", result.result.order);

    return result;
  }

  public async updateOrder(squareDetails, lineItems, locationId) {
    console.log("line items", lineItems);
    const orderUpdate = {
      order: {
        version: squareDetails.version,
        locationId: locationId,
        lineItems: lineItems,
      },
    };
    try {
      const updatedOrder = await this.ordersApi.updateOrder(
        squareDetails.orderId,
        orderUpdate
      );
      return updatedOrder;
    } catch (error) {
      this.apiErrorHandler(error);
      console.log(error);
    }

    // console.log("update result", updatedOrder);
  }
  public async CancelOrder(orderId, locationId, version) {
    const orderUpdate = {
      order: {
        locationId: locationId,
        version: version,
        state: "CANCELED",
      },
    };
    return await this.ordersApi.updateOrder(orderId, orderUpdate);
  }
  public async draftAllOrders(locationId) {
    console.log("running draft order");
    const orders = await this.ordersApi.searchOrders({
      locationIds: [locationId],
    });
    console.log("orders", orders);
    const orderResults = orders.result.orders.map(async (order, i) => {
      console.log("order:", i, order.id);
      const orderUpdate = {
        order: {
          locationId: locationId,
          version: order.version,
          state: "CANCELED",
        },
      };
      return await this.ordersApi.updateOrder(order.id, orderUpdate);
    });
    return await Promise.all(orderResults);
  }
}

export default CartServices;
