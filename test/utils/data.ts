export const addr0000 = "0x0000000000000000000000000000000000000000";
export const addr1111 = "0x1111111111111111111111111111111111111111";
export const getSimpleAddress = (i: number) => {
  return (
    "0x" +
    Array.from({ length: 40 })
      .map(() => `${i}`)
      .join("")
  );
};

export const getBytes32String = (i: number) => {
  return (
    "0x" +
    Array.from({ length: 64 })
      .map(() => `${i}`)
      .join("")
  );
};
