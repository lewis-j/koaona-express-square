import {
  OrdersApi,
  PaymentsApi,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderFulfillment,
  CheckoutApi,
  CreatePaymentLinkRequest,
  InventoryApi,
} from "square";
import * as dotenv from "dotenv";
import { orderState } from "./cart.state";
import { v4 as uuidv4 } from "uuid";
dotenv.config();

class CartServices {
  private ordersApi: OrdersApi;
  private checkoutApi: CheckoutApi;
  private paymentsApi: PaymentsApi;
  private inventoryApi: InventoryApi;
  private apiErrorHandler;
  constructor({
    ordersApi,
    paymentsApi,
    checkoutApi,
    inventoryApi,
    ApiErrorHandler,
  }) {
    this.ordersApi = ordersApi;
    this.paymentsApi = paymentsApi;
    this.apiErrorHandler = ApiErrorHandler;
    this.checkoutApi = checkoutApi;
    this.inventoryApi = inventoryApi;
  }
  private getOrderVersion = async (orderId) => {
    try {
      const { result } = await this.ordersApi.retrieveOrder(orderId);
      console.log("Version::::::::", result.order.version);
      return result.order.version;
    } catch (error) {
      console.error(error);
    }
  };
  private mapOrderReducer = async (order) => {
    const items = order.lineItems.map(async (item) => {
      const { result } = await this.inventoryApi.retrieveInventoryCount(
        item.catalogObjectId
      );
      return {
        id: item.catalogObjectId,
        uid: item.uid,
        quantity: +item.quantity,
        price: item.totalMoney.amount,
        inventory: result.counts[0].quantity,
      };
    });
    console.log("parsed order", {
      items: await Promise.all(items),
      netAmounts: order.netAmounts,
    });
    return {
      items: await Promise.all(items),
      netAmounts: order.netAmounts,
    };
  };

  private parseOrder = async (order) => {
    const parsedOrder = await this.mapOrderReducer(order);

    return parsedOrder;
  };
  public getOrder = async (orderId, linkId) => {
    try {
      const { result } = await this.ordersApi.retrieveOrder(orderId);
      if (result.order.state === orderState.CANCELED) {
        return null;
      }

      const res = await this.checkoutApi.retrievePaymentLink(linkId);

      console.log(
        "result============================================================",
        res.result.paymentLink.url
      );

      const cart = await this.parseOrder(result.order);

      return {
        order: {
          orderId: result.order.id,
          link: res.result.paymentLink.url,
        },
        cart,
      };
    } catch (error) {
      this.apiErrorHandler(error);
      console.error(error);
    }
  };
  public async createOrder(lineItem, locationId) {
    const createPaymentLinkRequest = this.createPaymentLinkRequest(
      lineItem,
      locationId
    );

    const { result } = await this.checkoutApi.createPaymentLink(
      createPaymentLinkRequest
    );
    const order = result.relatedResources.orders[0];
    const cart = await this.parseOrder(order);
    return {
      order: {
        orderId: order.id,
        link: result.paymentLink.url,
        linkId: result.paymentLink.id,
      },
      cart,
    };
  }
  public async updateOrder(orderId, lineItems, locationId) {
    try {
      const version = await this.getOrderVersion(orderId);
      const orderUpdate: UpdateOrderRequest = {
        order: {
          version,
          locationId,
          lineItems,
        },
      };
      const { result } = await this.ordersApi.updateOrder(orderId, orderUpdate);
      return await this.parseOrder(result.order);
    } catch (error) {
      this.apiErrorHandler(error);
      console.error(error);
    }
  }

  public async clearItems(orderId, lineItems, locationId) {
    try {
      const version = await this.getOrderVersion(orderId);
      const {
        result: { order: previousOrder },
      } = await this.ordersApi.retrieveOrder(orderId);
      const previousOrderUids = previousOrder.lineItems.map(({ uid }) => uid);

      const lineItemstoDelete = previousOrderUids.filter(
        (uid) => !lineItems.some((item) => item.uid === uid)
      );

      const formatLineItemstoDelete = lineItemstoDelete.map(
        (uid) => `line_items[${uid}]`
      );

      const orderUpdate: UpdateOrderRequest = {
        order: {
          version,
          locationId,
        },
        fieldsToClear: formatLineItemstoDelete,
      };
      console.log(
        "formatLineItemstoDelete================================================",
        formatLineItemstoDelete
      );
      const { result } = await this.ordersApi.updateOrder(orderId, orderUpdate);
      return await this.parseOrder(result.order);
    } catch (error) {
      this.apiErrorHandler(error);
      console.error(error);
    }
  }

  public async cancelOrder(orderId, locationId) {
    try {
      const version = await this.getOrderVersion(orderId);
      const orderUpdate = {
        order: {
          locationId: locationId,
          version: version,
          state: "CANCELED",
        },
      };
      return await this.ordersApi.updateOrder(orderId, orderUpdate);
    } catch (error) {}
  }

  public async draftAllOrders(locationId) {
    const orders = await this.ordersApi.searchOrders({
      locationIds: [locationId],
    });
    const orderResults = orders.result.orders.map(async (order, i) => {
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

  private createPaymentLinkRequest(lineItem, locationId) {
    const createPaymentLinkRequest: CreatePaymentLinkRequest = {
      idempotencyKey: uuidv4(),
      checkoutOptions: {
        askForShippingAddress: true,
      },
      order: {
        locationId: locationId,
        lineItems: [lineItem],
        state: "DRAFT",
        pricingOptions: { autoApplyTaxes: true },
        serviceCharges: [
          {
            amountMoney: {
              amount: BigInt(process.env.SHIPPING_AMOUNT),
              currency: "USD",
            },
            name: "Shipping",
            calculationPhase: "TOTAL_PHASE",
          },
        ],
      },
    };

    return createPaymentLinkRequest;
  }
  public async createPaymentLink(orderId /*customerDetails*/) {
    // const { shipping, payment } = customerDetails;
    // const fulfillment = this.fulfillmentObjectFromShippingDetails(shipping);
    try {
      const { result: orderResult } = await this.ordersApi.retrieveOrder(
        orderId
      );

      const { lineItems, locationId } = orderResult.order;

      const _lineItems = lineItems.map(({ catalogObjectId, quantity }) => ({
        catalogObjectId,
        quantity,
      }));

      const createPaymentLinkRequest = this.createPaymentLinkRequest(
        _lineItems,
        locationId
      );

      const { result } = await this.checkoutApi.createPaymentLink(
        createPaymentLinkRequest
      );
      console.log("result from payment link", result);
      // await this.cancelOrder(orderId, locationId);
      const order = await this.parseOrder(result.relatedResources.orders[0]);
      console.log("order", order);
      console.log("return object", {
        link: result.paymentLink.url,
        order,
        linkId: result.paymentLink.id,
      });
      return {
        link: result.paymentLink.url,
        order,
        linkId: result.paymentLink.id,
      };
    } catch (error) {
      this.apiErrorHandler(error);
      console.error(error);
    }
  }
}

export default CartServices;

// private fulfillmentObjectFromShippingDetails(shipping) {
//   const shippingFulfillment: OrderFulfillment = {
//     type: "SHIPMENT",
//     state: "PROPOSED",
//     shipmentDetails: {
//       carrier: "FedEx",
//       shippingType: "2 Day USA",
//       recipient: {
//         displayName: `${shipping.firstName} ${shipping.lastName}`,
//         emailAddress: shipping.email,
//         phoneNumber: shipping.phone,
//         address: {
//           addressLine1: shipping.addressLine1,
//           addressLine2: shipping.addressLine2,
//           locality: shipping.city,
//           administrativeDistrictLevel1: shipping.region,
//           country: shipping.country,
//           postalCode: shipping.postalCode,
//           firstName: shipping.firstName,
//           lastName: shipping.lastName,
//         },
//       },
//     },
//   };

//   return shippingFulfillment;
// }
// public async addShippingFulfillment(orderId, locationId, customerDetails) {
//   // const { version, orderId } = squareDetails;
//   const shippingFulfillment =
//     this.fulfillmentObjectFromShippingDetails(customerDetails);

//   try {
//     const version = await this.getOrderVersion(orderId);
//     const orderUpdate: UpdateOrderRequest = {
//       order: {
//         version,
//         locationId,
//         fulfillments: [shippingFulfillment],
//       },
//     };
//     const { result } = await this.ordersApi.updateOrder(orderId, orderUpdate);
//     return this.parseOrder(result.order);
//   } catch (error) {
//     this.apiErrorHandler(error);
//     console.error(error);
//   }
// }

// public async processOrder(orderId, token: string, amount) {
//   // const paymentRequest: CreatePaymentRequest = {
//   //   sourceId: token,
//   //   idempotencyKey: uuidv4(),
//   //   amountMoney: {
//   //     amount: amount,
//   //     currency: "USD"
//   //   },
//   //   orderId: orderId
//   // }
//   // try {
//   //   //TODO: call paymentApi endpoint with appropriate data
//   //   this.paymentsApi.createPayment(paymentRequest);
//   //   this.paymentsApi.
//   // } catch (error) {
//   //   console.log(error);
//   // }
// }
// public async prepareOrderProccessing(orderId, address, locationId) {
//   // const { version, orderId } = squareDetails;
//   // const orderUpdate = {
//   //   order: {
//   //     version,
//   //     locationId,
//   //     lineItems,
//   //   },
//   // };
//   // try {
//   //   const updatedOrder = await this.ordersApi.updateOrder(
//   //     orderId,
//   //     orderUpdate
//   //   );
//   //   return updatedOrder;
//   // } catch (error) {
//   //   this.apiErrorHandler(error);
//   //   console.error(error);
//   // }
// }
