import { DocItemContext } from "solidity-docgen/dist/site";

export const visible = ({
  item,
}: DocItemContext & { item: { visibility: "public" | "external" | "private" | "internal" } }): boolean => item.visibility === "public" || item.visibility === "external";
