import e, * as express from "express";
import { RequestWithSquareOrder } from "./cart.interface";
import CartServices from "./cart.services";
import { serializeBigInt } from "../util";
class CartController {
  public path = "/order";
  public router = express.Router();
  private locationId = process.env.LOCATION_ID || "";
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
    this.router.route(`${this.path}/cancel`).put(this.cancel);
  }
  private createCookie(res: express.Response, order) {
    const cookieValue = [order.id, order.version].join("#");
    console.log("Cookie value", cookieValue);
    res.cookie(this.squareCookie, cookieValue, { httpOnly: true });
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

  private update = async (
    request: RequestWithSquareOrder,
    response: express.Response,
    next
  ) => {
    const lineItems = request.body.lineItems;
    console.log("items in body", request.body);
    if (request.squareOrder) {
      const squareDetails = request.squareOrder;
      const { result } = await this.cartService.updateOrder(
        squareDetails,
        lineItems,
        this.locationId
      );
      console.log("result from updating order::::::::::::::::::", result);
      this.createCookie(response, result.order);

      const listItems = this.cartService.mapCartReducer(result.order.lineItems);

      // const serializedOrder = serializeBigInt(_order);
      response.json(listItems);
    } else {
      const { result } = await this.cartService.createOrder(
        lineItems,
        this.locationId
      );
      this.createCookie(response, result.order);
      const listItems = this.cartService.mapCartReducer(result.order.lineItems);
      response.json(listItems);
    }
  };
  private getOrder = async (
    request: RequestWithSquareOrder,
    response: express.Response,
    next: express.NextFunction
  ) => {
    const { orderId } = request.squareOrder;
    console.log("OrderId", orderId);
    if (!orderId) {
      const error = {
        message: `Order does not exist!`,
        status: 404,
      };
      next(error);
    } else {
      const order = await this.cartService.getOrder(orderId);
      console.log("RESULTS FROM GET ORDER:::::::::::::::", order);
      // const serializedOrder = serializeBigInt(order);
      response.json(order);
    }
  };
  private cancel = async (
    request: RequestWithSquareOrder,
    response: express.Response,
    next: express.NextFunction
  ) => {
    if (request.squareOrder) {
      const { orderId, version } = request.squareOrder;
      await this.cartService.CancelOrder(orderId, this.locationId, version);
      console.log("square order exist");
    }
    response.clearCookie(this.squareCookie);
    response.send("PUT request called");
  };
}

export default CartController;
