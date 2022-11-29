import e, * as express from "express";
import { RequestWithSquareOrder } from "./cart.interface";
import CartServices from "./cart.services";
import { serializeBigInt } from "../util";
class CartController {
  public path = "/order";
  public router = express.Router();
  private locationId =
    process.env.ENVIRONMENT === "PRODUCTION"
      ? process.env.LOCATION_ID
      : process.env.LOCATION_ID_SANDBOX;
  private squareCookie: string;

  private cartService: CartServices;

  constructor(square) {
    this.intializeRoutes();
    this.squareCookie = "square-order";
    this.cartService = new CartServices(square);
  }
  public intializeRoutes() {
    this.router
      .route(this.path)
      .get(this.squareOrderParser, this.getOrder)
      .put(this.squareOrderParser, this.upsertOrder);
    this.router
      .route(`${this.path}/quantities`)
      .put(this.squareOrderParser, this.updateQuantities);
    this.router
      .route(`${this.path}/clearItems`)
      .put(this.squareOrderParser, this.clearItems);
    this.router
      .route(`${this.path}/confirmation`)
      .get(this.fetchOrderConfirmation);
    this.router.route(`${this.path}/cancel`).put(this.cancel);
  }
  private createCookie(res: express.Response, squareCred) {
    const cookieValue = [squareCred.id, squareCred.linkId].join("#");
    res.cookie(this.squareCookie, cookieValue, { httpOnly: true });
  }
  private serializeAndSendResponse = (response, order) => {
    const serializedOrder = serializeBigInt(order);
    response.json(serializedOrder);
  };
  private setCookieAndSendResponse(response, squareResponse) {
    const { order, cart } = squareResponse;
    this.createCookie(response, { id: order.orderId, linkId: order.linkId });
    const _order = { cart, order };
    this.serializeAndSendResponse(response, _order);
  }
  private selectOrder = ({ body, cookies }) => {
    const squareOrderId = cookies[this.squareCookie];
    if (squareOrderId) return squareOrderId;
    if (body.orderId) return body.orderId;
    return null;
  };
  private squareOrderParser = (
    req: RequestWithSquareOrder,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const order = this.selectOrder(req);
    if (order) {
      const [orderId, linkId] = order.split("#");
      req.squareOrderId = orderId;
      req.squareLinkId = linkId;
    }
    next();
  };
  private getOrder = async (
    request: RequestWithSquareOrder,
    response: express.Response,
    next: express.NextFunction
  ) => {
    const orderId = request.squareOrderId;
    const linkId = request.squareLinkId;
    if (!orderId) {
      response.end();
    } else {
      const squareResponse = await this.cartService.getOrder(orderId, linkId);
      if (!squareResponse) {
        response.clearCookie(this.squareCookie);
        response.end();
      } else {
        this.serializeAndSendResponse(response, squareResponse);
      }
    }
  };
  private upsertOrder = async (
    request: RequestWithSquareOrder,
    response: express.Response,
    next
  ) => {
    const lineItem = request.body.lineItem;
    if (request.squareOrderId) {
      const orderId = request.squareOrderId;
      const order = await this.cartService.updateOrder(
        orderId,
        [lineItem],
        this.locationId
      );
      this.serializeAndSendResponse(response, order);
    } else {
      const squareResponse = await this.cartService.createOrder(
        lineItem,
        this.locationId
      );
      this.setCookieAndSendResponse(response, squareResponse);
    }
  };
  private updateQuantities = async (
    request: RequestWithSquareOrder,
    response: express.Response
  ) => {
    const lineItems = request.body.lineItems;
    const orderId = request.squareOrderId;
    const order = await this.cartService.updateOrder(
      orderId,
      lineItems,
      this.locationId
    );
    this.serializeAndSendResponse(response, order);
  };
  private clearItems = async (
    request: RequestWithSquareOrder,
    response: express.Response
  ) => {
    const { lineItems, deletions } = request.body;
    const orderId = request.squareOrderId;
    const order = await this.cartService.clearItems(
      orderId,
      lineItems,
      deletions,
      this.locationId
    );
    this.serializeAndSendResponse(response, order);
  };
  private fetchOrderConfirmation = async (
    request: express.Request,
    response: express.Response
  ) => {
    const orderId = request.query.orderId;

    if (orderId) {
      const result = await this.cartService.retrieveOrderConfirmation(orderId);
      this.serializeAndSendResponse(response, result);
    } else {
      response.end();
    }
  };

  private cancel = async (
    request: RequestWithSquareOrder,
    response: express.Response
  ) => {
    if (request.squareOrderId) {
      const orderId = request.squareOrderId;
      await this.cartService.cancelOrder(orderId, this.locationId);
    }
    response.clearCookie(this.squareCookie);
    response.send("PUT request called");
  };
}

export default CartController;

// private paymentLink = async (
//   request: RequestWithSquareOrder,
//   response: express.Response
// ) => {
//   if (request.squareOrderId) {
//     // const { customerDetails } = request.body;
//     const orderId = request.squareOrderId;
//     const { link, order, linkId } = await this.cartService.createPaymentLink(
//       orderId
//       // customerDetails
//     );
//     this.setCookieAndSendResponse(response, order);

//     // response.send(link);
//   } else {
//     response.end();
//   }
// };
// private changeQuantity = async (
//   request: RequestWithSquareOrder,
//   response: express.Response,
//   next
// ) => {
//   const lineItems = request.body.lineItems;
//   console.log("items in body", request.body);
//   if (request.squareOrder) {
//     const orderId = request.squareOrder;
//     const order = await this.cartService.updateOrderItems(
//       orderId,
//       lineItems,
//       this.locationId
//     );
//     // console.log("result from updating order::::::::::::::::::", result);
//     this.setCookieAndSendResponse(response, order);
//   } else {
//     const order = await this.cartService.createOrder(
//       lineItems,
//       this.locationId
//     );
//     this.setCookieAndSendResponse(response, order);
//   }
// };

// private addShippingFulfillment = async (
//   request: RequestWithSquareOrder,
//   response: express.Response,
//   next
// ) => {
//   if (!request.squareOrderId) {
//     response.sendStatus(404);
//   } else {
//     const { customerDetails } = request.body;
//     const order = await this.cartService.addShippingFulfillment(
//       request.squareOrderId,
//       this.locationId,
//       customerDetails
//     );
//     return this.setCookieAndSendResponse(response, order);
//   }
// };
// private processPayment = async (
//   request: RequestWithSquareOrder,
//   response: express.Response,
//   next
// ) => {
//   const { token, address, amount } = request.body;

//   if (request.squareOrderId) {
//     const orderId = request.squareOrderId;

//     const orderResult = await this.cartService.prepareOrderProccessing(
//       orderId,
//       address,
//       this.locationId
//     );
//     const result = await this.cartService.processOrder(
//       orderId,
//       token,
//       amount
//     );
//   }
// };
