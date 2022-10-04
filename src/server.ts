import App from "./app";
import SquaresController from "./square/square.controller";

const app = new App([new SquaresController()], 5000);

app.listen();
