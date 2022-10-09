import CatalogController from "./catalog/catalog.controller";
import App from "./app";
import CartController from "./cart/cart.controller";

const app = new App([new CatalogController(), new CartController()], 5000);

app.listen();
