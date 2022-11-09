import {
  Client,
  Environment,
  ApiError,
  InventoryApi,
  CatalogApi,
  CatalogObject,
  BatchUpsertCatalogObjectsRequest,
  CreateCatalogImageRequest,
  FileWrapper,
} from "square";

import fs from "fs-extra";

import FormData from "form-data";

import * as dotenv from "dotenv";
dotenv.config();
import Item, { SquareItem } from "./item.interface";
import { v4 as uuidv4 } from "uuid";

interface catalogItem {
  ITEM?: { id: string; customAttributeValues?: any[]; itemData: any }[];
  IMAGE?: { id: string; imageData: any }[];
  CATEGORY?: { id: string; categoryData: any }[];
}

class CatalogServices {
  private inventoryApi: InventoryApi;
  private catalogApi: CatalogApi;
  private ApiErrorHandler;
  constructor({ catalogApi, inventoryApi, ApiErrorHandler }) {
    this.catalogApi = catalogApi;
    this.inventoryApi = inventoryApi;
    this.ApiErrorHandler = ApiErrorHandler;
  }

  public async getCalatog(): Promise<SquareItem[]> {
    try {
      const res = await this.catalogApi.listCatalog(
        undefined,
        "ITEM,IMAGE,CATEGORY"
      );

      const itemData = res.result.objects.map((item) => {
        return item.itemData;
      });

      const {
        ITEM: items,
        IMAGE: images,
        CATEGORY: categories,
      }: catalogItem = res.result.objects.reduce((acc, cur) => {
        if (cur.isDeleted) return acc;
        return { ...acc, [cur.type]: [...(acc[cur.type] || []), cur] };
      }, {});

      const _items: Promise<SquareItem>[] = items.map(async (item) => {
        const _customAttributes = item?.customAttributeValues
          ? Object.values(item.customAttributeValues).reduce(
              (acc, { name, stringValue }) => {
                return { ...acc, [name.toLowerCase()]: stringValue };
              },
              {}
            )
          : { weight: null, unit: null };

        const { name, description, categoryId, variations, imageIds } =
          item.itemData;

        const _category =
          categories.find((category) => category.id === categoryId)
            ?.categoryData.name || "undefined";

        const _variations = await variations.reduce(
          async (filtered, variation) => {
            const _filtered = await filtered;

            if (variation.isDeleted) return _filtered;

            const { imageIds, name, priceMoney } = variation.itemVariationData;

            const inventoryItem =
              await this.inventoryApi.retrieveInventoryCount(variation.id);

            return [
              ..._filtered,
              {
                imageIds,
                id: variation.id,
                name,
                priceMoney,
                inventory: inventoryItem.result.counts[0].quantity,
              },
            ];
          },
          []
        );

        const _imagesData = imageIds
          ? imageIds.map((imageId) => {
              const _image = images.find((image) => image.id === imageId);
              if (_image) return _image.imageData.url;
              // return {
              //   ..._image.imageData,
              //   name: _image.imageData.name.replace(/_|.jpg/g, " ").trim(),
              // };
            })
          : [null];

        const _price = Number(_variations[0].priceMoney.amount) / 100;
        return {
          id: _variations[0].id,
          name: name,
          cat: _category,
          desc: description,
          images: _imagesData,
          image: _imagesData[0],
          price: _price,
          inventory: _variations[0].inventory,
          variations: _variations,
          ..._customAttributes,
        };
      });
      return await Promise.all(_items);
    } catch (error) {
      this.ApiErrorHandler(error);
      console.log(error);
    }
  }
  public async uploadImage(filePath) {
    //developer.squareup.com/forums/t/only-multipart-form-data-content-type-allowed-but-got-application-x-www-form-urlencoded-node-js-sdk/2296/4
    https: try {
      const request: CreateCatalogImageRequest = {
        idempotencyKey: uuidv4(),
        image: {
          id: "#image_id",
          type: "IMAGE",
          imageData: {
            name: "testerImg",
          },
        },
      };

      const fileStream = fs.createReadStream(filePath);
      const imageFile = new FileWrapper(fileStream, {
        contentType: "image/jpeg",
      });
      const { result } = await this.catalogApi.createCatalogImage(
        request,
        imageFile
      );
    } catch (error) {
      console.log(error);
    }
  }

  // public async createTestCatalog() {
  //   const customAttributes: CatalogObject[] = [
  //     {
  //       id: "#item_unit",
  //       type: "CUSTOM_ATTRIBUTE_DEFINITION",
  //       customAttributeDefinitionData: {
  //         allowedObjectTypes: ["ITEM", "ITEM_VARIATION"],
  //         name: "unit",
  //         type: "STRING",
  //         key: "item_unit",
  //       },
  //     },
  //     {
  //       id: "#weight",
  //       type: "CUSTOM_ATTRIBUTE_DEFINITION",
  //       customAttributeDefinitionData: {
  //         allowedObjectTypes: ["ITEM", "ITEM_VARIATION"],
  //         name: "weight",
  //         type: "STRING",
  //         key: "item_weight",
  //       },
  //     },
  //   ];

  //   const items: CatalogObject[] = [
  //     {
  //       id: "#Chocolate Lava Mix",
  //       type: "ITEM",
  //       customAttributeValues: {
  //         item_weight: {
  //           key: "item_weight",
  //           type: "STRING",
  //           name: "weight",
  //           stringValue: "150",
  //         },
  //         item_unit: {
  //           key: "item_unit",
  //           type: "STRING",
  //           name: "unit",
  //           stringValue: "g",
  //         },
  //       },
  //       itemData: {
  //         name: "Koana Speciality Med-Dark Roast",
  //         description: "Koana House Roasted Med-Dark Ka'u coffee",
  //         variations: [
  //           {
  //             type: "ITEM_VARIATION",
  //             id: "#med-Dark-Roast",
  //             itemVariationData: {
  //               imageIds: [],
  //               name: "Regular",
  //               priceMoney: {
  //                 amount: 3000n,
  //                 currency: "USD",
  //               },
  //             },
  //           },
  //         ],
  //       },
  //     },
  //   ];
  //   const batchUpsertCatalogObjectsRequest: BatchUpsertCatalogObjectsRequest = {
  //     idempotencyKey: uuidv4(),
  //     batches: [
  //       {
  //         objects: [...customAttributes, ...items],
  //       },
  //     ],
  //   };
  //   try {
  //     const result = await this.catalogApi.batchUpsertCatalogObjects(
  //       batchUpsertCatalogObjectsRequest
  //     );
  //     console.log(result);
  //   } catch (error) {
  //     console.log("error", error);
  //   }
  // }
}

export default CatalogServices;
