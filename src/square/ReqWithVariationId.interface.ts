import { Request } from "express";

export default class ReqWithVariationId extends Request {
  private readonly variationId: string;
}
