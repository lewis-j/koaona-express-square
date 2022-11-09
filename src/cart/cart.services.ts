import {
  Client,
  Environment,
  ApiError,
  OrdersApi,
  PaymentsApi,
  CreatePaymentRequest,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderFulfillment,
  CheckoutApi,
  CreatePaymentLinkRequest,
  CreateCheckoutRequest,
  Order,
  PrePopulatedData,
} from "square";
import * as dotenv from "dotenv";
import { orderState } from "./cart.state";
import { v4 as uuidv4 } from "uuid";
dotenv.config();

class CartServices {
  private ordersApi: OrdersApi;
  private checkoutApi: CheckoutApi;
  private paymentsApi: PaymentsApi;
  private apiErrorHandler;
  constructor({ ordersApi, paymentsApi, checkoutApi, ApiErrorHandler }) {
    this.ordersApi = ordersApi;
    this.paymentsApi = paymentsApi;
    this.apiErrorHandler = ApiErrorHandler;
    this.checkoutApi = checkoutApi;
  }

  private mapOrderReducer = (order) => {
    const items = order.lineItems.map((item) => {
      return {
        id: item.catalogObjectId,
        uid: item.uid,
        quantity: +item.quantity,
        price: item.totalMoney.amount,
      };
    });
    return {
      items,
      netAmounts: order.netAmounts,
    };
  };
  private parseOrder = (order) => {
    const cart = this.mapOrderReducer(order);

    return { cart, orderId: order.id, version: order.version };
  };
  public getOrder = async (orderId) => {
    try {
      const { result } = await this.ordersApi.retrieveOrder(orderId);
      if (result.order.state === orderState.CANCELED) {
        return null;
      }

      return this.parseOrder(result.order);
    } catch (error) {
      this.apiErrorHandler(error);
      console.error(error);
    }
  };
  public async createOrder(lineItems, locationId) {
    const order: CreateOrderRequest = {
      order: {
        locationId: locationId,
        lineItems,
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

    const { result } = await this.ordersApi.createOrder(order);

    return this.parseOrder(result.order);
  }
  public async updateOrderItems(squareDetails, lineItems, locationId) {
    const { version, orderId } = squareDetails;
    const orderUpdate: UpdateOrderRequest = {
      order: {
        version,
        locationId,
        lineItems,
      },
    };
    try {
      const { result } = await this.ordersApi.updateOrder(orderId, orderUpdate);
      return this.parseOrder(result.order);
    } catch (error) {
      this.apiErrorHandler(error);
      console.error(error);
    }
  }
  public async addShippingFulfillment(
    squareDetails,
    locationId,
    customerDetails
  ) {
    const { version, orderId } = squareDetails;

    const {
      lastName,
      firstName,
      addressLine1,
      addressLine2,
      city,
      region,
      postalCode,
      country,
      email,
      phone,
    } = customerDetails;
    const shippingFulfillment: OrderFulfillment = {
      shipmentDetails: {
        carrier: "FedEx",
        shippingType: "2 Day USA",
        recipient: {
          displayName: `${firstName} ${lastName}`,
          emailAddress: email,
          phoneNumber: phone,
          address: {
            addressLine1: addressLine1,
            addressLine2: addressLine2,
            locality: city,
            //state
            administrativeDistrictLevel1: region,
            country,
            postalCode,
            firstName,
            lastName,
          },
        },
      },
    };
    const orderUpdate: UpdateOrderRequest = {
      order: {
        version,
        locationId,
        fulfillments: [shippingFulfillment],
      },
    };
    try {
      const { result } = await this.ordersApi.updateOrder(orderId, orderUpdate);
      return this.parseOrder(result.order);
    } catch (error) {
      this.apiErrorHandler(error);
      console.error(error);
    }
  }
  public async cancelOrder(orderId, locationId, version) {
    const orderUpdate = {
      order: {
        locationId: locationId,
        version: version,
        state: "CANCELED",
      },
    };
    return await this.ordersApi.updateOrder(orderId, orderUpdate);
  }
  public async processOrder(squareDetails, token: string, amount) {
    const { version, orderId } = squareDetails;

    // const paymentRequest: CreatePaymentRequest = {
    //   sourceId: token,
    //   idempotencyKey: uuidv4(),
    //   amountMoney: {
    //     amount: amount,
    //     currency: "USD"
    //   },
    //   orderId: orderId
    // }
    // try {
    //   //TODO: call paymentApi endpoint with appropriate data
    //   this.paymentsApi.createPayment(paymentRequest);
    //   this.paymentsApi.
    // } catch (error) {
    //   console.log(error);
    // }
  }
  public async prepareOrderProccessing(squareDetails, address, locationId) {
    // const { version, orderId } = squareDetails;
    // const orderUpdate = {
    //   order: {
    //     version,
    //     locationId,
    //     lineItems,
    //   },
    // };
    // try {
    //   const updatedOrder = await this.ordersApi.updateOrder(
    //     orderId,
    //     orderUpdate
    //   );
    //   return updatedOrder;
    // } catch (error) {
    //   this.apiErrorHandler(error);
    //   console.error(error);
    // }
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
  public async createPaymentLink(squareDetails /*customerDetails*/) {
    const { orderId } = squareDetails;
    // const { shipping, payment } = customerDetails;

    // const shippingFulfillment: OrderFulfillment = {
    //   type: "SHIPMENT",
    //   state: "PROPOSED",
    //   shipmentDetails: {
    //     carrier: "FedEx",
    //     shippingType: "2 Day USA",
    //     recipient: {
    //       displayName: `${shipping.firstName} ${shipping.lastName}`,
    //       emailAddress: shipping.email,
    //       phoneNumber: shipping.phone,
    //       address: {
    //         addressLine1: shipping.addressLine1,
    //         addressLine2: shipping.addressLine2,
    //         locality: shipping.city,
    //         administrativeDistrictLevel1: shipping.region,
    //         country: shipping.country,
    //         postalCode: shipping.postalCode,
    //         firstName: shipping.firstName,
    //         lastName: shipping.lastName,
    //       },
    //     },
    //   },
    // };

    // const prePopulatedData: PrePopulatedData = {
    //   buyerEmail: payment.email,
    //   buyerPhoneNumber: "1-707-869-2284",
    //   buyerAddress: {
    //     addressLine1: payment.addressLine1,
    //     addressLine2: payment.addressLine2,
    //     locality: payment.city,
    //     administrativeDistrictLevel1: payment.region,
    //     country: payment.country,
    //     postalCode: payment.postalCode,
    //     firstName: payment.firstName,
    //     lastName: payment.lastName,
    //   },
    // };

    try {
      const { result: orderResult } = await this.ordersApi.retrieveOrder(
        orderId
      );

      const { lineItems, locationId, version } = orderResult.order;

      const _lineItems = lineItems.map(({ catalogObjectId, quantity }) => ({
        catalogObjectId,
        quantity,
      }));

      const createPaymentLinkRequest: CreatePaymentLinkRequest = {
        idempotencyKey: uuidv4(),
        checkoutOptions: {
          askForShippingAddress: true,
        },
        order: {
          lineItems: _lineItems,
          locationId,
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

      const { result } = await this.checkoutApi.createPaymentLink(
        createPaymentLinkRequest
      );
      await this.cancelOrder(orderId, locationId, version);

      console.log("paymentLink results", result);
      // return this.parseOrder(result.order);
      return result.paymentLink.url;
    } catch (error) {
      this.apiErrorHandler(error);
      console.log(error);
    }
  }
}

export default CartServices;
