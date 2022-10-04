import { Client, Environment, ApiError } from "square";
import * as dotenv from "dotenv";
dotenv.config();
import Item, { SquareItem } from "./item.interface";

interface catalogItem {
  ITEM?: { id: string; customAttributeValues?: any[]; itemData: any }[];
  IMAGE?: { id: string; imageData: any }[];
  CATEGORY?: { id: string; categoryData: any }[];
}

class SquareService {
  private client: Client;
  constructor() {
    this.client = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: Environment.Production,
    });
  }

  public async getCalatog(): Promise<SquareItem[]> {
    const { locationsApi, catalogApi, inventoryApi } = this.client;

    try {
      const res = await catalogApi.listCatalog(
        undefined,
        "ITEM,IMAGE,CATEGORY"
      );

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

            const inventoryItem = await inventoryApi.retrieveInventoryCount(
              variation.id
            );

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

        const _imagesData = imageIds.map((imageId) => {
          const _image = images.find((image) => image.id === imageId);
          if (_image) return _image.imageData.url;
          // return {
          //   ..._image.imageData,
          //   name: _image.imageData.name.replace(/_|.jpg/g, " ").trim(),
          // };
        });

        const _price = Number(_variations[0].priceMoney.amount) / 100;
        return {
          id: item.id,
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
      console.log(error);
    }
  }

  public async createOrder(variationId) {
    console.log(variationId);
    const { ordersApi } = this.client;

    return { test: variationId };
  }
  public async getItemList() {
    try {
      const { locationsApi, catalogApi, inventoryApi } = this.client;
      const res = await catalogApi.listCatalog();

      const results = await Promise.all(
        res.result.objects.map(async ({ itemData }, i) => {
          let _itemDataResponseObj;
          if (itemData) {
            const { name, description, variations, imageIds } = itemData;
            _itemDataResponseObj = { name, description };
            _itemDataResponseObj.images = await Promise.all(
              imageIds.map(async (imageId) => {
                const catologObject = await catalogApi.retrieveCatalogObject(
                  imageId
                );

                return catologObject.result.object.imageData;
              })
            );

            _itemDataResponseObj.variations = await Promise.all(
              variations.map(
                async ({ itemVariationData, id: catalogObjectId }) => {
                  const res = await inventoryApi.retrieveInventoryCount(
                    catalogObjectId
                  );

                  const inventory = {
                    state: res.result.counts[0].state,
                    quantity: res.result.counts[0].quantity,
                  };

                  const imageUrls = await Promise.all(
                    itemVariationData.imageIds.map(async (imageId) => {
                      const catologObject =
                        await catalogApi.retrieveCatalogObject(imageId);

                      return catologObject.result.object.imageData;
                    })
                  );

                  const { itemId, name, priceMoney } = itemVariationData;

                  return {
                    itemId,
                    name,
                    priceMoney,
                    images: imageUrls,
                    inventory,
                  };
                }
              )
            );
          }

          return _itemDataResponseObj;
        })
      );
      const filteredResults = results.filter((result) => result !== undefined);
      return filteredResults;
    } catch (error) {
      if (error instanceof ApiError) {
        error.result.errors.forEach(function (e) {
          console.log(e.category);
          console.log(e.code);
          console.log(e.detail);
        });
      } else {
        console.log("Unexpected error occurred: ", error);
      }
    }
  }
}

export default SquareService;
