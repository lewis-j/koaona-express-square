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
      .get(this.squareCookieParser, this.getOrder)
      .put(this.squareCookieParser, this.update);
    this.router
      .route(`${this.path}/process`)
      .post(this.squareCookieParser, this.processPayment);
    this.router
      .route(`${this.path}/shipping`)
      .put(this.squareCookieParser, this.addShippingFulfillment);
    this.router
      .route(`${this.path}/paymentLink`)
      .post(this.squareCookieParser, this.paymentLink);
    this.router.route(`${this.path}/cancel`).put(this.cancel);
  }
  private createCookie(res: express.Response, squareCred) {
    const cookieValue = [squareCred.id, squareCred.version].join("#");
    console.log("Cookie value", cookieValue);
    res.cookie(this.squareCookie, cookieValue, { httpOnly: true });
  }
  private setCookieAndSendResponse(response, order) {
    const { cart, orderId, version } = order;
    this.createCookie(response, { id: orderId, version });
    const serializedOrder = serializeBigInt(cart);
    response.json(serializedOrder);
  }
  private squareCookieParser = (
    req: RequestWithSquareOrder,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const squareCookie = req.cookies[this.squareCookie];
    console.log("square Cookie in parser", squareCookie);
    if (squareCookie) {
      const [orderId, version] = squareCookie.split("#");
      req.squareOrder = { orderId, version };
    } else {
      req.squareOrder = null;
    }
    next();
  };
  private getOrder = async (
    request: RequestWithSquareOrder,
    response: express.Response,
    next: express.NextFunction
  ) => {
    if (!request.squareOrder) {
      response.end();
    } else {
      const { orderId } = request.squareOrder;
      if (!orderId) {
        const error = {
          message: `Order does not exist!`,
          status: 404,
        };
        next(error);
      } else {
        const order = await this.cartService.getOrder(orderId);
        if (!order?.cart) {
          response.clearCookie(this.squareCookie);
          response.end();
        } else {
          this.setCookieAndSendResponse(response, order);
        }
      }
    }
  };
  private update = async (
    request: RequestWithSquareOrder,
    response: express.Response,
    next
  ) => {
    const lineItems = request.body.lineItems;
    console.log("items in body", request.body);
    if (request.squareOrder) {
      const squareDetails = request.squareOrder;
      const order = await this.cartService.updateOrderItems(
        squareDetails,
        lineItems,
        this.locationId
      );
      // console.log("result from updating order::::::::::::::::::", result);
      this.setCookieAndSendResponse(response, order);
    } else {
      const order = await this.cartService.createOrder(
        lineItems,
        this.locationId
      );
      this.setCookieAndSendResponse(response, order);
    }
  };
  private addShippingFulfillment = async (
    request: RequestWithSquareOrder,
    response: express.Response,
    next
  ) => {
    if (!request.squareOrder) {
      response.sendStatus(404);
    } else {
      const { customerDetails } = request.body;
      const order = await this.cartService.addShippingFulfillment(
        request.squareOrder,
        this.locationId,
        customerDetails
      );
      return this.setCookieAndSendResponse(response, order);
    }
  };
  private processPayment = async (
    request: RequestWithSquareOrder,
    response: express.Response,
    next
  ) => {
    const { token, address, amount } = request.body;

    console.log("items in body", request.body);
    if (request.squareOrder) {
      const squareDetails = request.squareOrder;

      const orderResult = await this.cartService.prepareOrderProccessing(
        squareDetails,
        address,
        this.locationId
      );
      const result = await this.cartService.processOrder(
        squareDetails,
        token,
        amount
      );
    }
  };
  private paymentLink = async (
    request: RequestWithSquareOrder,
    response: express.Response
  ) => {
    if (request.squareOrder) {
      // const { customerDetails } = request.body;
      const squareDetails = request.squareOrder;
      const paymentLinkUrl = await this.cartService.createPaymentLink(
        squareDetails
        // customerDetails
      );
      console.log("paymentLinkUrl", paymentLinkUrl);
      response.send(paymentLinkUrl);
    } else {
      response.end();
    }
  };
  private cancel = async (
    request: RequestWithSquareOrder,
    response: express.Response
  ) => {
    if (request.squareOrder) {
      const { orderId, version } = request.squareOrder;
      await this.cartService.cancelOrder(orderId, this.locationId, version);
      console.log("square order exist");
    }
    response.clearCookie(this.squareCookie);
    response.send("PUT request called");
  };
}

export default CartController;
