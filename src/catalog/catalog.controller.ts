import * as express from "express";
import CatalogService from "./catalog.services";
import CatalogServices from "./catalog.services";
class CatalogController {
  public path = "/catalog";
  public router = express.Router();
  private catalogService: CatalogServices;

  constructor(square) {
    this.intializeRoutes();
    this.catalogService = new CatalogService(square);
  }

  public intializeRoutes() {
    this.router.route(this.path).get(this.getCatalog);
  }

  private getCatalog = async (
    request: express.Request,
    response: express.Response
  ) => {
    console.log("getting catalog");
    const itemList = await this.catalogService.getCalatog();
    const serializedItem = JSON.stringify(itemList, (_, v) =>
      typeof v === "bigint" ? `${v}` : v
    );
    const item = JSON.parse(serializedItem);
    response.json(item);
  };
}

export default CatalogController;
