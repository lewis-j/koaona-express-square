import * as express from "express";

export interface RequestWithSquareOrder extends express.Request {
  squareOrderId: string;
  squareLinkId: string;
}
