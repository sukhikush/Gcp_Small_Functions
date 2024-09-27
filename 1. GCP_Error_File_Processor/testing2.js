var sukhi = "";

(async () => {
  for (let i = 0; i < 10; i++) {
    sukhi = "sukhi" + i;
    const promise1 = await new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve("foo");
      }, 900);
    });
  }
})().then(() => {
  console.log("Done");
});
