import CatalogController from "./catalog/catalog.controller";
import App from "./app";
import CartController from "./cart/cart.controller";
import SquareClient from "./square.client";
import { Client } from "square";

const square = new SquareClient();
const { inventoryApi, ordersApi, catalogApi } = square.client;
const ApiErrorHandler = square.ApiErrorHandler;
const app = new App(
  [
    new CatalogController({
      catalogApi,
      inventoryApi,
      ApiErrorHandler,
    }),
    new CartController({ ordersApi, ApiErrorHandler }),
  ],
  5000
);

app.listen();
