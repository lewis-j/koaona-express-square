interface Item {
  images: any[];
  variations: any[];
  name: string;
  description: string;
}

export interface SquareItem {
  id: string;
  name: string;
  cat: string;
  images: string[];
  price: number;
  weight: number;
  unit: string;
  desc: string;
  inventory: number;
}

export default Item;
