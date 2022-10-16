import * as express from "express";

export interface RequestWithSquareOrder extends express.Request {
  squareOrder: {
    orderId: string;
    version: string;
  };
}
