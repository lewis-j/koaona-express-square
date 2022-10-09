var square = require("square");
const { Client, Environment, ApiError } = square;
import * as dotenv from "dotenv";
dotenv.config();

exports.getCalatog = async () => {
  //Grab API's from square client
  const { catalogApi, inventoryApi } = new Client({
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Production,
  });

  try {
    //load items, images, and category from Catalog Api
    const res = await catalogApi.listCatalog(undefined, "ITEM,IMAGE,CATEGORY");

    //reduce items into an object and match based on type
    const {
      ITEM: items,
      IMAGE: images,
      CATEGORY: categories,
    } = res.result.objects.reduce((acc, cur) => {
      if (cur.isDeleted) return acc;
      return { ...acc, [cur.type]: [...(acc[cur.type] || []), cur] };
    }, {});

    //Map through each catolog object with type item
    const _items = items.map(async (item) => {
      //check for custom attributes, if they exist convert the square dashboard key (name) and value (stringValue) pair into
      //a javascript key value pair.
      const _customAttributes = item?.customAttributeValues
        ? Object.values(item.customAttributeValues).reduce(
            (acc, { name, stringValue }) => {
              return { ...acc, [name.toLowerCase()]: stringValue };
            },
            {}
          )
        : /* return null if custom attributes don't exist*/ {
            weight: null,
            unit: null,
          };

      //grab other relevant properties from item data
      const { name, description, categoryId, variations, imageIds } =
        item.itemData;

      //search catalog object array with type "CATEGORIES" against current map index catalog object with type "ITEM"
      const _category =
        categories.find((category) => category.id === categoryId)?.categoryData
          .name || "undefined";

      //map through each variation of current catalog object with type "ITEM"
      const _variations = await variations.reduce(
        async (filtered, variation) => {
          //await promise from previous iteration
          const _filtered = await filtered;
          //check if item is marked as deleted
          if (variation.isDeleted) return _filtered;

          //grab relevant properties
          const { imageIds, name, priceMoney } = variation.itemVariationData;

          //make a call to the inventory api in ordert to grab to total count
          const inventoryItem = await inventoryApi.retrieveInventoryCount(
            variation.id
          );

          return [
            /*Add previous array */
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
      //search catalog object array id with type "IMAGE" against  imagesIds array of current index catalog object with type "ITEM"
      const _imagesData = imageIds.map((imageId) => {
        const _image = images.find((image) => image.id === imageId);
        if (_image)
          return {
            ..._image.imageData,
            name: _image.imageData.name.replace(/_|.jpg/g, " ").trim(),
          };
      });

      //grab the first variations price and convert it to a floating point to be stored as the items default price
      const _price = Number(_variations[0].priceMoney.amount) / 100;
      //returned object
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
};
