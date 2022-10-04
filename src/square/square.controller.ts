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
    this.router.get("/catalog", corsOptions, this.getCatalog);
    this.router.post("/orders/update", corsOptions, this.update);
  }

  private getCatalog = async (
    request: express.Request,
    response: express.Response
  ) => {
    const itemList = await this.squareService.getCalatog();
    const serializedItem = JSON.stringify(itemList, (_, v) =>
      typeof v === "bigint" ? `${v}` : v
    );
    const item = JSON.parse(serializedItem);
    response.json(item);
  };

  private update = async (
    request: express.Request,
    response: express.Response
  ) => {
    const { variationId } = request.body;
    const headers = response.getHeaders();
    console.log("headers", { _headers: headers });
    if (headers["square-order"]) {
      console.log("square order exist");
      //const result = await this.squareServices.updateOrder(variationId);
      response.json({ header: headers["square-order"] });
    } else {
      const result = await this.squareService.createOrder(variationId);
      console.log("result from create order::", result);
      response.cookie("square-order", variationId, { httpOnly: true });
      response.json(result);
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
