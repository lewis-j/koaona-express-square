import {
  Client,
  Environment,
  ApiError,
  InventoryApi,
  CatalogApi,
} from "square";
import * as dotenv from "dotenv";
dotenv.config();
import Item, { SquareItem } from "./item.interface";

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
}

export default CatalogServices;
