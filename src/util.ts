export const serializeBigInt = (itemList) => {
  const serializedItem = JSON.stringify(itemList, (_, v) =>
    typeof v === "bigint" ? `${v}` : v
  );
  return JSON.parse(serializedItem);
};
