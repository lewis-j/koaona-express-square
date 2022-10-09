import * as express from "express";
import CartServices from "./cart.services";
class CartController {
  public path = "/order";
  public router = express.Router();

  private cartService: CartServices;

  constructor(square) {
    this.intializeRoutes();
    this.cartService = new CartServices(square);
  }

  public intializeRoutes() {
    this.router.route(this.path).get(this.getOrder).put(this.update);
  }

  private update = async (
    request: express.Request,
    response: express.Response,
    next
  ) => {
    const { variationId, locationId } = request.body;
    if (false) {
      console.log("square order exist", request.cookies["square-order"]);
      const _variationId = request.cookies["square-order"];
      const result = await this.cartService.updateOrder(variationId);
      response.json(result);
    } else {
      const { result, body } = await this.cartService.createOrder(
        variationId,
        locationId
      );
      console.log("result from create order::", result.order.lineItems);
      response.cookie("square-order", result.order.id, { httpOnly: true });
      response.json(body);
      next();
    }
  };
  private getOrder = async (
    request: express.Request,
    response: express.Response
  ) => {
    const orderId = request.cookies["square-order"];
    if (!orderId) {
      response.status(200);
      response.end();
    }
    this.cartService.getOrder(orderId);
  };
}

export default CartController;
