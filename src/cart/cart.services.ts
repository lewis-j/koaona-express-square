import {
  OrdersApi,
  PaymentsApi,
  UpdateOrderRequest,
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

      return result.order.version;
    } catch (error) {
      console.error(error);
    }
  };
  private mapOrderReducer = async (order) => {
    if (!order?.lineItems) return { items: [], netAmounts: order.netAmounts };
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

      if (result.order.state === orderState.OPEN) {
        return null;
      }

      const res = await this.checkoutApi.retrievePaymentLink(linkId);

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

  public async clearItems(orderId, lineItems, deletions, locationId) {
    try {
      const version = await this.getOrderVersion(orderId);

      const formatLineItemstoDelete = deletions.map(
        (uid) => `line_items[${uid}]`
      );

      const orderUpdate: UpdateOrderRequest =
        lineItems.length > 0
          ? {
              order: {
                version,
                locationId,
                lineItems,
              },
              fieldsToClear: formatLineItemstoDelete,
            }
          : {
              order: {
                version,
                locationId,
              },
              fieldsToClear: formatLineItemstoDelete,
            };

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
  public async retrieveOrderConfirmation(orderId) {
    const { result: orderResult } = await this.ordersApi.retrieveOrder(orderId);
    const { fulfillments, netAmounts, lineItems, tenders } = orderResult.order;

    const { result: paymentResult } = await this.paymentsApi.getPayment(
      tenders[0].paymentId
    );

    const {
      payment: { receiptUrl },
    } = paymentResult;

    const _lineItems = lineItems.map((lineItem) => {
      return {
        name: lineItem.name,
        quantity: lineItem.quantity,
        id: lineItem.catalogObjectId,
        amountTotal: lineItem.grossSalesMoney,
      };
    });
    const confirmationInfo = {
      lineItems: _lineItems,
      shipping: fulfillments[0].shipmentDetails,
      netAmounts,
      createdAt: tenders[0].createdAt,
      amount: tenders[0].amountMoney,
      receiptUrl,
    };

    return confirmationInfo;
  }
  private createPaymentLinkRequest(lineItem, locationId) {
    const createPaymentLinkRequest: CreatePaymentLinkRequest = {
      idempotencyKey: uuidv4(),
      checkoutOptions: {
        redirectUrl: `${process.env.WHITELIST_URL}/confirmation`,
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
    if (process.env.ENVIRONMENT === "SANDBOX") {
      createPaymentLinkRequest.prePopulatedData = {
        buyerAddress: {
          addressLine1: "po box 111",
          locality: "koana",
          administrativeDistrictLevel1: "CA",
          postalCode: "21562",
          country: "US",
          firstName: "John",
          lastName: "DoeDoe",
        },
        buyerEmail: "testing@testing.com",
        buyerPhoneNumber: "17077757855",
      };
    }

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
      // await this.cancelOrder(orderId, locationId);
      const order = await this.parseOrder(result.relatedResources.orders[0]);
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
