import * as express from "express";
import CatalogServices from "./catalog.services";
import multer from "multer";
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname + "-" + Date.now());
  },
});
var upload = multer({ storage: storage });
// var upload = multer();

class CatalogController {
  public path = "/catalog";
  public router = express.Router();
  private catalogService: CatalogServices;

  constructor(square) {
    this.intializeRoutes();
    this.catalogService = new CatalogServices(square);
  }

  private intializeRoutes() {
    this.router.route(this.path).get(this.getCatalog);

    this.router
      .route(`${this.path}/img/upload`)
      .post(upload.single("myImage"), async (req, res, next) => {
        await this.catalogService.uploadImage(req.file.path);
        res.send(req.file.path);
      });
  }

  private getCatalog = async (
    request: express.Request,
    response: express.Response
  ) => {
    const itemList = await this.catalogService.getCalatog();
    const serializedItem = JSON.stringify(itemList, (_, v) =>
      typeof v === "bigint" ? `${v}` : v
    );
    const item = JSON.parse(serializedItem);
    response.json(item);
  };
}

export default CatalogController;
