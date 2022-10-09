import * as express from "express";
import Square from "./square.interface";
import SquareService from "./square.service";
import corsOptions from "../corsConfig";
class SquaresController {
  public path = "/items";
  public router = express.Router();

  private squares: Square[] = [
    {
      author: "Marcin",
      content: "Dolor sit amet",
      title: "Lorem Ipsum",
    },
  ];
  private squareService: SquareService;

  constructor() {
    this.intializeRoutes();
    this.squareService = new SquareService();
  }

  public intializeRoutes() {
    this.router.get("/catalog", this.getCatalog);

    this.router.post("/orders/update", this.update);
  }

  private getCatalog = async (
    request: express.Request,
    response: express.Response
  ) => {
    console.log("getting catalog");
    const itemList = await this.squareService.getCalatog();
    const serializedItem = JSON.stringify(itemList, (_, v) =>
      typeof v === "bigint" ? `${v}` : v
    );
    const item = JSON.parse(serializedItem);
    response.json(item);
  };

  private update = async (
    request: express.Request,
    response: express.Response,
    next
  ) => {
    const { variationId, locationId } = request.body;
    if (false) {
      console.log("square order exist", request.cookies["square-order"]);
      const _variationId = request.cookies["square-order"];
      const result = await this.squareService.updateOrder(variationId);
      response.json(result);
    } else {
      const { result, body } = await this.squareService.createOrder(
        variationId,
        locationId
      );
      console.log("result from create order::", result.order.lineItems);
      response.cookie("square-order", result.order.id, { httpOnly: true });
      response.json(body);
      next();
    }
  };

  // private getAllItems = async (
  //   request: express.Request,
  //   response: express.Response
  // ) => {
  //   const itemList = await this.squareService.getItemList();
  //   const serializedItem = JSON.stringify(itemList, (_, v) =>
  //     typeof v === "bigint" ? `${v}` : v
  //   );
  //   const item = JSON.parse(serializedItem);
  //   response.send(serializedItem);
  // };

  private createASquare = async (
    request: express.Request,
    response: express.Response
  ) => {
    const square: Square = request.body;
    this.squares.push(square);
    response.send(square);
  };
}

export default SquaresController;
